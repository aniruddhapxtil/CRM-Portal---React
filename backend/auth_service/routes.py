import logging
from urllib.parse import quote

from fastapi import APIRouter, Request, HTTPException, Depends, Form
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel

from . import pages
from .config import settings, LOCAL_HOSTS
from .database import SessionLocal
from .models import User, utcnow
from .session import (
    COOKIE_NAME, FLOW_COOKIE, create_session_token, get_current_user, get_current_user_page,
    encrypt_flow, decrypt_flow,
)

log = logging.getLogger("auth_service")
router = APIRouter()


# ---------- helpers ----------
def _login_error(message: str) -> RedirectResponse:
    resp = RedirectResponse(f"/login?error={quote(message[:300])}", status_code=303)
    resp.delete_cookie(FLOW_COOKIE, path="/")
    return resp


def _session_redirect(user: User, target: str) -> RedirectResponse:
    s = settings()
    token = create_session_token(user.id, user.email, user.role, user.full_name)
    resp = RedirectResponse(target, status_code=303)
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", secure=s.cookie_secure,
                    max_age=s.session_max_age_seconds, path="/")
    resp.delete_cookie(FLOW_COOKIE, path="/")
    return resp


def _require_demo(request: Request) -> None:
    if settings().mode != "demo":
        raise HTTPException(status_code=404, detail="Not found")
    if request.url.hostname not in LOCAL_HOSTS:
        raise HTTPException(status_code=403, detail="Demo login only works on localhost")


def _current_or_none(request: Request) -> dict | None:
    try:
        return get_current_user(request)
    except HTTPException:
        return None


def _find_user(db, oid: str | None, email: str) -> User | None:
    if oid:
        user = db.query(User).filter(User.ms_oid == oid).first()
        if user:
            return user
    user = db.query(User).filter(User.email == email).first()
    if user and user.ms_oid and oid and user.ms_oid != oid:
        return None  # same email, different Microsoft identity: refuse
    return user


# ---------- pages ----------
@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str | None = None):
    s = settings()
    if not error and _current_or_none(request):
        return RedirectResponse(s.app_landing_url, status_code=303)
    demo_users = None
    if s.mode == "demo" and request.url.hostname in LOCAL_HOSTS:
        db = SessionLocal()
        try:
            rows = db.query(User).filter(User.is_active.is_(True)).order_by(User.id).all()
            demo_users = [(u.email, u.full_name, u.role) for u in rows]
        finally:
            db.close()
    return HTMLResponse(pages.login_page(error=error, demo_users=demo_users))


@router.get("/welcome", response_class=HTMLResponse)
def welcome(user: dict = Depends(get_current_user_page)):
    return HTMLResponse(pages.welcome_page(user, settings().mode))


# ---------- Microsoft login (AUTH_MODE=microsoft) ----------
@router.get("/auth/login")
def auth_login():
    s = settings()
    if s.mode == "demo":
        return RedirectResponse("/login", status_code=303)
    from .auth import start_login

    flow = start_login()
    resp = RedirectResponse(flow["auth_uri"], status_code=303)
    resp.set_cookie(FLOW_COOKIE, encrypt_flow(flow), httponly=True, samesite="lax",
                    secure=s.cookie_secure, max_age=600, path="/")
    return resp


@router.get("/auth/callback")
def auth_callback(request: Request):
    s = settings()
    if s.mode != "microsoft":
        raise HTTPException(status_code=404, detail="Not found")
    from .auth import finish_login

    params = dict(request.query_params)
    if "error" in params:
        return _login_error(params.get("error_description") or params["error"])

    raw = request.cookies.get(FLOW_COOKIE)
    if not raw:
        return _login_error("Your login attempt expired. Please click Sign in again.")
    try:
        flow = decrypt_flow(raw)
    except Exception:
        return _login_error("Your login attempt expired. Please click Sign in again.")

    try:
        claims = finish_login(flow, params)
    except Exception as e:
        log.warning("Microsoft sign-in failed: %s", e)
        return _login_error(f"Microsoft sign-in failed: {e}")

    email = (claims.get("preferred_username") or claims.get("email") or "").strip().lower()
    oid = claims.get("oid")
    if not email:
        return _login_error("Microsoft did not return an email address for this account.")

    db = SessionLocal()
    try:
        user = _find_user(db, oid, email)
        if not user:
            return _login_error(f"{email} is signed in to Microsoft but has no CRM account. Ask an Admin to add your work email.")
        if not user.is_active:
            return _login_error("Your CRM account is deactivated. Contact an Admin.")
        user.ms_oid = user.ms_oid or oid
        user.last_login_at = utcnow()
        db.commit()
        return _session_redirect(user, s.app_landing_url)
    finally:
        db.close()


# ---------- Demo login (AUTH_MODE=demo, localhost only) ----------
@router.post("/auth/demo/login")
def demo_login(request: Request, email: str = Form(...)):
    _require_demo(request)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if not user or not user.is_active:
            return _login_error("Unknown or inactive user.")
        user.last_login_at = utcnow()
        db.commit()
        return _session_redirect(user, settings().app_landing_url)
    finally:
        db.close()


class EmailIn(BaseModel):
    email: str


@router.post("/auth/demo/token")
def demo_token(request: Request, body: EmailIn):
    """Demo-only: get a Bearer token without Microsoft, to test the mobile-style flow."""
    _require_demo(request)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == body.email.strip().lower()).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="Unknown or inactive user")
        return {"access_token": create_session_token(user.id, user.email, user.role, user.full_name),
                "token_type": "bearer"}
    finally:
        db.close()


# ---------- Mobile app ----------
class MobileExchangeIn(BaseModel):
    id_token: str


@router.post("/auth/mobile/exchange")
def mobile_exchange(body: MobileExchangeIn):
    """Mobile app signs in with Microsoft itself (MSAL + PKCE), sends the ID token here, gets our Bearer token."""
    if settings().mode != "microsoft":
        raise HTTPException(status_code=400, detail="Mobile exchange needs AUTH_MODE=microsoft (use /auth/demo/token in demo mode)")
    from .ms_token import validate_ms_id_token

    try:
        claims = validate_ms_id_token(body.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Microsoft token")
    email = (claims.get("preferred_username") or claims.get("email") or "").strip().lower()
    oid = claims.get("oid")
    db = SessionLocal()
    try:
        user = _find_user(db, oid, email)
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="No active CRM account for this Microsoft user")
        user.ms_oid = user.ms_oid or oid
        user.last_login_at = utcnow()
        db.commit()
        return {"access_token": create_session_token(user.id, user.email, user.role, user.full_name),
                "token_type": "bearer",
                "user": {"email": user.email, "role": user.role, "name": user.full_name}}
    finally:
        db.close()


# ---------- Session ----------
@router.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return JSONResponse({**user, "mode": settings().mode})


@router.get("/auth/logout")
def logout():
    # Only clears OUR session (the crm_session cookie). It does not sign the person out of
    # Microsoft itself, so clicking "Sign in with Microsoft" again may skip straight past the
    # picker — that's fine, since /auth/login already forces prompt=select_account.
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp
