"""
DataPhi CRM - Microsoft SSO module.

Add to any FastAPI app (standalone or the CRM):

    from auth_service import setup, get_current_user
    setup(app)                                   # adds the login routes + creates the users table

    @app.get("/api/something")
    def something(user: dict = Depends(get_current_user)): ...
"""
from .session import get_current_user, get_current_user_page, require_role  # noqa: F401


def setup(app) -> None:
    from .config import validate_settings
    from .database import init_db
    from .routes import router

    from sqlalchemy.exc import OperationalError

    validate_settings()
    try:
        init_db()
    except OperationalError as e:
        raise RuntimeError(
            "Cannot reach the database. Is it running? Start it with:  docker compose up -d   "
            f"(details: {e.orig})"
        ) from None
    app.include_router(router)
