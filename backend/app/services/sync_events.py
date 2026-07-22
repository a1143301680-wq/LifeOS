import asyncio
import json
from collections import defaultdict
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from uuid import UUID

from app.core.time import server_time_iso

SYNC_AVAILABLE_TYPE = "sync.available"


def sync_available_payload(latest_cursor: int) -> dict:
    return {
        "type": SYNC_AVAILABLE_TYPE,
        "latest_cursor": latest_cursor,
        "server_time": server_time_iso(),
    }


def format_sse_event(payload: dict) -> str:
    data = json.dumps(payload, separators=(",", ":"))
    return f"event: {SYNC_AVAILABLE_TYPE}\ndata: {data}\n\n"


@dataclass(eq=False)
class SyncEventSubscription:
    user_id: UUID
    queue: asyncio.Queue[int] = field(default_factory=lambda: asyncio.Queue(maxsize=1))

    def publish(self, latest_cursor: int) -> None:
        if self.queue.full():
            pending_cursor = self.queue.get_nowait()
            latest_cursor = max(latest_cursor, pending_cursor)
        self.queue.put_nowait(latest_cursor)

    async def events(self, *, keepalive_seconds: float = 15.0) -> AsyncIterator[str]:
        while True:
            try:
                latest_cursor = await asyncio.wait_for(
                    self.queue.get(),
                    timeout=keepalive_seconds,
                )
            except TimeoutError:
                yield ": keepalive\n\n"
                continue

            yield format_sse_event(sync_available_payload(latest_cursor))


class SyncEventBroker:
    def __init__(self) -> None:
        self._subscribers: dict[UUID, set[SyncEventSubscription]] = defaultdict(set)

    def subscribe(self, user_id: UUID) -> SyncEventSubscription:
        subscription = SyncEventSubscription(user_id=user_id)
        self._subscribers[user_id].add(subscription)
        return subscription

    def unsubscribe(self, subscription: SyncEventSubscription) -> None:
        subscribers = self._subscribers.get(subscription.user_id)
        if subscribers is None:
            return
        subscribers.discard(subscription)
        if not subscribers:
            self._subscribers.pop(subscription.user_id, None)

    def publish(self, *, user_id: UUID, latest_cursor: int) -> None:
        for subscription in tuple(self._subscribers.get(user_id, ())):
            subscription.publish(latest_cursor)

    def subscriber_count(self, user_id: UUID) -> int:
        return len(self._subscribers.get(user_id, ()))

    def clear(self) -> None:
        self._subscribers.clear()


sync_event_broker = SyncEventBroker()


def publish_sync_available(*, user_id: UUID, latest_cursor: int) -> None:
    sync_event_broker.publish(user_id=user_id, latest_cursor=latest_cursor)
