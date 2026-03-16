"""SSE router: real-time scan status updates via Server-Sent Events.

How it works:
- Client opens EventSource connection to /api/scans/{id}/events
- Server streams events as the scan progresses
- Events include: status changes, progress updates, completion
- Connection closes when scan reaches terminal state (complete/failed)
"""

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.services.scan_service import scan_events

router = APIRouter(tags=["events"])


@router.get("/api/scans/{scan_id}/events")
async def scan_sse(
    scan_id: int,
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time scan status updates."""

    async def event_generator():
        last_index = 0

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            # Get new events since last check
            events = scan_events.get(scan_id, [])
            new_events = events[last_index:]
            last_index = len(events)

            for event in new_events:
                data = json.dumps(event["data"])
                yield f"event: {event['type']}\ndata: {data}\n\n"

                # If terminal state, close the stream
                if event["type"] == "status" and event["data"].get("status") in (
                    "complete", "failed"
                ):
                    return

            # Poll interval
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
