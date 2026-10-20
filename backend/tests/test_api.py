from tests.conftest import PASSWORD, jpeg, make_client, register


def test_register_login_logout_cycle(client):
    session = register(client)
    assert session["user"]["email"] == "dorji@example.bt"
    assert client.get("/api/users/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/users/me").status_code == 401

    response = client.post("/api/auth/login", json={"email": "DORJI@example.bt", "password": PASSWORD})
    assert response.status_code == 200
    assert client.get("/api/users/me").json()["name"] == "Dorji"


def test_logout_revokes_tokens_issued_earlier(client):
    register(client)
    stolen = client.cookies.get("bfr_session")
    client.post("/api/auth/logout")
    other = make_client()
    assert other.get("/api/users/me", headers={"Authorization": f"Bearer {stolen}"}).status_code == 401


def test_login_errors_do_not_reveal_which_part_was_wrong(client):
    register(client)
    wrong_password = client.post("/api/auth/login", json={"email": "dorji@example.bt", "password": "not the password"})
    no_account = client.post("/api/auth/login", json={"email": "nobody@example.bt", "password": "not the password"})
    assert wrong_password.status_code == no_account.status_code == 401
    assert wrong_password.json() == no_account.json()


def test_login_is_rate_limited(client):
    register(client)
    codes = [
        client.post("/api/auth/login", json={"email": "dorji@example.bt", "password": "wrong guess"}).status_code
        for _ in range(6)
    ]
    assert codes[:5] == [401] * 5
    assert codes[5] == 429


def test_weak_and_common_passwords_are_refused(client):
    for password in ["short", "password123"]:
        response = client.post("/api/auth/register", json={"name": "A", "email": "a@example.bt", "password": password})
        assert response.status_code == 422


def test_duplicate_email_is_refused(client):
    register(client)
    response = client.post("/api/auth/register", json={"name": "B", "email": "dorji@example.bt", "password": PASSWORD})
    assert response.status_code == 409


def test_cookie_requests_without_csrf_header_are_refused(user_client):
    response = user_client.post("/api/auth/logout", headers={"X-Requested-With": ""})
    assert response.status_code == 403


def test_predict_saves_history_and_feedback(user_client):
    response = user_client.post("/api/predict", files={"file": ("dish.jpg", jpeg(), "image/jpeg")})
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["is_placeholder"] is True
    assert len(result["top"]) == 3
    assert result["top"][0]["slug"] == result["predicted_food"]

    image = user_client.get(result["image_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"

    history = user_client.get("/api/history").json()
    assert history["total"] == 1

    wrong_dish = "momo" if result["predicted_food"] != "momo" else "puta"
    feedback = user_client.post(
        "/api/feedback",
        json={"prediction_id": result["id"], "is_correct": False, "correct_food": wrong_dish, "comment": "dim light"},
    )
    assert feedback.status_code == 200
    assert feedback.json()["feedback"]["correct_food"] == wrong_dish

    stats = user_client.get("/api/stats").json()
    assert stats["total_scans"] == 1
    assert stats["with_feedback"] == 1
    assert stats["correct"] == 0
    assert stats["mix_ups"][0]["was"] == wrong_dish
    assert sum(day["count"] for day in stats["last_14_days"]) == 1

    assert user_client.get("/api/history", params={"answer": "wrong"}).json()["total"] == 1
    assert user_client.get("/api/history", params={"answer": "none"}).json()["total"] == 0


def test_the_same_photo_gets_the_same_answer(user_client):
    first = user_client.post("/api/predict", files={"file": ("a.jpg", jpeg((10, 120, 30)), "image/jpeg")}).json()
    second = user_client.post("/api/predict", files={"file": ("b.jpg", jpeg((10, 120, 30)), "image/jpeg")}).json()
    assert first["predicted_food"] == second["predicted_food"]
    assert first["confidence"] == second["confidence"]


def test_non_images_are_rejected(user_client):
    response = user_client.post("/api/predict", files={"file": ("evil.jpg", b"<?php echo 1; ?>", "image/jpeg")})
    assert response.status_code == 422


def test_oversized_images_are_rejected_before_decoding(user_client):
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("1", (8000, 6000)).save(buffer, format="PNG")  # 48 MP but tiny on disk
    response = user_client.post("/api/predict", files={"file": ("big.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 422


def test_users_cannot_see_or_touch_each_others_scans(user_client):
    result = user_client.post("/api/predict", files={"file": ("dish.jpg", jpeg(), "image/jpeg")}).json()

    intruder = make_client()
    register(intruder, email="karma@example.bt", name="Karma")
    assert intruder.get(result["image_url"]).status_code == 404
    assert intruder.get("/api/history").json()["total"] == 0
    assert intruder.post("/api/feedback", json={"prediction_id": result["id"], "is_correct": True}).status_code == 404
    assert intruder.delete(f"/api/history/{result['id']}").status_code == 404
    assert user_client.get("/api/history").json()["total"] == 1


def test_password_change_signs_out_other_sessions(user_client):
    other = make_client()
    other.post("/api/auth/login", json={"email": "dorji@example.bt", "password": PASSWORD})
    assert other.get("/api/users/me").status_code == 200

    response = user_client.post(
        "/api/users/me/password", json={"current_password": PASSWORD, "new_password": "buckwheat puta noodles"}
    )
    assert response.status_code == 200
    assert user_client.get("/api/users/me").status_code == 200
    assert other.get("/api/users/me").status_code == 401


def test_delete_removes_scan(user_client):
    result = user_client.post("/api/predict", files={"file": ("dish.jpg", jpeg(), "image/jpeg")}).json()
    assert user_client.delete(f"/api/history/{result['id']}").status_code == 204
    assert user_client.get("/api/history").json()["total"] == 0
    assert user_client.get(result["image_url"]).status_code == 404


def test_dishes_are_public_and_complete(client):
    dishes = client.get("/api/dishes").json()
    assert len(dishes) == 9
    assert {"ema_datshi", "momo", "hoentay"} <= {d["slug"] for d in dishes}
