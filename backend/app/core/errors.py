from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.core.envelope import error_envelope


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(exc.code, exc.message, exc.details),
    )


async def validation_error_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content=error_envelope(
            "validation_error",
            "request validation failed",
            {"errors": jsonable_encoder(exc.errors())},
        ),
    )


async def unhandled_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_envelope("internal_error", "internal server error"),
    )
