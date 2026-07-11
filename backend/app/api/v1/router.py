from fastapi import APIRouter

from app.api.v1.me import router as me_router
from app.api.v1.todo_categories import router as todo_categories_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(me_router)
api_router.include_router(todo_categories_router)
