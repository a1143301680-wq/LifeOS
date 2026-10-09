import json
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from openai import OpenAI
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings, get_settings
from app.core.database import Base, get_db
from app.core.errors import ApiError
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.services.ai_today_provider import (
    CONTEXT_TOOL_NAME,
    DeepSeekResponsesProvider,
    ProviderFailure,
    ProviderPlanResult,
    ProviderToolRequest,
    get_ai_today_provider,
)


class FakeProvider:
    def __init__(self) -> None:
        self.tool_request = ProviderToolRequest(
            call_id="call-1",
            name=CONTEXT_TOOL_NAME,
            arguments={},
            input_tokens=7,
            output_tokens=2,
        )
        self.plan = {
            "summary": "Protect the deadline and keep the rest light.",
            "focus_items": [],
            "risks": [],
            "suggested_todo": None,
        }
        self.contexts: list[dict] = []
        self.failure: ProviderFailure | None = None

    def request_context_tool(self, selected_date: date) -> ProviderToolRequest:
        if self.failure is not None:
            raise self.failure
        return self.tool_request

    def request_final_plan(
        self,
        selected_date: date,
        tool_request: ProviderToolRequest,
        context: dict,
    ) -> ProviderPlanResult:
        if self.failure is not None:
            raise self.failure
        self.contexts.append(context)
        return ProviderPlanResult(
            payload=self.plan,
            model="deepseek-flash",
            input_tokens=13,
            output_tokens=17,
        )


def auth_headers(client, alias: str = "me") -> dict[str, str]:
    return {"Authorization": f"Bearer {client.tokens[alias]}"}


def row_counts(client) -> dict[str, int]:
    with client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "categories": len(db.execute(select(TodoCategory)).all()),
            "sync": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def test_plan_uses_owned_bounded_context_and_performs_zero_writes(ai_client):
    before = row_counts(ai_client)
    owned_ids = [str(value) for value in ai_client.todo_ids["me"]]
    ai_client.provider.plan = {
        "summary": "Start with the overdue work.",
        "focus_items": [{"todo_id": owned_ids[0], "reason": "It is overdue."}],
        "risks": [{"todo_id": owned_ids[1], "message": "The due time is close."}],
        "suggested_todo": {
            "title": "Confirm the handoff",
            "priority": "medium",
            "planned_date": "2026-09-27",
            "category_id": str(ai_client.category_ids["work"]),
            "reason": "Close the loop after the focused work.",
        },
    }

    response = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "date": "2026-09-27",
        **ai_client.provider.plan,
        "usage": {
            "model": "deepseek-flash",
            "input_tokens": 20,
            "output_tokens": 19,
            "total_tokens": 39,
        },
    }
    context = ai_client.provider.contexts[0]
    assert context["date"] == "2026-09-27"
    assert context["timezone"] == "Asia/Shanghai"
    assert [item["id"] for item in context["todos"]] == owned_ids[:2]
    assert all("user_id" not in item for item in context["todos"])
    assert str(ai_client.todo_ids["partner"][0]) not in json.dumps(context)
    assert str(ai_client.todo_ids["deleted"]) not in json.dumps(context)
    assert row_counts(ai_client) == before


def test_plan_auth_exact_body_and_identity_isolation(ai_client):
    missing_auth = ai_client.post("/api/v1/ai/today-plan", json={"date": "2026-09-27"})
    extra = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27", "user_id": str(ai_client.user_ids["partner"])},
    )
    partner = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client, "partner"),
        json={"date": "2026-09-27"},
    )

    assert missing_auth.status_code == 401
    assert extra.status_code == 400
    assert extra.json()["error"]["code"] == "validation_error"
    assert partner.status_code == 200
    assert [item["id"] for item in ai_client.provider.contexts[-1]["todos"]] == [
        str(ai_client.todo_ids["partner"][0])
    ]


