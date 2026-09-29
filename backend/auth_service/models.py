from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    """Current UTC time without timezone info (what the users table stores). Replaces the deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

# Edit this list to match the CRM's `role` table.
ROLES = ["Admin", "Executive", "Team Lead", "Sales Rep"]


class User(Base):
    """
    Who is allowed into the CRM, and with what role.
    Microsoft only proves WHO someone is; this table decides WHAT they can do.
    An Admin must add a person here before they can sign in (no auto-provisioning).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)  # = Microsoft sign-in name
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="Sales Rep")
    ms_oid: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)  # filled on first Microsoft login
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
