from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    """Current UTC time without timezone info (what the user table stores). Replaces the deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

# Edit this list to match the CRM's `role` table.
ROLES = ["Admin", "Executive", "Team Lead", "Sales Rep"]


class User(Base):
    """
    Who is allowed into the CRM, and with what role.
    Microsoft only proves WHO someone is; this table decides WHAT they can do.
    An Admin must add a person here before they can sign in (no auto-provisioning).

    This is the CRM's own `user` table (created/migrated by main.py). The attribute names below
    (email, full_name, created_at) are kept for the auth code; they map to email_id, user_name
    and creation_date.
    """

    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column("email_id", String(320), unique=True, index=True, nullable=False)  # = Microsoft sign-in name
    full_name: Mapped[str] = mapped_column("user_name", String(150), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(150))
    region: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="Sales Rep")
    ms_oid: Mapped[str | None] = mapped_column(String(255), unique=True)  # filled on first Microsoft login
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column("creation_date", DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