@pytest.mark.parametrize(
    "plan",
    [
        {
            "summary": "Bad reference",
            "focus_items": [{"todo_id": str(uuid4()), "reason": "Unknown"}],
            "risks": [],
            "suggested_todo": None,
        },
        {
            "summary": "Duplicate reference",
            "focus_items": [
                {"todo_id": "00000000-0000-4000-8000-000000000001", "reason": "One"},
                {"todo_id": "00000000-0000-4000-8000-000000000001", "reason": "Two"},
            ],
            "risks": [],
            "suggested_todo": None,
        },
        {
            "summary": "Bad category",
            "focus_items": [],
            "risks": [],
            "suggested_todo": {
                "title": "Draft",
                "priority": "medium",
                "planned_date": "2026-09-27",
                "category_id": str(uuid4()),
                "reason": "Unknown category",
            },
        },
    ],
)
def test_invalid_provider_references_reject_the_complete_result(ai_client, plan):
    if "00000000-0000-4000-8000-000000000001" in json.dumps(plan):
        valid_id = str(ai_client.todo_ids["me"][0])
        plan = json.loads(json.dumps(plan).replace("00000000-0000-4000-8000-000000000001", valid_id))
    ai_client.provider.plan = plan

    response = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )

    assert response.status_code == 502
    assert response.json()["error"] == {
        "code": "ai_invalid_response",
        "message": "AI planning returned an invalid response",
        "details": {},
    }


def test_tool_and_provider_failures_are_sanitized(ai_client):
    ai_client.provider.tool_request = ProviderToolRequest(
        call_id="call-1",
        name="unknown_tool",
        arguments={},
        input_tokens=1,
        output_tokens=1,
    )
    bad_tool = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )
    ai_client.provider.failure = ProviderFailure("rate_limit", "raw provider secret")
    failed = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )

    assert bad_tool.status_code == 502
    assert bad_tool.json()["error"]["code"] == "ai_invalid_response"
    assert failed.status_code == 429
    assert failed.json()["error"]["code"] == "ai_rate_limited"
    assert "raw provider secret" not in failed.text


@pytest.mark.parametrize(
    ("kind", "expected_status", "expected_code"),
    [
        ("timeout", 504, "ai_timeout"),
        ("rate_limit", 429, "ai_rate_limited"),
        ("unavailable", 503, "ai_provider_unavailable"),
    ],
)
def test_provider_failures_use_sanitized_stable_errors(ai_client, kind, expected_status, expected_code):
    ai_client.provider.failure = ProviderFailure(kind, "provider body must stay private")

    response = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    assert "provider body must stay private" not in response.text


def test_missing_provider_configuration_is_sanitized():
    with pytest.raises(ApiError) as caught:
        get_ai_today_provider(Settings(DEEPSEEK_API_KEY=""))

    error = caught.value
    assert error.status_code == 503
    assert error.code == "ai_not_configured"
    assert error.details == {}


