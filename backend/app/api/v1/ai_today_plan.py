from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.envelope import data_envelope
from app.models.user import User
from app.schemas.ai_today_plan import AITodayPlanRequest
from app.services.ai_today_planner import generate_today_plan
from app.services.ai_today_provider import AITodayProvider, get_ai_today_provider

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/today-plan")
def create_today_plan(
    payload: AITodayPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    provider: AITodayProvider = Depends(get_ai_today_provider),
):
    plan = generate_today_plan(
        db,
        user=current_user,
        selected_date=payload.date,
        provider=provider,
        settings=settings,
    )
    return data_envelope(plan.model_dump(mode="json"))
