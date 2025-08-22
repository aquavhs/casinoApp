# ← заменить содержимое файла на это
import time
import secrets
from dataclasses import dataclass
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/rounds", tags=["rounds"])

# ---- Простая модель состояния в памяти ----
@dataclass
class RoundState:
    id: int
    started_at: float
    ends_at: float
    reveal_at: float | None
    status: str           # "betting" | "closed" | "settled"
    outcome: str | None   # "up" | "down" | None
    seed: str             # для честности (потом раскроем)

ROUND_DURATION = 30  # сек
REVEAL_DELAY = 5      # пауза перед раскрытием результата
_current: RoundState | None = None
_counter = 0

def _ensure_round():
    """Создаёт новый раунд, если его нет или он завершён."""
    global _current, _counter
    now = time.time()
    if _current is None or _current.status == "settled":
        _counter += 1
        _current = RoundState(
            id=_counter,
            started_at=now,
            ends_at=now + ROUND_DURATION,
            reveal_at=None,
            status="betting",
            outcome=None,
            seed=secrets.token_hex(16),  # ← заготовка под commit-reveal
        )
    else:
        # обновляем статусы по времени
        if now >= _current.ends_at and _current.status == "betting":
            _current.status = "closed"
            # определяем исход честным RNG
            _current.outcome = "up" if secrets.randbelow(2) == 1 else "down"
            _current.reveal_at = now + REVEAL_DELAY
        elif _current.status == "closed" and _current.reveal_at and now >= _current.reveal_at:
            # в реальности тут же бы считали выплаты
            _current.status = "settled"

@router.get("/state")
async def get_state():
    _ensure_round()
    now = time.time()
    timeleft = max(0, int(_current.ends_at - now)) if _current.status == "betting" else 0
    return JSONResponse({
        "id": _current.id,
        "status": _current.status,
        "timeleft": timeleft,
        "outcome": _current.outcome,
        "duration": ROUND_DURATION
    })

@router.post("/bet")
async def place_bet():
    # MVP-заглушка: приём ставки пока не сохраняем (позже — БД)
    _ensure_round()
    ok = (_current.status == "betting")
    return JSONResponse({"ok": ok, "round_id": _current.id, "status": _current.status})
