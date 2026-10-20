from fastapi import APIRouter

from app.services.dishes import DISHES, Dish

router = APIRouter(tags=["dishes"])


@router.get("/dishes")
def list_dishes() -> list[Dish]:
    return DISHES