@pytest.mark.parametrize(
    "invalid_plan",
    [
        {
            "summary": "x" * 601,
            "focus_items": [],
            "risks": [],
            "suggested_todo": None,
        },
        {
            "summary": "Unexpected field",
            "focus_items": [],
            "risks": [],
            "suggested_todo": None,
            "reasoning": "must not be accepted",
        },
        {
            "summary": "Malformed Todo reference",
            "focus_items": [{"todo_id": "not-a-uuid", "reason": "Invalid identifier"}],
            "risks": [],
            "suggested_todo": None,
        },
        {
            "summary": "Malformed planned date",
            "focus_items": [],
            "risks": [],
            "suggested_todo": {
                "title": "Draft",
                "priority": "medium",
                "planned_date": "not-a-date",
                "category_id": None,
                "reason": "Invalid date",
            },
        },
    ],
)
def test_schema_bounds_reject_the_complete_provider_result(ai_client, invalid_plan):
    ai_client.provider.plan = invalid_plan

    response = ai_client.post(
        "/api/v1/ai/today-plan",
        headers=auth_headers(ai_client),
        json={"date": "2026-09-27"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_invalid_response"


def test_deepseek_adapter_forces_one_tool_then_strict_structured_output():
    tool_output = SimpleNamespace(
        status="completed",
        output=[SimpleNamespace(type="function_call", call_id="call-1", name=CONTEXT_TOOL_NAME, arguments="{}")],
        usage=SimpleNamespace(input_tokens=5, output_tokens=2),
    )
    final_output = SimpleNamespace(
        status="completed",
        output=[
            SimpleNamespace(
                type="message",
                status="completed",
                content=[SimpleNamespace(type="output_text", text=json.dumps({
                    "summary": "A bounded plan.",
                    "focus_items": [],
                    "risks": [],
                    "suggested_todo": None,
                }))],
            )
        ],
        usage=SimpleNamespace(input_tokens=9, output_tokens=11),
    )
    calls: list[dict] = []

    class Responses:
        def create(self, **kwargs):
            calls.append(kwargs)
            return tool_output if len(calls) == 1 else final_output

    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=SimpleNamespace(responses=Responses()),
    )
    tool = provider.request_context_tool(date(2026, 9, 27))
    result = provider.request_final_plan(
        date(2026, 9, 27),
        tool,
        {"date": "2026-09-27", "timezone": "Asia/Shanghai", "todos": [], "categories": []},
    )

    assert result.payload["summary"] == "A bounded plan."
    assert calls[0]["tool_choice"] == {"type": "function", "name": CONTEXT_TOOL_NAME}
    assert calls[0]["parallel_tool_calls"] is False
    assert calls[0]["store"] is False
    assert calls[1]["tool_choice"] == "none"
    assert calls[1]["text"]["format"]["type"] == "json_schema"
    assert calls[1]["text"]["format"]["strict"] is True
    assert calls[1]["store"] is False


def test_deepseek_adapter_sends_cross_list_reference_instructions():
    tool_output = SimpleNamespace(
        status="completed",
        output=[SimpleNamespace(type="function_call", call_id="call-1", name=CONTEXT_TOOL_NAME, arguments="{}")],
        usage=SimpleNamespace(input_tokens=5, output_tokens=2),
    )
    final_output = SimpleNamespace(
        status="completed",
        output=[
            SimpleNamespace(
                type="message",
                status="completed",
                content=[SimpleNamespace(type="output_text", text=json.dumps({
                    "summary": "A bounded plan.",
                    "focus_items": [],
                    "risks": [],
                    "suggested_todo": None,
                }))],
            )
        ],
        usage=SimpleNamespace(input_tokens=9, output_tokens=11),
    )
    calls: list[dict] = []

    class Responses:
        def create(self, **kwargs):
            calls.append(kwargs)
            return tool_output if len(calls) == 1 else final_output

    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=SimpleNamespace(responses=Responses()),
    )
    selected_date = date(2026, 9, 27)

    tool = provider.request_context_tool(selected_date)
    provider.request_final_plan(
        selected_date,
        tool,
        {"date": "2026-09-27", "timezone": "Asia/Shanghai", "todos": [], "categories": []},
    )

    for call in calls:
        instructions = call["instructions"]
        assert "A Todo ID may appear at most once across focus_items and risks" in instructions
        assert "risk.todo_id = null" in instructions


def test_deepseek_adapter_serializes_first_input_as_an_item_array():
    captured_body: dict = {}

    def handle_request(request: httpx.Request) -> httpx.Response:
        captured_body.update(json.loads(request.content))
        return httpx.Response(
            200,
            request=request,
            json={
                "id": "resp-fixture",
                "object": "response",
                "created_at": 0,
                "status": "completed",
                "model": "deepseek-flash",
                "output": [{
                    "type": "function_call",
                    "id": "function-fixture",
                    "call_id": "call-fixture",
                    "name": CONTEXT_TOOL_NAME,
                    "arguments": "{}",
                    "status": "completed",
                }],
                "usage": {"input_tokens": 5, "output_tokens": 2, "total_tokens": 7},
            },
        )

    http_client = httpx.Client(transport=httpx.MockTransport(handle_request))
    sdk_client = OpenAI(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        http_client=http_client,
    )
    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=sdk_client,
    )

    tool = provider.request_context_tool(date(2026, 9, 27))

    assert tool.name == CONTEXT_TOOL_NAME
    assert captured_body["input"] == [{
        "role": "user",
        "content": "Create the LifeOS Today plan for 2026-09-27.",
    }]


