from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas import HistoryEntry

router = APIRouter(prefix="/api", tags=["history"])

_history: list[HistoryEntry] = []
_counter: int = 0


@router.post("/history", response_model=HistoryEntry)
async def add_history(entry: HistoryEntry):
    global _counter
    _counter += 1
    now = datetime.now(timezone.utc).isoformat()
    record = entry.model_copy(
        update={"id": _counter, "created_at": now}, deep=True
    )
    _history.append(record)
    return record


@router.get("/history")
async def list_history():
    sorted_entries = sorted(
        _history, key=lambda e: e.created_at, reverse=True
    )[:50]
    return {"data": sorted_entries}
