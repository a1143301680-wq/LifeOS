from datetime import datetime
from zoneinfo import ZoneInfo

SERVER_TIMEZONE = ZoneInfo("Asia/Shanghai")


def now_server() -> datetime:
    return datetime.now(tz=SERVER_TIMEZONE)


def server_time_iso() -> str:
    return now_server().isoformat(timespec="seconds")