def test_deepseek_adapter_serializes_a_deepseek_compatible_final_schema():
    captured_bodies: list[dict] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        captured_bodies.append(json.loads(request.content))
        if len(captured_bodies) == 1:
            output = [{
                "type": "function_call",
                "id": "function-fixture",
                "call_id": "call-fixture",
                "name": CONTEXT_TOOL_NAME,
                "arguments": "{}",
                "status": "completed",
            }]
        else:
            output = [{
                "type": "message",
                "id": "message-fixture",
                "role": "assistant",
                "status": "completed",
                "content": [{
                    "type": "output_text",
                    "text": json.dumps({
                        "summary": "A bounded plan.",
                        "focus_items": [],
                        "risks": [],
                        "suggested_todo": None,
                    }),
                    "annotations": [],
                }],
            }]
        return httpx.Response(
            200,
            request=request,
            json={
                "id": f"response-{len(captured_bodies)}",
                "object": "response",
                "created_at": 0,
                "status": "completed",
                "model": "deepseek-flash",
                "output": output,
                "usage": {"input_tokens": 5, "output_tokens": 2, "total_tokens": 7},
            },
        )

    http_client = httpx.Client(transport=httpx.MockTransport(handle_request))
    sdk_client = OpenAI(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        http_client=http_client,
    )
    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=sdk_client,
    )
    selected_date = date(2026, 9, 27)

    tool = provider.request_context_tool(selected_date)
    provider.request_final_plan(
        selected_date,
        tool,
        {"date": "2026-09-27", "timezone": "Asia/Shanghai", "todos": [], "categories": []},
    )

    schema = captured_bodies[1]["text"]["format"]["schema"]

    def collect_formats(value):
        if isinstance(value, dict):
            return [value["format"]] if "format" in value else sum(
                (collect_formats(item) for item in value.values()),
                [],
            )
        if isinstance(value, list):
            return sum((collect_formats(item) for item in value), [])
        return []

    assert collect_formats(schema) == []


@pytest.mark.parametrize(
    "tool_output",
    [
        SimpleNamespace(status="incomplete", output=[]),
        SimpleNamespace(
            status="completed",
            output=[
                SimpleNamespace(type="function_call", call_id="call-1", name=CONTEXT_TOOL_NAME, arguments="{}"),
                SimpleNamespace(type="function_call", call_id="call-2", name=CONTEXT_TOOL_NAME, arguments="{}"),
            ],
        ),
        SimpleNamespace(
            status="completed",
            output=[SimpleNamespace(
                type="function_call",
                call_id="call-1",
                name=CONTEXT_TOOL_NAME,
                arguments='{"user_id":"forbidden"}',
            )],
        ),
    ],
)
def test_deepseek_adapter_rejects_incomplete_excess_and_argumented_tool_calls(tool_output):
    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=SimpleNamespace(responses=SimpleNamespace(create=lambda **_: tool_output)),
    )

    with pytest.raises(ProviderFailure) as caught:
        provider.request_context_tool(date(2026, 9, 27))

    assert caught.value.kind == "invalid_response"


