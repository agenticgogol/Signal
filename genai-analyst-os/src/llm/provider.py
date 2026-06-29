import os
from collections.abc import Generator
from typing import Any

import litellm
from dotenv import load_dotenv

load_dotenv()

_MODELS: dict[str, dict[str, str]] = {
    "anthropic": {
        "primary": "anthropic/claude-sonnet-4-6",
        "cheap": "anthropic/claude-haiku-4-5-20251001",
    },
    "openai": {
        "primary": "openai/gpt-4o",
        "cheap": "openai/gpt-4o-mini",
    },
    "groq": {
        "primary": "groq/llama-3.3-70b-versatile",
        "cheap": "groq/llama-3.1-8b-instant",
    },
}

_MOCK_RESPONSE = "MOCK_LLM response: this is a canned reply for testing."


def get_provider() -> str:
    return os.getenv("LLM_PROVIDER", "anthropic")


def get_model(tier: str = "primary") -> str:
    provider = get_provider()
    return _MODELS.get(provider, _MODELS["anthropic"])[tier]


def _is_mock() -> bool:
    return os.getenv("MOCK_LLM", "false").lower() == "true"


def call_llm(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    tier: str = "primary",
    stream: bool = False,
) -> Any:
    if _is_mock():
        class _MockResponse:
            class _Choice:
                class _Message:
                    content = _MOCK_RESPONSE
                    tool_calls = None
                message = _Message()
            choices = [_Choice()]
        return _MockResponse()

    model = get_model(tier)
    all_messages = (
        [{"role": "system", "content": system}] + messages if system else messages
    )
    kwargs: dict[str, Any] = {"model": model, "messages": all_messages, "stream": stream}
    if tools:
        kwargs["tools"] = tools
    response = litellm.completion(**kwargs)
    try:
        cost = litellm.completion_cost(completion_response=response)
        from src.api.log_stream import put_event
        put_event({
            "type": "llm_cost",
            "model": model,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "cost_usd": round(cost, 6),
        })
    except Exception:
        pass  # cost tracking must never block
    return response


def stream_llm(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tier: str = "primary",
) -> Generator[str, None, None]:
    if _is_mock():
        for word in _MOCK_RESPONSE.split():
            yield word + " "
        return

    model = get_model(tier)
    all_messages = (
        [{"role": "system", "content": system}] + messages if system else messages
    )
    response = litellm.completion(model=model, messages=all_messages, stream=True)
    for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
