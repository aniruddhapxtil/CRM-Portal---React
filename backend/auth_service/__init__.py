"""
DataPhi CRM - Microsoft SSO module.

Add to any FastAPI app (standalone or the CRM):

    from auth_service import setup, get_current_user
    setup(app)                                   # adds the login routes; call init_db() after the `user` table exists

    @app.get("/api/something")
    def something(user: dict = Depends(get_current_user)): ...
"""
from .session import get_current_user, get_current_user_page, require_role  # noqa: F401


def setup(app) -> None:
    from .config import validate_settings
    from .routes import router

    validate_settings()
    app.include_router(router)
