"""Settings for the SSO module. Everything comes from the .env file (or real environment variables)."""
from functools import lru_cache
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


class Settings(BaseSettings):
    # "demo"      = fake Microsoft login for local testing (localhost only)
    # "microsoft" = real Microsoft Entra ID login
    auth_mode: str = "demo"

    # --- Microsoft Entra ID (only needed when AUTH_MODE=microsoft) ---
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    redirect_uri: str = "http://localhost:8010/auth/callback"
    post_logout_redirect_uri: str = "http://localhost:8010/login"

    # --- Session ---
    session_secret: str = "change-me-in-production"
    session_max_age_seconds: int = 8 * 3600
    cookie_secure: bool = False  # set True once the site runs on HTTPS

    # --- Database (same Postgres the CRM uses) ---
    database_url: str = "postgresql+psycopg://voicecrm:voicecrm@localhost:5432/voicecrm"

    # --- Where users go after login. Later: your CRM home, e.g. /page/account ---
    app_landing_url: str = "/welcome"

    # --- Optional: URL of the official DataPhi logo image (replaces the built-in placeholder logo) ---
    logo_url: str = ""

    # extra="ignore" so this module can share a .env file with the CRM without complaining
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def mode(self) -> str:
        return self.auth_mode.strip().lower()


@lru_cache
def settings() -> Settings:
    return Settings()


def validate_settings() -> None:
    """Fail early, with a plain-English message, if the setup is unsafe or incomplete."""
    s = settings()
    if s.mode not in ("demo", "microsoft"):
        raise RuntimeError("AUTH_MODE must be 'demo' or 'microsoft'.")

    if s.mode == "demo":
        host = urlparse(s.redirect_uri).hostname
        if host not in LOCAL_HOSTS:
            raise RuntimeError(
                "AUTH_MODE=demo is only allowed on localhost (anyone could log in as anyone). "
                "Set AUTH_MODE=microsoft for any real server."
            )
        print("\n*** DEMO MODE: fake login, localhost only. Set AUTH_MODE=microsoft for real Microsoft login. ***\n")
        return

    missing = [
        name.upper()
        for name in ("tenant_id", "client_id", "client_secret")
        if not getattr(s, name).strip() or getattr(s, name).startswith("your-")
    ]
    if missing:
        raise RuntimeError(f"AUTH_MODE=microsoft needs these values in .env: {', '.join(missing)}")
    if len(s.session_secret) < 32 or s.session_secret.startswith("change-me"):
        raise RuntimeError(
            "SESSION_SECRET is too weak. Generate one with: "
            'python -c "import secrets; print(secrets.token_hex(32))"'
        )
