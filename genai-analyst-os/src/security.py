from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "enc:v1:"


def _encryption_key() -> bytes:
    raw = (os.getenv("APP_ENCRYPTION_KEY") or os.getenv("USER_SECRETS_KEY") or "").strip()
    if not raw:
        raise RuntimeError("APP_ENCRYPTION_KEY must be set for decrypting stored user API keys.")

    try:
        decoded = base64.b64decode(raw)
        if len(decoded) == 32 and base64.b64encode(decoded).decode().rstrip("=") == raw.rstrip("="):
            return decoded
    except Exception:
        pass

    return hashlib.sha256(raw.encode("utf-8")).digest()


def is_encrypted_secret(value: str | None) -> bool:
    return bool(value and value.startswith(_PREFIX))


def decrypt_secret_if_needed(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if not is_encrypted_secret(text):
        return text

    parts = text.split(":")
    if len(parts) != 5 or parts[0] != "enc" or parts[1] != "v1":
        raise RuntimeError("Encrypted secret payload is malformed.")

    _, _, iv_b64, cipher_b64, tag_b64 = parts
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(cipher_b64)
    tag = base64.b64decode(tag_b64)
    aes = AESGCM(_encryption_key())
    plaintext = aes.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode("utf-8")