def test_deepseek_adapter_rejects_refusal_instead_of_returning_partial_output():
    tool_output = SimpleNamespace(
        status="completed",
        output=[SimpleNamespace(type="function_call", call_id="call-1", name=CONTEXT_TOOL_NAME, arguments="{}")],
        usage=None,
    )
    refusal_output = SimpleNamespace(
        status="completed",
        output=[SimpleNamespace(
            type="message",
            status="completed",
            content=[SimpleNamespace(type="refusal", refusal="cannot comply")],
        )],
    )
    outputs = iter([tool_output, refusal_output])
    provider = DeepSeekResponsesProvider(
        api_key="fixture-key",
        base_url="https://api.deepseek.com",
        model="deepseek-flash",
        timeout_seconds=30,
        max_output_tokens=1200,
        client=SimpleNamespace(responses=SimpleNamespace(create=lambda **_: next(outputs))),
    )
    tool = provider.request_context_tool(date(2026, 9, 27))

    with pytest.raises(ProviderFailure) as caught:
        provider.request_final_plan(
            date(2026, 9, 27),
            tool,
            {"date": "2026-09-27", "timezone": "Asia/Shanghai", "todos": [], "categories": []},
        )

    assert caught.value.kind == "invalid_response"


@pytest.fixture()
def ai_client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'lifeos-ai.db'}", future=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {"inbox": uuid4(), "work": uuid4(), "partner": uuid4()}
    todo_ids = {
        "me": [uuid4(), uuid4(), uuid4()],
        "partner": [uuid4()],
        "deleted": uuid4(),
    }
    now = datetime(2026, 9, 27, 8, tzinfo=timezone.utc)

    with session_factory() as db:
        db.add_all([
            User(id=user_ids["me"], alias="me", display_name="Me", timezone="Asia/Shanghai", bootstrap_token_hash=hasher.hash(tokens["me"])),
            User(id=user_ids["partner"], alias="partner", display_name="Partner", timezone="Asia/Shanghai", bootstrap_token_hash=hasher.hash(tokens["partner"])),
            TodoCategory(id=category_ids["inbox"], user_id=user_ids["me"], name="Inbox", is_inbox=True, sort_order=0),
            TodoCategory(id=category_ids["work"], user_id=user_ids["me"], name="Work", is_inbox=False, sort_order=1),
            TodoCategory(id=category_ids["partner"], user_id=user_ids["partner"], name="Partner", is_inbox=True, sort_order=0),
        ])
        db.add_all([
            Todo(id=todo_ids["me"][0], user_id=user_ids["me"], category_id=category_ids["work"], title="Overdue", status="pending", priority="high", planned_date=date(2026, 9, 26), due_at=datetime(2026, 9, 26, 8, tzinfo=timezone.utc), version=1, created_at=now, updated_at=now),
            Todo(id=todo_ids["me"][1], user_id=user_ids["me"], category_id=category_ids["inbox"], title="Due today", status="pending", priority="medium", planned_date=date(2026, 9, 27), version=1, created_at=now, updated_at=now),
            Todo(id=todo_ids["me"][2], user_id=user_ids["me"], category_id=category_ids["work"], title="Later pending", status="pending", priority="low", version=1, created_at=now, updated_at=now),
            Todo(id=todo_ids["partner"][0], user_id=user_ids["partner"], category_id=category_ids["partner"], title="Partner private", status="pending", priority="high", planned_date=date(2026, 9, 27), version=1, created_at=now, updated_at=now),
            Todo(id=todo_ids["deleted"], user_id=user_ids["me"], category_id=category_ids["work"], title="Deleted private", status="pending", priority="high", version=1, created_at=now, updated_at=now, deleted_at=now),
        ])
        db.commit()

    provider = FakeProvider()
    app = create_app()

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: Settings(AI_CONTEXT_TODO_LIMIT=2)
    app.dependency_overrides[get_ai_today_provider] = lambda: provider
    client = TestClient(app, raise_server_exceptions=False)
    client.provider = provider
    client.session_factory = session_factory
    client.tokens = tokens
    client.user_ids = user_ids
    client.category_ids = category_ids
    client.todo_ids = todo_ids
    yield client
    app.dependency_overrides.clear()
    engine.dispose()
