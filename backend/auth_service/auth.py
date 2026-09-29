"""Talks to Microsoft (MSAL). Only used when AUTH_MODE=microsoft."""
from functools import lru_cache
from urllib.parse import urlencode

import msal

from .config import settings

SCOPES = ["User.Read"]  # basic sign-in + profile


def _authority() -> str:
    return f"https://login.microsoftonline.com/{settings().tenant_id}"


@lru_cache
def _app() -> msal.ConfidentialClientApplication:
    s = settings()
    return msal.ConfidentialClientApplication(
        client_id=s.client_id,
        client_credential=s.client_secret,
        authority=_authority(),
    )


def start_login() -> dict:
    """Returns a 'flow' dict; flow['auth_uri'] is the Microsoft page to send the user to."""
    return _app().initiate_auth_code_flow(
        SCOPES, redirect_uri=settings().redirect_uri, prompt="select_account"
    )


def finish_login(flow: dict, query_params: dict) -> dict:
    """Checks Microsoft's reply (state, code, PKCE) and returns the user's identity claims."""
    result = _app().acquire_token_by_auth_code_flow(flow, query_params)
    if "error" in result:
        raise ValueError(result.get("error_description") or result["error"])
    return result["id_token_claims"]


def build_logout_url() -> str:
    q = urlencode({"post_logout_redirect_uri": settings().post_logout_redirect_uri})
    return f"{_authority()}/oauth2/v2.0/logout?{q}"
