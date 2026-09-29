"""Checks a Microsoft ID token sent by the MOBILE app (the app signs in with Microsoft itself, then sends us the token)."""
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import settings


@lru_cache
def _client() -> PyJWKClient:
    return PyJWKClient(f"https://login.microsoftonline.com/{settings().tenant_id}/discovery/v2.0/keys")


def validate_ms_id_token(id_token: str) -> dict:
    key = _client().get_signing_key_from_jwt(id_token).key
    return jwt.decode(
        id_token,
        key,
        algorithms=["RS256"],
        audience=settings().client_id,
        issuer=f"https://login.microsoftonline.com/{settings().tenant_id}/v2.0",
        options={"require": ["exp", "iat", "aud", "iss"]},
    )
