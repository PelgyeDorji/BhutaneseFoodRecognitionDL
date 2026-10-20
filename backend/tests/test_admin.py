from app.db.session import SessionLocal
from app.models import User
from tests.conftest import PASSWORD, jpeg, make_client, register

ADMIN_ROUTES = ["/api/admin/summary", "/api/admin/users", "/api/admin/scans", "/api/admin/feedback.csv"]


def make_admin(email: str = "admin@example.bt"):
    client = make_client()
    register(client, email=email, name="Admin")
    with SessionLocal() as db:
        db.query(User).filter(User.email == email).update({"is_admin": True})
        db.commit()
    return client


def test_admin_routes_refuse_signed_out_and_ordinary_users(client, user_client):
    for route in ADMIN_ROUTES:
        assert client.get(route).status_code == 401
        assert user_client.get(route).status_code == 403


def test_registration_cannot_grant_admin(client):
    response = client.post(
        "/api/auth/register",
        json={"name": "Sneaky", "email": "sneaky@example.bt", "password": PASSWORD, "is_admin": True},
    )
    assert response.status_code == 201
    assert response.json()["user"]["is_admin"] is False
    assert client.get("/api/admin/users").status_code == 403


def test_admin_sees_every_users_scans_and_photos(user_client):
    scan = user_client.post("/api/predict", files={"file": ("dish.jpg", jpeg(), "image/jpeg")}).json()
    user_client.post("/api/feedback", json={"prediction_id": scan["id"], "is_correct": True})

    admin = make_admin()
    users = admin.get("/api/admin/users").json()
    assert users["total"] == 2
    dorji = next(u for u in users["items"] if u["email"] == "dorji@example.bt")
    assert (dorji["scans"], dorji["answered"], dorji["correct"]) == (1, 1, 1)

    scans = admin.get("/api/admin/scans").json()
    assert scans["total"] == 1
    assert scans["items"][0]["user"]["email"] == "dorji@example.bt"
    assert admin.get("/api/admin/scans", params={"user_id": dorji["id"], "answer": "correct"}).json()["total"] == 1

    assert admin.get(scan["image_url"]).status_code == 200
    assert admin.get("/api/admin/summary").json()["accuracy"] == 1.0

    # Admin views are read-only: the admin cannot delete or answer someone else's scan.
    assert admin.delete(f"/api/history/{scan['id']}").status_code == 404
    assert admin.post("/api/feedback", json={"prediction_id": scan["id"], "is_correct": False, "correct_food": "momo"}).status_code == 404


def test_admin_user_search_treats_wildcards_literally(user_client):
    admin = make_admin()
    assert admin.get("/api/admin/users", params={"q": "dorji"}).json()["total"] == 1
    assert admin.get("/api/admin/users", params={"q": "%"}).json()["total"] == 0


def test_feedback_export_neutralises_formulas(user_client):
    scan = user_client.post("/api/predict", files={"file": ("dish.jpg", jpeg(), "image/jpeg")}).json()
    wrong = "momo" if scan["predicted_food"] != "momo" else "puta"
    user_client.post(
        "/api/feedback",
        json={"prediction_id": scan["id"], "is_correct": False, "correct_food": wrong, "comment": '=HYPERLINK("http://x")'},
    )

    response = make_admin().get("/api/admin/feedback.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.strip().splitlines()
    assert lines[0].startswith("prediction_id,")
    assert len(lines) == 2
    assert "'=HYPERLINK" in lines[1]
    assert f",{wrong}," in lines[1]
