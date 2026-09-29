"""The CRM must be unreachable without a session. If someone adds a new /api route and forgets the
login check, test_every_api_route_requires_login fails."""
import re

import pytest
from auth_service import get_current_user
from fastapi.routing import APIRoute

PUBLIC_API_PATHS: set[str] = set()  # nothing under /api is meant to be public


def _api_routes(app):
    return [r for r in app.routes if isinstance(r, APIRoute) and r.path.startswith("/api")]


def _requires_login(route: APIRoute) -> bool:
    return any(d.dependency is get_current_user for d in route.dependencies)


def test_there_are_api_routes_to_check(crm_app):
    assert len(_api_routes(crm_app)) >= 25


def test_every_api_route_requires_login(crm_app):
    unprotected = [
        f"{sorted(r.methods)} {r.path}" for r in _api_routes(crm_app)
        if r.path not in PUBLIC_API_PATHS and not _requires_login(r)
    ]
    assert unprotected == [], f"These /api routes have no login check: {unprotected}"


def test_signed_out_requests_get_401_from_every_api_route(browser, crm_app):
    """Really call each route without a session (with an empty body): must be 401, never data, never 422/500."""
    for route in _api_routes(crm_app):
        path = re.sub(r"\{[^}]+\}", "1", route.path)
        for method in route.methods - {"HEAD", "OPTIONS"}:
            r = browser.request(method, path)
            assert r.status_code == 401, f"{method} {path} answered {r.status_code} without a session"


def test_health_check_stays_public(browser):
    assert browser.get("/health").status_code == 200


# ---------- pages ----------
@pytest.mark.parametrize("path", ["/", "/voice", "/accounts", "/accounts/new", "/leads/5/edit", "/anything/else"])
def test_signed_out_pages_redirect_to_login(browser, path):
    r = browser.get(path)
    assert r.status_code == 307 and r.headers["location"] == "/login"


def test_login_page_is_not_shadowed_by_the_catch_all_route(browser):
    r = browser.get("/login")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert "Sign in - DataPhi CRM" in r.text


@pytest.mark.parametrize("path", ["/voice", "/accounts", "/leads/5/edit"])
def test_signed_in_pages_are_let_through(signed_in, path):
    r = signed_in.get(path)
    # 200 when the React app has been built; 404 "Frontend build not found" when it has not. Never a redirect.
    assert r.status_code in (200, 404) and r.status_code != 307


def test_unknown_api_path_is_a_real_404_when_signed_in(signed_in):
    assert signed_in.get("/api/does-not-exist").status_code == 404


# ---------- session ----------
def test_signed_in_user_is_reported_by_auth_me(signed_in):
    body = signed_in.get("/auth/me").json()
    assert body["email"] == "rep@dataphi.demo" and body["role"] == "Sales Rep" and body["mode"] == "demo"


def test_landing_page_after_login_is_the_voice_station(browser):
    r = browser.post("/auth/demo/login", data={"email": "admin@dataphi.demo"})
    assert r.headers["location"] == "/voice"


def test_signed_out_after_logout(signed_in):
    signed_in.get("/auth/logout")
    assert signed_in.get("/auth/me").status_code == 401
    assert signed_in.get("/voice").status_code == 307
