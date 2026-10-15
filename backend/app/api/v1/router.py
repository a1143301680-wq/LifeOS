from fastapi import APIRouter

from app.api.v1.ai_sessions import router as ai_sessions_router
from app.api.v1.ai_today_plan import router as ai_today_plan_router
from app.api.v1.me import router as me_router
from app.api.v1.projects import router as projects_router
from app.api.v1.project_stages import router as project_stages_router
from app.api.v1.project_milestones import router as project_milestones_router
from app.api.v1.project_todo_links import router as project_todo_links_router
from app.api.v1.sync import router as sync_router
from app.api.v1.todos import router as todos_router
from app.api.v1.todo_categories import router as todo_categories_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(me_router)
api_router.include_router(projects_router)
api_router.include_router(project_stages_router)
api_router.include_router(project_milestones_router)
api_router.include_router(project_todo_links_router)
api_router.include_router(ai_sessions_router)
api_router.include_router(todo_categories_router)
api_router.include_router(todos_router)
api_router.include_router(sync_router)
api_router.include_router(ai_today_plan_router)
