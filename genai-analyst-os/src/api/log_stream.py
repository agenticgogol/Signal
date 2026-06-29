"""Async queue for streaming pipeline events to SSE subscribers."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

# Module-level queue; None until an SSE subscriber is attached.
_queue: asyncio.Queue | None = None

# Sentinel to signal the generator to stop cleanly.
_STOP = object()


def get_queue() -> asyncio.Queue | None:
    """Return the active event queue, or None if no subscriber is listening."""
    return _queue


def attach_queue(q: asyncio.Queue) -> None:
    """Register a queue to receive events (called when an SSE client connects)."""
    global _queue
    _queue = q


def detach_queue() -> None:
    """Deregister the queue (called when the SSE client disconnects)."""
    global _queue
    _queue = None


def put_event(event: dict[str, Any]) -> None:
    """Non-blocking enqueue; silently drops if no subscriber or queue is full."""
    q = _queue
    if q is None:
        return
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass


async def get_events_stream() -> AsyncGenerator[str, None]:
    """Async generator yielding SSE-formatted strings from pipeline events.

    Creates and attaches a queue, drains events until the client disconnects
    or a stop sentinel is received, then detaches the queue.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    attach_queue(q)
    try:
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send a keep-alive comment so the connection stays open.
                yield ": keep-alive\n\n"
                continue
            if event is _STOP:
                break
            yield f"data: {json.dumps(event)}\n\n"
    finally:
        detach_queue()


def stop_stream() -> None:
    """Push a stop sentinel so get_events_stream() exits cleanly."""
    q = _queue
    if q is not None:
        try:
            q.put_nowait(_STOP)
        except asyncio.QueueFull:
            pass
