import base64
import hashlib
import json
import time

from cryptography.fernet import Fernet
from fastapi import Request, HTTPException
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from .config import settings

COOKIE_NAME = "crm_session"
FLOW_COOKIE = "crm_login_flow"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings().session_secret, salt="crm-auth-session")


def create_session_token(user_id: int, email: str, role: str, name: str | None = None) -> str:
    """Our own signed pass. Website keeps it in a cookie; mobile app sends it as a Bearer header."""
    payload = {"uid": user_id, "email": email, "role": role, "name": name or email, "iat": int(time.time())}
    return _serializer().dumps(payload)


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request) -> dict:
    """
    For API routes:   user: dict = Depends(get_current_user)
    Works for website (cookie) and mobile app (Bearer header).
    Returns {"uid", "email", "role", "name", "iat"}; otherwise HTTP 401.
    """
    raw = _extract_token(request)
    if not raw:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        payload = _serializer().loads(raw, max_age=settings().session_max_age_seconds)
    except SignatureExpired:
        raise HTTPException(status_code=401, detail="Session expired, please sign in again")
    except BadSignature:
        raise HTTPException(status_code=401, detail="Invalid session")

    # The signed pass only proves who they were at login. The users table decides what they can do NOW,
    # so an Admin who deactivates someone or changes their role takes effect on their very next request.
    from .database import SessionLocal
    from .models import User

    db = SessionLocal()
    try:
        row = db.get(User, payload.get("uid"))
    finally:
        db.close()
    if row is None or not row.is_active:
        raise HTTPException(status_code=401, detail="Your CRM account is not active")
    return {**payload, "email": row.email, "role": row.role, "name": row.full_name or row.email}


def get_current_user_page(request: Request) -> dict:
    """For HTML page routes: sends the browser to /login instead of showing a 401."""
    try:
        return get_current_user(request)
    except HTTPException:
        raise HTTPException(status_code=307, headers={"Location": "/login"})


def require_role(*allowed_roles: str):
    """Limit a route to some roles:  user = Depends(require_role('Admin', 'Executive'))"""
    from fastapi import Depends

    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Your role is not allowed to do this")
        return user

    return checker


# --- encrypted short-lived cookie that carries the Microsoft login state between /auth/login and /auth/callback ---
def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256((settings().session_secret + "|flow").encode()).digest())
    return Fernet(key)


def encrypt_flow(flow: dict) -> str:
    return _fernet().encrypt(json.dumps(flow).encode()).decode()


def decrypt_flow(token: str, max_age: int = 600) -> dict:
    return json.loads(_fernet().decrypt(token.encode(), ttl=max_age))
