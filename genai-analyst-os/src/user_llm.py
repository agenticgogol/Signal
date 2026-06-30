from __future__ import annotations

import os
from dataclasses import dataclass

from src.db import get_client
from src.security import decrypt_secret_if_needed


@dataclass
class UserLlmSettings:
    provider: str
    model: str
    api_key: str
    custom: bool = False


_DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4o",
    "groq": "llama-3.3-70b-versatile",
    "openrouter": "openai/gpt-4.1-mini",
}


def _normalize_provider(value: str | None) -> str:
    provider = (value or os.getenv("LLM_PROVIDER") or "anthropic").strip().lower()
    if provider not in {"anthropic", "openai", "groq", "openrouter"}:
        return "anthropic"
    return provider


def _fallback_key(provider: str) -> str:
    return {
        "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
        "openai": os.getenv("OPENAI_API_KEY", ""),
        "groq": os.getenv("GROQ_API_KEY", ""),
        "openrouter": os.getenv("OPENROUTER_API_KEY", ""),
    }.get(provider, "")


def default_user_llm_settings() -> UserLlmSettings:
    provider = _normalize_provider(None)
    return UserLlmSettings(
        provider=provider,
        model=_DEFAULT_MODELS.get(provider, _DEFAULT_MODELS["anthropic"]),
        api_key=_fallback_key(provider),
        custom=False,
    )


def get_user_llm_settings(user_id: str) -> UserLlmSettings:
    fallback = default_user_llm_settings()
    if not user_id:
        return fallback

    response = (
        get_client()
        .table("user_profiles")
        .select("llm_provider, llm_model, llm_api_key")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = response.data or {}
    provider = _normalize_provider(data.get("llm_provider"))
    model = str(data.get("llm_model") or "").strip() or _DEFAULT_MODELS.get(provider, fallback.model)
    stored_key = str(data.get("llm_api_key") or "").strip()
    api_key = decrypt_secret_if_needed(stored_key) if stored_key else _fallback_key(provider)

    return UserLlmSettings(
        provider=provider,
        model=model,
        api_key=api_key,
        custom=bool(data.get("llm_provider") or data.get("llm_model") or data.get("llm_api_key")),
    )
