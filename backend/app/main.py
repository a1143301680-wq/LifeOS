from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import (
    ApiError,
    api_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.include_router(api_router)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
    return app


app = create_app()
