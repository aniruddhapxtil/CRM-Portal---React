"""Loads the real CRM app (main.py) against a throw-away sqlite file, so no Postgres, AWS or Microsoft is needed."""
import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# Environment variables beat the real .env file, so these tests never touch the real database.
_tmp = tempfile.mkdtemp(prefix="crm-test-")
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{Path(_tmp, 'test.db').as_posix()}",
        "AUTH_MODE": "demo",
        "SESSION_SECRET": "b" * 64,
        "REDIRECT_URI": "http://localhost:8000/auth/callback",
        "APP_LANDING_URL": "/voice",
        "COOKIE_SECURE": "false",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402  (the CRM app)


@pytest.fixture(scope="session")
def crm_app():
    return main.app


@pytest.fixture()
def browser(crm_app):
    """Fresh, signed-out browser on localhost (the demo login only works on localhost)."""
    return TestClient(crm_app, base_url="http://localhost", follow_redirects=False)


@pytest.fixture()
def signed_in(browser):
    r = browser.post("/auth/demo/login", data={"email": "rep@dataphi.demo"})
    assert r.status_code == 303
    return browser
