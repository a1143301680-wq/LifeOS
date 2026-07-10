from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.envelope import data_envelope
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/me", tags=["identity"])


@router.get("")
def read_current_user(current_user: User = Depends(get_current_user)):
    return data_envelope(UserRead.model_validate(current_user).model_dump(mode="json"))
