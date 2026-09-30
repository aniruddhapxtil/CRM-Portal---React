import asyncio
import io
import json
import mimetypes
import os
import re
import smtplib
import subprocess
import tempfile
import time
import wave
from datetime import date, datetime, timedelta
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import lru_cache
from pathlib import Path

import boto3
import httpx
from botocore.config import Config as BotoConfig
from auth_service import get_current_user, get_current_user_page, require_role
from auth_service import setup as setup_auth
from auth_service.models import ROLES as AUTH_ROLES
from auth_service.database import init_db as init_auth_db
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Boolean,
    Numeric,
    String,
    Text,
    create_engine,
    func,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    selectinload,
    sessionmaker,
)

# =====================================================================
# Configuration & Cloud Settings
# =====================================================================

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://voicecrm:voicecrm@localhost:5432/voicecrm"
    sarvam_api_key: str = ""
    sarvam_stt_model: str = "saaras:v3"
    aws_region: str = "us-east-2"
    bedrock_model_id: str = "us.anthropic.claude-sonnet-5"
    max_audio_mb: int = 50
    cors_origins: str = "http://localhost:5173,http://localhost:8000,http://127.0.0.1:8000"

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = "alerts@dataphi.ai"
    smtp_password: str = "your-app-password"
    enable_notifications: bool = False

    # Absolute path — "env_file='.env'" resolves against the process's CWD, not this file's
    # location, so launching uvicorn from the repo root (rather than backend/) silently
    # skipped backend/.env entirely (only unnoticed until now because DATABASE_URL/CORS_ORIGINS
    # defaults happened to match what's in that file).
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parent / ".env", extra="ignore")

    @property
    def origins(self):
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def settings():
    return Settings()


engine = create_engine(settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# =====================================================================
# Database Models
# =====================================================================

class Role(Base):
    __tablename__ = "role"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email_id: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    designation: Mapped[str | None] = mapped_column(String(150))
    region: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Sign-in fields (used by auth_service; `role` must be one of auth_service.models.ROLES)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="Sales Representative", server_default="Sales Representative")
    ms_oid: Mapped[str | None] = mapped_column(String(255), unique=True)  # filled on first Microsoft login
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)


class AttributesMixin:
    """Ten free-form, reserved columns every entity carries for ad-hoc future data.
    Populated positionally (attribute_1 first) via the 'Add Attribute' UI control."""
    attribute_1: Mapped[str | None] = mapped_column(String(255))
    attribute_2: Mapped[str | None] = mapped_column(String(255))
    attribute_3: Mapped[str | None] = mapped_column(String(255))
    attribute_4: Mapped[str | None] = mapped_column(String(255))
    attribute_5: Mapped[str | None] = mapped_column(String(255))
    attribute_6: Mapped[str | None] = mapped_column(String(255))
    attribute_7: Mapped[str | None] = mapped_column(String(255))
    attribute_8: Mapped[str | None] = mapped_column(String(255))
    attribute_9: Mapped[str | None] = mapped_column(String(255))
    attribute_10: Mapped[str | None] = mapped_column(String(255))


class Account(AttributesMixin, Base):
    __tablename__ = "account"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    account_manager: Mapped[str | None] = mapped_column(String(150))
    region: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    subsidiaries: Mapped[list["Subsidiary"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="account")
    leads: Mapped[list["Lead"]] = relationship(back_populates="account")
    opportunities: Mapped[list["Opportunity"]] = relationship(back_populates="account")
    projects: Mapped[list["Project"]] = relationship(back_populates="account")


class Subsidiary(AttributesMixin, Base):
    __tablename__ = "subsidiary"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("account.id"), nullable=False)
    subsidiary_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    account: Mapped[Account] = relationship(back_populates="subsidiaries")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="subsidiary")


class Contact(AttributesMixin, Base):
    __tablename__ = "contact"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("account.id"), nullable=False)
    subsidiary_id: Mapped[int | None] = mapped_column(ForeignKey("subsidiary.id"), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    designation: Mapped[str | None] = mapped_column(String(150))
    department: Mapped[str | None] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(String(320))
    secondary_email: Mapped[str | None] = mapped_column(String(320))
    mobile_country_code: Mapped[str | None] = mapped_column(String(6), default="+971")
    mobile: Mapped[str | None] = mapped_column(String(10))
    secondary_mobile_country_code: Mapped[str | None] = mapped_column(String(6), default="+971")
    secondary_mobile: Mapped[str | None] = mapped_column(String(10))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    account: Mapped[Account] = relationship(back_populates="contacts")
    subsidiary: Mapped[Subsidiary | None] = relationship(back_populates="contacts")
    leads: Mapped[list["Lead"]] = relationship(back_populates="contact")
    opportunities: Mapped[list["Opportunity"]] = relationship(back_populates="contact")


class Lead(AttributesMixin, Base):
    __tablename__ = "lead"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("account.id"), nullable=False)
    subsidiary_id: Mapped[int | None] = mapped_column(ForeignKey("subsidiary.id"), nullable=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contact.id"), nullable=True)
    account_manager: Mapped[str | None] = mapped_column(String(150))
    deal_size: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    currency: Mapped[str | None] = mapped_column(String(10), default="AED")
    project_type: Mapped[str | None] = mapped_column(String(50), default="T&M")
    referred_by: Mapped[str | None] = mapped_column(String(150))
    service_line: Mapped[str | None] = mapped_column(String(255))
    type: Mapped[str | None] = mapped_column(String(50), default="Warm")
    stage: Mapped[str | None] = mapped_column(String(50), default="Non-Qualified")
    disqualification_reason: Mapped[str | None] = mapped_column(String(255))
    lead_source: Mapped[str | None] = mapped_column(String(150), default="Voice Capture")
    campaign_name: Mapped[str | None] = mapped_column(String(255))
    technology: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    next_steps: Mapped[str | None] = mapped_column(String(255))
    next_action_date: Mapped[date | None] = mapped_column(Date)
    closure_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    account: Mapped[Account] = relationship(back_populates="leads")
    contact: Mapped[Contact | None] = relationship(back_populates="leads")
    opportunities: Mapped[list["Opportunity"]] = relationship(back_populates="lead")


class Opportunity(AttributesMixin, Base):
    __tablename__ = "opportunity"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    opportunity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("lead.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("account.id"), nullable=False)
    subsidiary_id: Mapped[int | None] = mapped_column(ForeignKey("subsidiary.id"), nullable=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contact.id"), nullable=True)
    account_manager: Mapped[str | None] = mapped_column(String(150))
    deal_size: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    currency: Mapped[str | None] = mapped_column(String(10), default="AED")
    project_type: Mapped[str | None] = mapped_column(String(50), default="T&M")
    referred_by: Mapped[str | None] = mapped_column(String(150))
    service_line: Mapped[str | None] = mapped_column(String(255))
    stage: Mapped[str] = mapped_column(String(50), default="Discovery — 40%")
    probability: Mapped[int | None] = mapped_column(Integer, default=40)
    reason: Mapped[str | None] = mapped_column(String(255))
    opportunity_type: Mapped[str | None] = mapped_column(String(100), default="New")
    funded_by: Mapped[str | None] = mapped_column(String(100))
    opportunity_source: Mapped[str | None] = mapped_column(String(150))
    next_steps: Mapped[str | None] = mapped_column(String(255))
    next_action_date: Mapped[date | None] = mapped_column(Date)
    closure_date: Mapped[date | None] = mapped_column(Date)
    expected_closure_date: Mapped[date | None] = mapped_column(Date)
    technology: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    account: Mapped[Account] = relationship(back_populates="opportunities")
    contact: Mapped[Contact | None] = relationship(back_populates="opportunities")
    lead: Mapped[Lead | None] = relationship(back_populates="opportunities")
    project: Mapped["Project | None"] = relationship(back_populates="opportunity")


class Project(AttributesMixin, Base):
    __tablename__ = "project"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunity.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("account.id"), nullable=False)
    subsidiary_id: Mapped[int | None] = mapped_column(ForeignKey("subsidiary.id"), nullable=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contact.id"), nullable=True)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="Awaited")
    po_number: Mapped[str | None] = mapped_column(String(150))
    po_reason: Mapped[str | None] = mapped_column(String(255))
    po_document_s3_key: Mapped[str | None] = mapped_column(String(500))
    po_document_name: Mapped[str | None] = mapped_column(String(255))
    po_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    currency: Mapped[str | None] = mapped_column(String(10), default="AED")
    start_date: Mapped[date | None] = mapped_column(Date)
    close_date: Mapped[date | None] = mapped_column(Date)
    technology: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    account: Mapped[Account] = relationship(back_populates="projects")
    opportunity: Mapped[Opportunity] = relationship(back_populates="project")


class Activity(AttributesMixin, Base):
    __tablename__ = "activity"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    activity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[int | None] = mapped_column(ForeignKey("account.id"), nullable=True)
    subsidiary_id: Mapped[int | None] = mapped_column(ForeignKey("subsidiary.id"), nullable=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("contact.id"), nullable=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("lead.id"), nullable=True)
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("opportunity.id"), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("project.id"), nullable=True)
    record_type: Mapped[str | None] = mapped_column(String(50))
    record_action: Mapped[str | None] = mapped_column(String(50))
    account_name: Mapped[str | None] = mapped_column(String(255))
    contact_name: Mapped[str | None] = mapped_column(String(255))
    subsidiary_name: Mapped[str | None] = mapped_column(String(255))
    activity_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text)
    next_step: Mapped[str | None] = mapped_column(String(255))
    next_action_date: Mapped[date | None] = mapped_column(Date)
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)


class QualificationRequest(Base):
    __tablename__ = "qualification_request"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "lead_qualification" | "opportunity_qualification"
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("lead.id"), nullable=True)
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("opportunity.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending", server_default="Pending")
    requested_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    requested_by_name: Mapped[str | None] = mapped_column(String(150))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result_opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("opportunity.id"), nullable=True)
    result_project_id: Mapped[int | None] = mapped_column(ForeignKey("project.id"), nullable=True)


class VoiceDraft(Base):
    __tablename__ = "voice_draft"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(320))
    user_phone: Mapped[str | None] = mapped_column(String(50))
    raw_transcript: Mapped[str] = mapped_column(Text, nullable=False)
    target_entity: Mapped[str] = mapped_column(String(50), default="lead")
    extracted_json: Mapped[str] = mapped_column(Text, nullable=False)
    missing_fields: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    clarification_prompt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="INCOMPLETE")
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_update_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VoiceInteraction(Base):
    __tablename__ = "voice_interactions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transcript: Mapped[str] = mapped_column(Text)
    intent: Mapped[str | None] = mapped_column(String(100))
    extracted_json: Mapped[str] = mapped_column(Text)
    processing_ms: Mapped[int | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(50))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =====================================================================
# Parsing, Sanitation & Normalization Helpers
# =====================================================================

def resolve_relative_date(v) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    if not isinstance(v, str):
        return None

    cleaned = v.strip()
    if not cleaned or cleaned.lower() in ("null", "none"):
        return None

    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        pass

    lower = cleaned.lower()
    today = date.today()

    if "tomorrow" in lower:
        return today + timedelta(days=1)
    if "today" in lower:
        return today

    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for idx, day in enumerate(days):
        if day in lower:
            current_day = today.weekday()
            days_ahead = (idx - current_day) % 7
            if days_ahead == 0 or "next" in lower:
                days_ahead += 7
            return today + timedelta(days=days_ahead)

    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%b %d, %Y", "%d %b %Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    return None


def sanitize_numeric_deal_size(v) -> Decimal | None:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float, Decimal)):
        try:
            return Decimal(str(v))
        except Exception:
            return None
    if isinstance(v, str):
        cleaned = re.sub(r"[^\d.]", "", v)
        if cleaned:
            try:
                return Decimal(cleaned)
            except Exception:
                return None
    return None


def as_list(val: str | None) -> list[str]:
    return [val] if val else []


def unpack_attributes(values: list[str] | None) -> dict:
    """Maps a positional list onto attribute_1..attribute_10 for assignment onto a model instance."""
    values = (values or [])[:10]
    return {f"attribute_{i + 1}": (values[i].strip() if i < len(values) and values[i] and values[i].strip() else None) for i in range(10)}


def pack_attributes(obj) -> list[str]:
    """Reads attribute_1..attribute_10 off a model instance back into a compact positional list."""
    result = []
    for i in range(1, 11):
        v = getattr(obj, f"attribute_{i}", None)
        if v:
            result.append(v)
    return result


def apply_attributes(obj, values: list[str] | None):
    for k, v in unpack_attributes(values).items():
        setattr(obj, k, v)


def log_system_activity(
    db,
    *,
    action: str,
    user_id: int | None,
    account_id: int | None = None,
    subsidiary_id: int | None = None,
    contact_id: int | None = None,
    lead_id: int | None = None,
    opportunity_id: int | None = None,
    project_id: int | None = None,
) -> None:
    """Invisible audit trail: record_type='System Generated' is never offered as a selectable
    option in the Activity form and is excluded from /api/activities/overview — it exists purely
    for the backend database. Added to the same session, not committed separately, so it rides in
    the caller's existing transaction."""
    db.add(Activity(
        activity_name=action[:255],
        record_type="System Generated",
        record_action=action[:50],  # record_action is VARCHAR(50); the full text lives in activity_name
        account_id=account_id,
        subsidiary_id=subsidiary_id,
        contact_id=contact_id,
        lead_id=lead_id,
        opportunity_id=opportunity_id,
        project_id=project_id,
        created_by=user_id,
    ))


def stamp_audit(obj, user_id: int | None, is_new: bool) -> None:
    """Fills created_by (new rows only) and updated_by (every write) for tables that carry them."""
    if is_new and hasattr(obj, "created_by"):
        obj.created_by = user_id
    if hasattr(obj, "updated_by"):
        obj.updated_by = user_id


def require_write_access(user: dict) -> None:
    """Executive is a read-only role — full visibility, zero create/edit rights anywhere."""
    if user["role"] == "Executive":
        raise HTTPException(403, "The Executive role is read-only.")


SERVICE_LINE_DELIM = "|"


def service_line_to_str(values: list[str] | None) -> str | None:
    """Lead/Opportunity service_line is a single varchar column (per DBML), but the UI
    keeps a multi-select checkbox widget — serialize the selection into that one column.
    Pipe-delimited (not comma) because one option value ("PhAI - GenAI, AI and ML")
    contains a literal comma."""
    cleaned = [v.strip() for v in (values or []) if v and v.strip()]
    return SERVICE_LINE_DELIM.join(cleaned) if cleaned else None


def service_line_to_list(value: str | None) -> list[str]:
    return [v for v in (value or "").split(SERVICE_LINE_DELIM) if v]


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_email_format(v: str | None) -> str | None:
    if v is None:
        return None
    cleaned = v.strip()
    if not cleaned:
        return None
    if not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format.")
    return cleaned


def validate_phone_digits(v: str | None) -> str | None:
    if v is None:
        return None
    cleaned = re.sub(r"\D", "", v)
    if not cleaned:
        return None
    if len(cleaned) > 10:
        raise ValueError("Phone number must be at most 10 digits.")
    return cleaned


def sanitize_value(val: str | None) -> str | None:
    if not val:
        return None
    cleaned = val.strip()

    dummy_patterns = [
        r"^(enterprise\s+)?company(\s+name)?$",
        r"^john\s+doe$",
        r"^jane\s+doe$",
        r"^client(\s+stakeholder)?$",
        r"^sales\s+rep(resentative)?$",
        r"^not\s+specified$",
        r"^unknown$",
        r"^n/a$",
        r"^none$",
        r"^null$",
        r"^region\s+not\s+specified$",
        r"^industry\s+not\s+specified$",
        r"^account\s+manager\s+not\s+specified$",
        r"^.*@example\.com$",
        r"^.*@mobile\.com$",
    ]

    for pattern in dummy_patterns:
        if re.match(pattern, cleaned, re.IGNORECASE):
            return None

    return cleaned


def deterministic_transcript_fallback(payload, transcript: str):
    if not payload.account.account_manager:
        match = re.search(
            r"account\s+manager\s+(?:for\s+(?:this\s+)?account\s+)?(?:is\s+)?([A-Za-z\s,\.]+?)(?:,|\.|\boperating\b|\bunder\b|\bwith\b|\bnext\b|$)",
            transcript,
            re.IGNORECASE,
        )
        if match:
            extracted_am = match.group(1).strip().strip(",.")
            if len(extracted_am.split()) <= 4:
                payload.account.account_manager = extracted_am

    if not payload.account.region:
        reg_match = re.search(r"\b(dubai|abu\s+dhabi|sharjah|ksa|riyadh|qatar|gcc)\b", transcript, re.IGNORECASE)
        if reg_match:
            payload.account.region = reg_match.group(1).title()
        elif re.search(r"\bthe\s+by\s+region\b", transcript, re.I):
            payload.account.region = "Dubai"

    if not payload.account.industry:
        ind_match = re.search(r"(?:under|in)\s+(?:a\s+)?([A-Za-z\s]+?)\s+industry", transcript, re.IGNORECASE)
        if ind_match:
            payload.account.industry = ind_match.group(1).strip().title()

    if payload.contact.contact_name and not payload.contact.designation:
        desig_match = re.search(
            r"(?:who\s+is\s+(?:the\s+)?|designation\s+(?:is\s+)?)([A-Za-z\s]+?)(?:\.|\bthe\s+scope\b|\bscope\b|\bwith\b|\band\b|$)",
            transcript,
            re.IGNORECASE,
        )
        if desig_match:
            payload.contact.designation = desig_match.group(1).strip()

    if not payload.lead.next_steps:
        next_step_match = re.search(r"next\s+step\s+is\s+([^.]+)", transcript, re.IGNORECASE)
        if next_step_match:
            extracted_step = next_step_match.group(1).strip()
            payload.lead.next_steps = extracted_step
            if payload.opportunity:
                payload.opportunity.next_steps = extracted_step


def evaluate_mandatory_fields(payload, transcript: str) -> tuple[list[str], str]:
    missing = []
    questions = []

    if re.search(r"\b(create|add|new)\s+(an?\s+)?(opportunity|deal|opty)\b", transcript, re.I):
        payload.intent = "create_opportunity"
    elif re.search(r"\b(create|add|new)\s+(an?\s+)?account\b", transcript, re.I):
        payload.intent = "create_account"
    elif re.search(r"\b(create|add|new)\s+(an?\s+)?contact\b", transcript, re.I):
        payload.intent = "create_contact"

    payload.account.account_name = sanitize_value(payload.account.account_name)
    payload.account.account_manager = sanitize_value(payload.account.account_manager)
    payload.contact.contact_name = sanitize_value(payload.contact.contact_name)
    payload.contact.email = sanitize_value(payload.contact.email)
    payload.contact.mobile = sanitize_value(payload.contact.mobile)

    if payload.intent == "create_account":
        if not payload.account.account_name:
            missing.append("account.account_name")
            questions.append("What is the company or enterprise organization name for this new account?")
        return missing, " ".join(questions)

    if payload.intent == "create_contact":
        if not payload.account.account_name:
            missing.append("account.account_name")
            questions.append("Which enterprise company does this contact stakeholder belong to?")
        if not payload.contact.contact_name:
            missing.append("contact.contact_name")
            questions.append("What is the full name of the contact stakeholder?")
        return missing, " ".join(questions)

    if payload.intent == "create_opportunity":
        if not payload.account.account_name:
            missing.append("account.account_name")
            questions.append("Which enterprise account is this opportunity being proposed to?")
        if not payload.contact.contact_name:
            missing.append("contact.contact_name")
            questions.append("Who is the client commercial decision maker or primary stakeholder?")
        return missing, " ".join(questions)

    if (
        payload.account.account_name
        and payload.contact.contact_name
        and payload.account.account_name.strip().lower() == payload.contact.contact_name.strip().lower()
    ):
        payload.account.account_name = None

    if not payload.account.account_name:
        missing.append("account.account_name")
        questions.append("Which company or enterprise account is this discussion for?")

    if not payload.contact.contact_name:
        missing.append("contact.contact_name")
        questions.append("Who was the client stakeholder or decision maker you spoke with?")

    return missing, " ".join(questions)


def send_notification_alert(recipient_email: str | None, phone: str | None, draft_id: int, summary: str, questions: str):
    if not settings().enable_notifications or not recipient_email:
        print(f"\n[DRAFT NOTIFICATION - DRAFT #{draft_id}]")
        print(f"To: {recipient_email or 'Rep Phone: ' + str(phone)}")
        print(f"Captured: {summary}")
        print(f"Missing Questions: {questions}\n")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = settings().smtp_user
        msg["To"] = recipient_email
        msg["Subject"] = f"Action Required: Incomplete CRM Voice Note (Draft #{draft_id})"

        body = (
            f"Hi,\n\n"
            f"You recorded a voice memo, but some required fields are missing:\n\n"
            f"Captured Context:\n\"{summary}\"\n\n"
            f"Please reply or open the portal to complete the following:\n"
            f"{questions}\n\n"
            f"Portal Link: http://localhost:8000/page/voice?draft_id={draft_id}\n\n"
            f"— DataPhi CRM"
        )
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings().smtp_host, settings().smtp_port) as server:
            server.starttls()
            server.login(settings().smtp_user, settings().smtp_password)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to dispatch email alert: {e}")


# =====================================================================
# Pydantic Schemas for AI Entity Extraction
# =====================================================================

class ExtractedAccount(BaseModel):
    account_name: str | None = None
    account_manager: str | None = None
    region: str | None = None
    industry: str | None = None


class ExtractedSubsidiary(BaseModel):
    subsidiary_name: str | None = None
    region: str | None = None
    industry: str | None = None


class ExtractedContact(BaseModel):
    contact_name: str | None = None
    designation: str | None = None
    email: str | None = None
    mobile: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class ExtractedLead(BaseModel):
    lead_name: str | None = None
    deal_size: Decimal | None = Field(default=None, ge=0)
    currency: str | None = "AED"
    type: str | None = "Warm"
    stage: str | None = "Non-Qualified"
    lead_source: str | None = "Voice Note"
    service: str | None = None
    technology: str | None = None
    next_steps: str | None = None
    next_action_date: date | None = None
    closure_date: date | None = None
    notes: str | None = None

    @field_validator("deal_size", mode="before")
    @classmethod
    def clean_deal_size(cls, v):
        return sanitize_numeric_deal_size(v)

    @field_validator("next_action_date", "closure_date", mode="before")
    @classmethod
    def clean_date_fields(cls, v):
        return resolve_relative_date(v)


class ExtractedOpportunity(BaseModel):
    opportunity_name: str | None = None
    deal_size: Decimal | None = Field(default=None, ge=0)
    currency: str | None = "AED"
    project_type: str | None = "T&M"
    service: str | None = None
    stage: str | None = "Discovery — 40%"
    probability: int | None = 40
    technology: str | None = None
    next_steps: str | None = None
    next_action_date: date | None = None
    closure_date: date | None = None
    notes: str | None = None

    @field_validator("deal_size", mode="before")
    @classmethod
    def clean_deal_size(cls, v):
        return sanitize_numeric_deal_size(v)

    @field_validator("next_action_date", "closure_date", mode="before")
    @classmethod
    def clean_date_fields(cls, v):
        return resolve_relative_date(v)


class FullLifecycleVoicePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    intent: str = "create_lead"
    account: ExtractedAccount = Field(default_factory=ExtractedAccount)
    subsidiary: ExtractedSubsidiary = Field(default_factory=ExtractedSubsidiary)
    contact: ExtractedContact = Field(default_factory=ExtractedContact)
    lead: ExtractedLead = Field(default_factory=ExtractedLead)
    opportunity: ExtractedOpportunity = Field(default_factory=ExtractedOpportunity)

    @field_validator("account", "subsidiary", "contact", "lead", "opportunity", mode="before")
    @classmethod
    def coerce_null_to_empty_dict(cls, v):
        return {} if (v is None or not isinstance(v, dict)) else v


class ConfirmedCommitPayload(BaseModel):
    draft_id: int | None = None
    intent: str = "create_lead"
    user_id: int | None = None
    account: ExtractedAccount = Field(default_factory=ExtractedAccount)
    subsidiary: ExtractedSubsidiary = Field(default_factory=ExtractedSubsidiary)
    contact: ExtractedContact = Field(default_factory=ExtractedContact)
    lead: ExtractedLead = Field(default_factory=ExtractedLead)
    opportunity: ExtractedOpportunity = Field(default_factory=ExtractedOpportunity)

    @field_validator("account", "subsidiary", "contact", "lead", "opportunity", mode="before")
    @classmethod
    def coerce_null_to_empty_dict(cls, v):
        return {} if (v is None or not isinstance(v, dict)) else v


# =====================================================================
# Manual Form Pydantic Schemas
# =====================================================================

class AccountFormIn(BaseModel):
    account_id: int | None = None
    account_name: str
    account_manager: str | None = None
    region: str | None = None
    industry: str | None = None
    website: str | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)


class SubsidiaryFormIn(BaseModel):
    subsidiary_id: int | None = None
    account_id: int
    subsidiary_name: str
    region: str | None = None
    industry: str | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)


class ContactFormIn(BaseModel):
    contact_id: int | None = None
    account_id: int
    subsidiary_id: int | None = None
    contact_name: str
    designation: str | None = None
    department: str | None = None
    linkedin_url: str | None = None
    email: str | None = None
    secondary_email: str | None = None
    mobile_country_code: str | None = "+971"
    mobile: str | None = None
    secondary_mobile_country_code: str | None = "+971"
    secondary_mobile: str | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)

    @field_validator("email", "secondary_email", mode="before")
    @classmethod
    def check_email(cls, v):
        return validate_email_format(v)

    @field_validator("mobile", "secondary_mobile", mode="before")
    @classmethod
    def check_phone(cls, v):
        return validate_phone_digits(v)


class LeadFormIn(BaseModel):
    lead_id: int | None = None
    account_id: int
    subsidiary_id: int | None = None
    contact_id: int
    lead_name: str
    account_manager: str | None = None
    deal_size: Decimal | None = None
    currency: str | None = "AED"
    project_type: str | None = "T&M"
    referred_by: str | None = None
    service_line: list[str] = Field(default_factory=list)
    stage: str | None = "Qualified"
    disqualification_reason: str | None = None
    type: str | None = "Warm"
    lead_source: str | None = None
    campaign_name: str | None = None
    technology: list[str] = Field(default_factory=list)
    next_steps: str | None = None
    next_action_date: date | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)

    @field_validator("deal_size", mode="before")
    @classmethod
    def parse_deal(cls, v):
        return sanitize_numeric_deal_size(v)

    @field_validator("next_action_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        return resolve_relative_date(v)


class OpportunityFormIn(BaseModel):
    opportunity_id: int | None = None
    lead_id: int | None = None
    account_id: int
    subsidiary_id: int | None = None
    contact_id: int
    opportunity_name: str
    account_manager: str | None = None
    deal_size: Decimal | None = None
    currency: str | None = "AED"
    project_type: str | None = "Fixed Cost"
    referred_by: str | None = None
    service_line: list[str] = Field(default_factory=list)
    technology: list[str] = Field(default_factory=list)
    stage: str
    probability: int = 60
    reason: str | None = None
    opportunity_type: str | None = "New"
    funded_by: str | None = "Client"
    opportunity_source: str | None = None
    next_steps: str | None = None
    next_action_date: date | None = None
    expected_closure_date: date | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)

    @field_validator("deal_size", mode="before")
    @classmethod
    def parse_deal(cls, v):
        return sanitize_numeric_deal_size(v)

    @field_validator("next_action_date", "expected_closure_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        return resolve_relative_date(v)


class ProjectFormIn(BaseModel):
    project_id: int | None = None
    opportunity_id: int
    account_id: int
    subsidiary_id: int | None = None
    contact_id: int
    project_name: str
    technology: list[str] = Field(default_factory=list)
    value: Decimal | None = None
    currency: str | None = "AED"
    start_date: date | None = None
    close_date: date | None = None
    po_status: str | None = "Awaited"
    po_number: str | None = None
    po_reason: str | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)

    @field_validator("value", mode="before")
    @classmethod
    def parse_val(cls, v):
        return sanitize_numeric_deal_size(v)

    @field_validator("start_date", "close_date", mode="before")
    @classmethod
    def parse_dates(cls, v):
        return resolve_relative_date(v)


class ActivityFormIn(BaseModel):
    activity_id: int | None = None
    activity_name: str
    record_type: str
    linked_record_id: int
    contact_id: int | None = None
    record_action: str
    activity_date: str | None = None
    next_step: str | None = None
    next_action_date: str | None = None
    notes: str | None = None
    attributes: list[str] = Field(default_factory=list)


class UserFormIn(BaseModel):
    """Admin-only. Creates/updates a row in the `user` table, which is also what SSO sign-in
    uses. `role` must be one of auth_service.models.ROLES, since that's what gates access."""
    user_id: int | None = None
    user_name: str
    email_id: str
    designation: str | None = None
    region: str | None = None
    phone: str | None = None
    role: str

    @field_validator("role")
    @classmethod
    def role_must_be_known(cls, v: str) -> str:
        if v not in AUTH_ROLES:
            raise ValueError(f"role must be one of: {', '.join(AUTH_ROLES)}")
        return v


# =====================================================================
# AI System Prompt with Few-Shot Examples & Escape Hatch
# =====================================================================

SYSTEM_PROMPT = """### ROLE & CONTEXT
You are the DataPhi CRM Enterprise Intelligence & Entity Extraction Engine.
Your duty is to transform spoken sales notes, meeting transcripts, and partner calls into complete, valid JSON adhering to our multi-entity relational CRM structure.

### STRICT ESCAPE HATCH & EXTRACTION RULES:
1. MAXIMIZE CAPTURE ACCURACY:
   - "account manager is [Name]" -> account.account_manager
   - "operating in [Region]" or "located in [Region]" -> account.region
   - "industry is [Industry]" or "under [Industry]" -> account.industry
   - "[Name], who is [Title]" -> contact.contact_name, contact.designation
   - "next step is [Action]" -> lead.next_steps, opportunity.next_steps
2. NOTES CONSTRAINT: Keep "notes" null or under 6 words. NEVER copy, repeat, or echo the raw spoken transcript back into any notes field.
3. OPPORTUNITY TO LEAD BACKFILLING: When intent is "create_opportunity", always populate BOTH opportunity and lead objects with identical deal scope, and populate account metadata.
4. ZERO HALLUCINATION / ESCAPE HATCH: If a parameter is NOT spoken, return null. Never invent dummy data like 'John Doe', 'Company Name', or arbitrary numerical figures. Output valid JSON only, without Markdown prose.

### SCHEMA (JSON ONLY)
{
  "intent": "create_opportunity" | "create_lead" | "create_account" | "create_contact",
  "account": {"account_name": null, "region": null, "industry": null, "account_manager": null},
  "subsidiary": {"subsidiary_name": null},
  "contact": {"contact_name": null, "designation": null, "email": null, "mobile": null, "notes": null},
  "lead": {"lead_name": null, "deal_size": null, "currency": "AED", "type": "Hot", "service": null, "technology": null, "next_steps": null, "next_action_date": null, "closure_date": null, "notes": null},
  "opportunity": {"opportunity_name": null, "deal_size": null, "currency": "AED", "project_type": "T&M", "service": null, "stage": "Discovery (40%)", "probability": 40, "technology": null, "next_steps": null, "notes": null}
}

### FEW-SHOT EXAMPLES

#### Example 1: Direct Enterprise Opportunity (UAE Region)
Transcript: "Create an opportunity for Dubai Integrated Economic Zones for 450,000 AED on Azure Databricks with Tariq Mansoor, VP of Smart Cities. The scope is IoT Telemetry Lakehouse under T&M. Account manager is Ramanj Falasi, operating in Dubai region under Semi Govt industry. Next step is architecture deck."
Output:
{
  "intent": "create_opportunity",
  "account": {"account_name": "Dubai Integrated Economic Zones", "region": "Dubai", "industry": "Semi Govt", "account_manager": "Ramanj Falasi"},
  "subsidiary": null,
  "contact": {"contact_name": "Tariq Mansoor", "designation": "VP of Smart Cities", "email": null, "mobile": null, "notes": null},
  "lead": {"lead_name": "IoT Telemetry Lakehouse", "deal_size": 450000, "currency": "AED", "type": "Hot", "service": "IoT Telemetry Lakehouse", "technology": "Azure Databricks", "next_steps": "Architecture deck", "next_action_date": null, "closure_date": null, "notes": null},
  "opportunity": {"opportunity_name": "IoT Telemetry Lakehouse", "deal_size": 450000, "currency": "AED", "project_type": "T&M", "service": "IoT Telemetry Lakehouse", "stage": "Discovery (40%)", "probability": 40, "technology": "Azure Databricks", "next_steps": "Architecture deck", "notes": null}
}

#### Example 2: Incomplete Lead (Escape Hatch Demonstration)
Transcript: "Spoke with Budur at DAS yesterday regarding their migration. No budget finalized yet, but schedule demo next Wednesday."
Output:
{
  "intent": "create_lead",
  "account": {"account_name": "DAS", "region": null, "industry": null, "account_manager": null},
  "subsidiary": null,
  "contact": {"contact_name": "Budur", "designation": null, "email": null, "mobile": null, "notes": null},
  "lead": {"lead_name": "DAS - Cloud Migration", "deal_size": null, "currency": "AED", "type": "Warm", "service": "Cloud Migration", "technology": null, "next_steps": "Schedule demo", "next_action_date": null, "closure_date": null, "notes": null},
  "opportunity": null
}
"""

def parse_json(text: str):
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.I)
    text = re.sub(r"\s*```$", "", text)

    a = text.find("{")
    if a < 0:
        raise ValueError("No JSON structure found in model output.")
    text = text[a:]

    text = re.sub(r"\bNone\b", "null", text)
    text = re.sub(r"\bTrue\b", "true", text)
    text = re.sub(r"\bFalse\b", "false", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    quotes = len(re.findall(r'(?<!\\)"', text))
    if quotes % 2 != 0:
        text += '"'

    text = re.sub(r',\s*$', '', text)
    text = re.sub(r',\s*"\w+":\s*"?$', '', text)

    open_braces = text.count("{")
    close_braces = text.count("}")
    if open_braces > close_braces:
        text += "}" * (open_braces - close_braces)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        cleaned = re.sub(r",\s*([}\]])", r"\1", text)
        return json.loads(cleaned)


# =====================================================================
# Sarvam AI Speech-to-Text Implementation (Saaras)
# =====================================================================

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_STT_JOB_URL = "https://api.sarvam.ai/speech-to-text/job/v1"

# Sarvam's synchronous /speech-to-text endpoint hard-caps at 30s of audio ("Audio duration
# exceeds the maximum limit of 30 seconds. Please use the batch API for longer audio files."
# is the literal error). Stay under that with a safety margin rather than eating a doomed
# call; anything longer transparently goes through the async batch-job flow instead.
SARVAM_SHORT_CLIP_MAX_SECONDS = 28.0
SARVAM_BATCH_POLL_INTERVAL_SECONDS = 3.0
SARVAM_BATCH_POLL_MAX_ATTEMPTS = 60  # ~3 minutes — batch jobs for 1-2 minute clips finish in seconds in practice


def _decode_utf8_json(response: httpx.Response):
    """Sarvam's JSON responses come back without an explicit charset on the
    Content-Type header; httpx's own encoding-guess can then mis-decode
    multi-byte UTF-8 characters (e.g. em-dashes) as Latin-1, producing mojibake.
    JSON is UTF-8 by spec (RFC 8259) — decode explicitly instead of guessing."""
    return json.loads(response.content.decode("utf-8"))


class SarvamSTTService:
    """Transcription via Sarvam's Saaras models. Short clips go through the simple
    synchronous REST endpoint; clips over Sarvam's 30-second cap on that endpoint are
    transparently routed through their async batch-job flow (initiate -> upload ->
    start -> poll -> download), reverse-engineered against the live API since Sarvam's
    own docs don't spell out the exact request/response shapes for it."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def transcribe(self, wav_bytes: bytes, duration_sec: float) -> str:
        if duration_sec <= SARVAM_SHORT_CLIP_MAX_SECONDS:
            return await self._transcribe_short(wav_bytes)
        return await self._transcribe_batch(wav_bytes)

    async def _transcribe_short(self, wav_bytes: bytes) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                SARVAM_STT_URL,
                headers={"api-subscription-key": self.api_key},
                files={"file": ("audio.wav", wav_bytes, "audio/wav")},
                data={"model": self.model, "language_code": "unknown"},
            )
        if response.status_code >= 400:
            raise ValueError(f"Sarvam STT request failed ({response.status_code}): {response.content.decode('utf-8', errors='replace')}")

        transcript = (_decode_utf8_json(response).get("transcript") or "").strip()
        if not transcript:
            raise ValueError("Sarvam STT completed, but detected no speech in the recording.")
        return transcript

    async def _transcribe_batch(self, wav_bytes: bytes) -> str:
        headers = {"api-subscription-key": self.api_key, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                SARVAM_STT_JOB_URL,
                headers=headers,
                json={
                    "job_parameters": {
                        "language_code": "unknown",
                        "model": self.model,
                        "mode": "transcribe",
                        "with_timestamps": False,
                    }
                },
            )
            if resp.status_code >= 400:
                raise ValueError(f"Sarvam STT batch job initiation failed ({resp.status_code}): {resp.content.decode('utf-8', errors='replace')}")
            job_id = _decode_utf8_json(resp)["job_id"]

            resp = await client.post(
                f"{SARVAM_STT_JOB_URL}/upload-files",
                headers=headers,
                json={"job_id": job_id, "files": ["audio.wav"]},
            )
            if resp.status_code >= 400:
                raise ValueError(f"Sarvam STT batch upload-URL request failed ({resp.status_code}): {resp.content.decode('utf-8', errors='replace')}")
            upload_url = _decode_utf8_json(resp)["upload_urls"]["audio.wav"]["file_url"]

            # The presigned URL is Azure Blob Storage, not the Sarvam API itself — no auth header, just the blob-type header.
            resp = await client.put(
                upload_url,
                headers={"x-ms-blob-type": "BlockBlob", "Content-Type": "audio/wav"},
                content=wav_bytes,
            )
            if resp.status_code >= 300:
                raise ValueError(f"Sarvam STT batch audio upload failed ({resp.status_code}).")

            resp = await client.post(f"{SARVAM_STT_JOB_URL}/{job_id}/start", headers=headers)
            if resp.status_code >= 400:
                raise ValueError(f"Sarvam STT batch job start failed ({resp.status_code}): {resp.content.decode('utf-8', errors='replace')}")

            status_data = None
            for _ in range(SARVAM_BATCH_POLL_MAX_ATTEMPTS):
                await asyncio.sleep(SARVAM_BATCH_POLL_INTERVAL_SECONDS)
                resp = await client.get(f"{SARVAM_STT_JOB_URL}/{job_id}/status", headers=headers)
                if resp.status_code >= 400:
                    raise ValueError(f"Sarvam STT batch status check failed ({resp.status_code}): {resp.content.decode('utf-8', errors='replace')}")
                status_data = _decode_utf8_json(resp)
                state = status_data.get("job_state")
                if state == "Completed":
                    break
                if state == "Failed":
                    raise ValueError(f"Sarvam STT batch job failed: {status_data.get('error_message') or 'unknown error'}")
            else:
                raise ValueError("Sarvam STT batch job timed out waiting for completion.")

            output_files = [
                o["file_name"] for d in status_data.get("job_details", []) for o in d.get("outputs", [])
            ]
            if not output_files:
                raise ValueError("Sarvam STT batch job completed but produced no output file.")

            resp = await client.post(
                f"{SARVAM_STT_JOB_URL}/download-files",
                headers=headers,
                json={"job_id": job_id, "files": output_files},
            )
            if resp.status_code >= 400:
                raise ValueError(f"Sarvam STT batch download-URL request failed ({resp.status_code}): {resp.content.decode('utf-8', errors='replace')}")
            download_url = _decode_utf8_json(resp)["download_urls"][output_files[0]]["file_url"]

            resp = await client.get(download_url)
            if resp.status_code >= 400:
                raise ValueError(f"Sarvam STT batch transcript download failed ({resp.status_code}).")
            transcript = (_decode_utf8_json(resp).get("transcript") or "").strip()

        if not transcript:
            raise ValueError("Sarvam STT batch job completed, but detected no speech in the recording.")
        return transcript


# =====================================================================
# AWS Bedrock Claude Sonnet 5 Implementation
# =====================================================================

class AWSBedrockService:
    """Structured-extraction LLM call via AWS Bedrock's Converse API — swapped back in
    for Sarvam-105B, whose reasoning-model overhead (~15s/call) was too slow for this
    step. Sarvam stays on STT only, which doesn't have that latency problem. Relies on
    the default boto3 credential chain (same as before Sarvam was introduced)."""

    def __init__(self, region: str, model_id: str):
        self.region = region
        self.model_id = model_id
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=BotoConfig(read_timeout=120, connect_timeout=10),
        )

    async def extract(self, transcript: str):
        # boto3 has no native async client — run the blocking call off the event loop thread.
        return await asyncio.to_thread(self._extract_sync, transcript)

    def _extract_sync(self, transcript: str):
        response = self.client.converse(
            modelId=self.model_id,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "text": f"Reference date: {date.today().isoformat()}\nTranscript: {transcript}\nOutput JSON strictly according to instructions:"
                        }
                    ],
                }
            ],
            system=[{"text": SYSTEM_PROMPT}],
            inferenceConfig={"maxTokens": 4096},
        )

        # Safely extract text across all content blocks (handles reasoningContent blocks)
        content_blocks = response.get("output", {}).get("message", {}).get("content", [])
        raw_text = ""
        for block in content_blocks:
            if isinstance(block, dict) and "text" in block:
                raw_text += block["text"]

        # Fallback: if no direct text block was returned, check reasoningContent
        if not raw_text:
            for block in content_blocks:
                if isinstance(block, dict) and "reasoningContent" in block:
                    raw_text += block.get("reasoningContent", {}).get("reasoningText", {}).get("text", "")

        if not raw_text:
            stop_reason = response.get("stopReason", "unknown")
            raise ValueError(f"Bedrock returned no text content (stopReason: {stop_reason}).")

        usage = response.get("usage", {})
        input_tokens = usage.get("inputTokens", 0)
        output_tokens = usage.get("outputTokens", 0)

        parsed_data = parse_json(raw_text)
        payload = FullLifecycleVoicePayload.model_validate(parsed_data)
        return payload, input_tokens, output_tokens

# =====================================================================
# Telemetry Logging to Daily JSON
# =====================================================================

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"

# Python's mimetypes DB is missing some modern types on certain platforms/versions —
# without this, FileResponse serves them as application/octet-stream.
mimetypes.add_type("image/webp", ".webp")
LOGS_DIR = BACKEND_DIR / "logs"

def log_telemetry_entry(entry: dict):
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now().strftime("%Y-%m-%d")
    log_file = LOGS_DIR / f"crm_telemetry_{today_str}.json"

    logs = []
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                logs = json.load(f)
                if not isinstance(logs, list):
                    logs = [logs]
        except Exception:
            logs = []

    logs.append(entry)
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2, default=str)


def convert_to_wav_16k(input_path: str) -> tuple[bytes, float]:
    """Normalizes any uploaded audio container to mono 16kHz WAV — a self-describing
    file Sarvam's multipart upload can decode directly (unlike headerless raw PCM)."""
    try:
        import imageio_ffmpeg
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg_bin = "ffmpeg"

    out_path = input_path + ".wav"
    cmd = [
        ffmpeg_bin, "-y", "-i", input_path,
        "-ac", "1", "-ar", "16000", "-f", "wav",
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    with open(out_path, "rb") as f:
        wav_bytes = f.read()

    try:
        os.remove(out_path)
    except FileNotFoundError:
        pass

    with wave.open(io.BytesIO(wav_bytes)) as w:
        duration_sec = w.getnframes() / float(w.getframerate())
    return wav_bytes, duration_sec


def execute_full_hierarchy_commit(db: Session, payload: ConfirmedCommitPayload) -> dict:
    user_id = payload.user_id

    account_name = (payload.account.account_name or "").strip()
    if not account_name:
        raise HTTPException(400, "Account name is mandatory to commit.")

    account = db.scalar(select(Account).where(Account.account_name.ilike(account_name)))
    if not account:
        account = Account(
            account_name=account_name,
            account_manager=payload.account.account_manager,
            region=payload.account.region,
            industry=payload.account.industry,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(account)
        db.flush()
    else:
        if payload.account.account_manager and not account.account_manager:
            account.account_manager = payload.account.account_manager
        if payload.account.region and not account.region:
            account.region = payload.account.region
        if payload.account.industry and not account.industry:
            account.industry = payload.account.industry
        stamp_audit(account, user_id, False)

    if payload.intent == "create_account":
        activity = Activity(
            activity_name=f"Account Confirmed: {account.account_name}",
            account_id=account.id,
            record_type="Account",
            record_action="System Action",
            account_name=account.account_name,
            notes=f"Confirmed and committed. Manager: {account.account_manager or 'N/A'}, Region: {account.region or 'N/A'}",
            created_by=user_id,
        )
        db.add(activity)
        db.commit()
        return {
            "entity_type": "Account",
            "account_id": account.id,
            "account_name": account.account_name,
            "account_manager": account.account_manager,
            "activity_id": activity.id,
        }

    subsidiary = None
    if payload.subsidiary.subsidiary_name:
        sub_name = payload.subsidiary.subsidiary_name.strip()
        subsidiary = db.scalar(
            select(Subsidiary).where(
                Subsidiary.subsidiary_name.ilike(sub_name),
                Subsidiary.account_id == account.id,
            )
        )
        if not subsidiary:
            subsidiary = Subsidiary(
                account_id=account.id,
                subsidiary_name=sub_name,
                region=payload.subsidiary.region or account.region,
                industry=payload.subsidiary.industry or account.industry,
                created_by=user_id,
                updated_by=user_id,
            )
            db.add(subsidiary)
            db.flush()

    contact_name = (payload.contact.contact_name or "").strip()
    if not contact_name:
        raise HTTPException(400, "Contact stakeholder name is mandatory to commit.")

    contact = db.scalar(
        select(Contact).where(
            Contact.contact_name.ilike(contact_name),
            Contact.account_id == account.id,
        )
    )
    if not contact:
        contact = Contact(
            account_id=account.id,
            subsidiary_id=subsidiary.id if subsidiary else None,
            contact_name=contact_name,
            designation=payload.contact.designation,
            email=payload.contact.email,
            mobile=payload.contact.mobile,
            linkedin_url=payload.contact.linkedin_url,
            notes=payload.contact.notes,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(contact)
        db.flush()
    else:
        if payload.contact.designation and not contact.designation:
            contact.designation = payload.contact.designation
        if payload.contact.mobile and not contact.mobile:
            contact.mobile = payload.contact.mobile
        if payload.contact.email and not contact.email:
            contact.email = payload.contact.email
        stamp_audit(contact, user_id, False)

    if payload.intent == "create_contact":
        activity = Activity(
            activity_name=f"Contact Created: {contact.contact_name}",
            account_id=account.id,
            subsidiary_id=subsidiary.id if subsidiary else None,
            contact_id=contact.id,
            record_type="Contact",
            record_action="System Action",
            account_name=account.account_name,
            contact_name=contact.contact_name,
            notes=f"Contact added to {account.account_name}. Role: {contact.designation or 'N/A'}",
            created_by=user_id,
        )
        db.add(activity)
        db.commit()

        return {
            "entity_type": "Contact",
            "account_id": account.id,
            "account_name": account.account_name,
            "contact_id": contact.id,
            "contact_name": contact.contact_name,
            "designation": contact.designation,
            "email": contact.email,
            "mobile": contact.mobile,
            "activity_id": activity.id,
        }

    if payload.intent == "create_opportunity":
        opp_title = (
            payload.opportunity.opportunity_name
            or payload.lead.lead_name
            or f"{account.account_name} - Commercial Opportunity"
        )

        backfilled_lead = Lead(
            lead_name=f"{opp_title} (Backfilled Lead)",
            account_id=account.id,
            subsidiary_id=subsidiary.id if subsidiary else None,
            contact_id=contact.id,
            account_manager=payload.account.account_manager or account.account_manager,
            deal_size=payload.opportunity.deal_size or payload.lead.deal_size,
            currency=payload.opportunity.currency or payload.lead.currency or "AED",
            type="Hot",
            stage="Qualified",
            lead_source="Opportunity Voice Backfill",
            technology=as_list(payload.opportunity.technology or payload.lead.technology),
            next_steps=payload.opportunity.next_steps or payload.lead.next_steps,
            next_action_date=payload.opportunity.next_action_date or payload.lead.next_action_date,
            closure_date=payload.opportunity.closure_date or payload.lead.closure_date,
            notes=payload.opportunity.notes or payload.lead.notes or "Auto-backfilled via confirmed opportunity creation",
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(backfilled_lead)
        db.flush()

        opportunity = Opportunity(
            opportunity_name=opp_title,
            lead_id=backfilled_lead.id,
            account_id=account.id,
            subsidiary_id=subsidiary.id if subsidiary else None,
            contact_id=contact.id,
            account_manager=payload.account.account_manager or account.account_manager,
            deal_size=payload.opportunity.deal_size or payload.lead.deal_size,
            currency=payload.opportunity.currency or payload.lead.currency or "AED",
            project_type=payload.opportunity.project_type or "T&M",
            stage=payload.opportunity.stage or "Discovery — 40%",
            probability=payload.opportunity.probability or 40,
            technology=as_list(payload.opportunity.technology or payload.lead.technology),
            next_steps=payload.opportunity.next_steps or payload.lead.next_steps,
            next_action_date=payload.opportunity.next_action_date or payload.lead.next_action_date,
            closure_date=payload.opportunity.closure_date or payload.lead.closure_date,
            notes=payload.opportunity.notes or payload.lead.notes,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(opportunity)
        db.flush()

        activity = Activity(
            activity_name=f"Opportunity Confirmed: {opportunity.opportunity_name}",
            account_id=account.id,
            subsidiary_id=subsidiary.id if subsidiary else None,
            contact_id=contact.id,
            lead_id=backfilled_lead.id,
            opportunity_id=opportunity.id,
            record_type="Opportunity",
            record_action="System Action",
            account_name=account.account_name,
            contact_name=contact.contact_name,
            notes=f"Confirmed Opportunity #{opportunity.id} with backfilled Qualified Lead #{backfilled_lead.id}",
            created_by=user_id,
        )
        db.add(activity)
        db.commit()

        return {
            "entity_type": "Opportunity",
            "account_id": account.id,
            "account_name": account.account_name,
            "account_manager": account.account_manager,
            "contact_id": contact.id,
            "contact_name": contact.contact_name,
            "lead_id": backfilled_lead.id,
            "lead_name": backfilled_lead.lead_name,
            "lead_stage": backfilled_lead.stage,
            "lead_type": backfilled_lead.type,
            "opportunity_id": opportunity.id,
            "opportunity_name": opportunity.opportunity_name,
            "opportunity_stage": opportunity.stage,
            "deal_size": float(opportunity.deal_size) if opportunity.deal_size else 0,
            "currency": opportunity.currency,
            "activity_id": activity.id,
        }

    lead_title = (
        payload.lead.lead_name
        or f"{account.account_name} - {payload.lead.service or 'Consulting'} Engagement"
    )

    lead = Lead(
        lead_name=lead_title,
        account_id=account.id,
        subsidiary_id=subsidiary.id if subsidiary else None,
        contact_id=contact.id,
        account_manager=payload.account.account_manager or account.account_manager,
        deal_size=payload.lead.deal_size,
        currency=payload.lead.currency or "AED",
        type=payload.lead.type or "Warm",
        stage=payload.lead.stage or "Non-Qualified",
        lead_source=payload.lead.lead_source or "Voice Capture",
        technology=as_list(payload.lead.technology),
        next_steps=payload.lead.next_steps,
        next_action_date=payload.lead.next_action_date,
        closure_date=payload.lead.closure_date,
        notes=payload.lead.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(lead)
    db.flush()

    activity = Activity(
        activity_name=f"Lead Confirmed: {lead.lead_name}",
        account_id=account.id,
        subsidiary_id=subsidiary.id if subsidiary else None,
        contact_id=contact.id,
        lead_id=lead.id,
        record_type="Lead",
        record_action="Call",
        account_name=account.account_name,
        contact_name=contact.contact_name,
        notes=payload.lead.notes or "Voice captured sales lead",
        created_by=user_id,
    )
    db.add(activity)
    db.commit()

    return {
        "entity_type": "Lead",
        "account_id": account.id,
        "account_name": account.account_name,
        "account_manager": account.account_manager,
        "contact_id": contact.id,
        "contact_name": contact.contact_name,
        "lead_id": lead.id,
        "lead_name": lead.lead_name,
        "lead_stage": lead.stage,
        "activity_id": activity.id,
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================================
# FastAPI Application & Startup Initialization
# =====================================================================

app = FastAPI(title="DataPhi CRM Voice Engine (AWS Sonnet 5)", version="8.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Microsoft SSO (see auth_service/). Adds /login and /auth/*; it signs users in via the `user` table.
# Must run BEFORE the routes below so the catch-all page route at the bottom never shadows /login.
setup_auth(app)

# Every /api/* route carries this, so nothing under /api is reachable without a valid session.
REQUIRE_LOGIN = [Depends(get_current_user)]
# User-management routes additionally require the Admin role.
REQUIRE_ADMIN = [Depends(require_role("Admin"))]
# Qualifications Pending page: Admin sees/approves both request types, Team Lead sees both but
# only approves lead_qualification, Executive is read-only and can view but never approve/revoke
# (enforced per-endpoint below, not by this page-level guard).
REQUIRE_QUALIFICATION_VIEWER = [Depends(require_role("Admin", "Team Lead", "Executive"))]
# Home dashboard: Admin, Team Lead and Executive only.
REQUIRE_DASHBOARD_VIEWER = [Depends(require_role("Admin", "Team Lead", "Executive"))]

if (FRONTEND_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="frontend-assets")

_stt_service = None
_chat_service = None


def run_schema_migrations():
    """Idempotently brings an existing (pre-existing-data) database up to date with
    model changes that Base.metadata.create_all() cannot apply to already-existing tables."""

    def column_data_type(conn, table, column) -> str | None:
        return conn.execute(
            text("SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=:t AND column_name=:c"),
            {"t": table, "c": column},
        ).scalar()

    def array_to_scalar(conn, table, column, base_type="VARCHAR(255)"):
        """Converts an existing ARRAY column to a comma-joined scalar varchar, or just adds
        the scalar column if it doesn't exist yet. Used for lead/opportunity.service_line,
        which the DBML types as a single varchar even though the UI keeps a multi-select."""
        data_type = column_data_type(conn, table, column)
        if data_type is None:
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {base_type}'))
        elif data_type == "ARRAY":
            tmp_col = f"{column}__scalar"
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{tmp_col}" {base_type}'))
            conn.execute(text(f'UPDATE "{table}" SET "{tmp_col}" = array_to_string("{column}", \'|\')'))
            conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{column}"'))
            conn.execute(text(f'ALTER TABLE "{table}" RENAME COLUMN "{tmp_col}" TO "{column}"'))

    simple_additions = [
        ("contact", "mobile_country_code", "VARCHAR(6) DEFAULT '+971'"),
        ("contact", "secondary_mobile_country_code", "VARCHAR(6) DEFAULT '+971'"),
        ("contact", "department", "VARCHAR(150)"),
        ("contact", "secondary_email", "VARCHAR(320)"),
        ("account", "website", "VARCHAR(500)"),
        ("account", "notes", "TEXT"),
        ("subsidiary", "notes", "TEXT"),
        ("lead", "project_type", "VARCHAR(50)"),
        ("lead", "referred_by", "VARCHAR(150)"),
        ("lead", "campaign_name", "VARCHAR(255)"),
        ("opportunity", "referred_by", "VARCHAR(150)"),
        ("opportunity", "expected_closure_date", "DATE"),
        ("project", "po_document_s3_key", "VARCHAR(500)"),
        ("project", "po_document_name", "VARCHAR(255)"),
        ("project", "po_uploaded_at", "TIMESTAMPTZ"),
    ]

    dropped_columns = [
        ("account", "account_tier"),
        ("account", "primary_address"),
        ("account", "secondary_address"),
        ("subsidiary", "primary_address"),
        ("subsidiary", "secondary_address"),
        ("contact", "primary_address"),
        ("contact", "secondary_address"),
        ("lead", "service"),
        ("lead", "solution_scope"),
        ("opportunity", "service"),
        ("opportunity", "solution_scope"),
        ("opportunity", "campaign_name"),
        ("opportunity", "poc_start_date"),
        ("opportunity", "poc_end_date"),
        ("opportunity", "poc_outcome"),
        ("project", "service"),
        ("project", "service_line"),
        ("activity", "activity_outcome"),
    ]

    array_conversions = [
        ("lead", "technology", "VARCHAR(150)"),
        ("opportunity", "technology", "VARCHAR(150)"),
        ("project", "technology", "VARCHAR(150)"),
    ]

    scalar_conversions = [
        ("lead", "service_line", "VARCHAR(255)"),
        ("opportunity", "service_line", "VARCHAR(255)"),
    ]

    attribute_tables = ["account", "subsidiary", "contact", "lead", "opportunity", "project", "activity"]

    def merge_users_table(conn, column_data_type):
        """Folds the old SSO `users` table into `user`: adds role / ms_oid / is_active /
        last_login_at, copies sign-in data across by email, drops user.role_ids and users."""
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50)'))
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ms_oid" VARCHAR(255)'))
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE'))
        conn.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP'))

        if column_data_type(conn, "users", "email") is not None:
            # Rows that only exist in `users` (e.g. demo users) become `user` rows.
            conn.execute(text(
                'INSERT INTO "user" (role_ids, user_name, email_id, creation_date) '
                "SELECT ARRAY[]::integer[], COALESCE(u.full_name, u.email), u.email, COALESCE(u.created_at, now()) "
                'FROM "users" u WHERE NOT EXISTS (SELECT 1 FROM "user" x WHERE lower(x.email_id) = lower(u.email))'
            ) if column_data_type(conn, "user", "role_ids") is not None else text(
                'INSERT INTO "user" (user_name, email_id, creation_date) '
                "SELECT COALESCE(u.full_name, u.email), u.email, COALESCE(u.created_at, now()) "
                'FROM "users" u WHERE NOT EXISTS (SELECT 1 FROM "user" x WHERE lower(x.email_id) = lower(u.email))'
            ))
            conn.execute(text(
                'UPDATE "user" SET role = u.role, ms_oid = u.ms_oid, is_active = COALESCE(u.is_active, TRUE), '
                'last_login_at = u.last_login_at FROM "users" u WHERE lower("user".email_id) = lower(u.email)'
            ))

        if column_data_type(conn, "user", "role_ids") is not None:
            # Anyone still without a role: take it from their old role_ids[1] -> role.role_name.
            conn.execute(text(
                'UPDATE "user" SET role = r.role_name FROM "role" r '
                'WHERE "user".role IS NULL AND cardinality("user".role_ids) > 0 AND r.id = "user".role_ids[1]'
            ))
        conn.execute(text("UPDATE \"user\" SET role = 'Sales Representative' WHERE role IS NULL"))
        # LOV rename: "Sales Rep" -> "Sales Representative" (existing seeded/demo rows must migrate too).
        conn.execute(text("UPDATE \"user\" SET role = 'Sales Representative' WHERE role = 'Sales Rep'"))
        conn.execute(text("ALTER TABLE \"user\" ALTER COLUMN \"role\" SET DEFAULT 'Sales Representative'"))
        conn.execute(text('ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL'))
        conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_user_ms_oid ON "user" (ms_oid)'))

        conn.execute(text('ALTER TABLE "user" DROP COLUMN IF EXISTS "role_ids"'))
        conn.execute(text('DROP TABLE IF EXISTS "users"'))

    with engine.begin() as conn:
        for table, column, coltype in simple_additions:
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {coltype}'))

        for table, column in dropped_columns:
            conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS "{column}"'))

        for table, column, base_type in scalar_conversions:
            array_to_scalar(conn, table, column, base_type)

        for table, column, base_type in array_conversions:
            data_type = column_data_type(conn, table, column)

            if data_type is None:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {base_type}[]'))
            elif data_type != "ARRAY":
                tmp_col = f"{column}__migrated"
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{tmp_col}" {base_type}[]'))
                conn.execute(
                    text(
                        f'UPDATE "{table}" SET "{tmp_col}" = '
                        f"CASE WHEN \"{column}\" IS NOT NULL AND \"{column}\" <> '' "
                        f'THEN ARRAY["{column}"] ELSE ARRAY[]::{base_type}[] END'
                    )
                )
                conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{column}"'))
                conn.execute(text(f'ALTER TABLE "{table}" RENAME COLUMN "{tmp_col}" TO "{column}"'))

        merge_users_table(conn, column_data_type)

        for table in attribute_tables:
            for i in range(1, 11):
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "attribute_{i}" VARCHAR(255)'))


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    run_schema_migrations()
    init_auth_db()  # demo users; needs the migrated `user` table
    global _stt_service, _chat_service
    _stt_service = SarvamSTTService(api_key=settings().sarvam_api_key, model=settings().sarvam_stt_model)
    _chat_service = AWSBedrockService(region=settings().aws_region, model_id=settings().bedrock_model_id)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "Sarvam STT + AWS Bedrock",
        "stt_model": settings().sarvam_stt_model,
        "bedrock_model": settings().bedrock_model_id,
        "timestamp": datetime.now().isoformat(),
    }


# =====================================================================
# Dashboard (Home) — aggregated read-only view over Leads/Opportunities.
# Everything here is computed live from the same tables the registry pages
# write to; there is no separate "dashboard data" stored anywhere.
# =====================================================================

DASHBOARD_PERIODS = {"mtd", "qtd", "ytd", "all"}
# Must byte-for-byte match frontend/src/constants/options.ts (em-dash, not hyphen).
DASHBOARD_OPP_STAGE_TRACK = ["Discovery — 40%", "Tech Discussion — 60%", "Proposal — 80%"]
DASHBOARD_OPP_STAGE_WON = "Closed Won (100%)"
DASHBOARD_OPP_STAGE_LOST = "Closed Lost (0%)"


def _dashboard_period_start(period: str) -> date | None:
    today = date.today()
    if period == "mtd":
        return today.replace(day=1)
    if period == "qtd":
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        return date(today.year, quarter_start_month, 1)
    if period == "ytd":
        return date(today.year, 1, 1)
    return None  # "all" — no lower bound


def _dashboard_in_period(d: date | None, start: date | None) -> bool:
    if start is None:
        return True
    if d is None:
        return False
    return d >= start


def _dashboard_group_by_currency(items: list[tuple[str, Decimal]]) -> list[dict]:
    totals: dict[str, Decimal] = {}
    for currency, amount in items:
        totals[currency] = totals.get(currency, Decimal(0)) + amount
    return [
        {"currency": c, "amount": float(a)}
        for c, a in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    ]


@app.get("/api/dashboard/summary", dependencies=REQUIRE_DASHBOARD_VIEWER)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    period: str = Query("qtd"),
    account_manager: str | None = Query(None),
    region: str | None = Query(None),
    source: str | None = Query(None),
    project_type: str | None = Query(None),
):
    if period not in DASHBOARD_PERIODS:
        raise HTTPException(status_code=400, detail=f"period must be one of: {', '.join(sorted(DASHBOARD_PERIODS))}")
    period_start = _dashboard_period_start(period)
    today = date.today()

    all_leads = db.scalars(select(Lead).options(selectinload(Lead.account))).all()
    all_opps = db.scalars(select(Opportunity).options(selectinload(Opportunity.account))).all()

    available_account_managers = sorted({
        m for m in (
            [l.account_manager for l in all_leads] + [o.account_manager for o in all_opps]
        ) if m
    })

    def lead_matches(l: Lead) -> bool:
        if account_manager and l.account_manager != account_manager:
            return False
        if region and (not l.account or l.account.region != region):
            return False
        if source and l.lead_source != source:
            return False
        if project_type and l.project_type != project_type:
            return False
        return True

    def opp_matches(o: Opportunity) -> bool:
        if account_manager and o.account_manager != account_manager:
            return False
        if region and (not o.account or o.account.region != region):
            return False
        if source and o.opportunity_source != source:
            return False
        if project_type and o.project_type != project_type:
            return False
        return True

    leads = [l for l in all_leads if lead_matches(l)]
    opps = [o for o in all_opps if opp_matches(o)]

    def deal_size(x) -> Decimal:
        return x.deal_size if x.deal_size is not None else Decimal(0)

    def opp_currency(x) -> str:
        return x.currency or "AED"

    def is_open(o: Opportunity) -> bool:
        return o.stage not in (DASHBOARD_OPP_STAGE_WON, DASHBOARD_OPP_STAGE_LOST)

    open_opps = [o for o in opps if is_open(o)]
    won_opps = [o for o in opps if o.stage == DASHBOARD_OPP_STAGE_WON]
    lost_opps = [o for o in opps if o.stage == DASHBOARD_OPP_STAGE_LOST]

    # ---- KPIs. Open/weighted pipeline are a live snapshot (not period-bound); ----
    # ---- Closed Won/Lost, win rate and cycle time are bound to the selected period. ----
    open_pipeline = _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in open_opps])
    weighted_pipeline = _dashboard_group_by_currency(
        [(opp_currency(o), deal_size(o) * Decimal(o.probability or 0) / Decimal(100)) for o in open_opps]
    )
    won_in_period = [o for o in won_opps if _dashboard_in_period(o.closure_date or o.creation_date.date(), period_start)]
    lost_in_period = [o for o in lost_opps if _dashboard_in_period(o.closure_date or o.creation_date.date(), period_start)]
    closed_won_value = _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in won_in_period])
    closed_lost_value = _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in lost_in_period])
    win_rate_pct = (
        round(len(won_in_period) / (len(won_in_period) + len(lost_in_period)) * 100, 1)
        if (won_in_period or lost_in_period) else None
    )
    cycle_days = [(o.closure_date - o.creation_date.date()).days for o in won_in_period if o.closure_date]
    avg_cycle_days = round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else None
    open_lead_count = sum(1 for l in leads if l.stage == "Qualified")

    all_projects = db.scalars(select(Project).options(selectinload(Project.account))).all()
    if region:
        all_projects = [p for p in all_projects if p.account and p.account.region == region]
    projects_in_delivery = sum(1 for p in all_projects if p.stage not in ("Closed", "Cancelled"))

    kpis = {
        "open_pipeline": open_pipeline,
        "weighted_pipeline": weighted_pipeline,
        "closed_won": closed_won_value,
        "closed_lost": closed_lost_value,
        "open_deal_count": len(open_opps),
        "open_lead_count": open_lead_count,
        "projects_in_delivery": projects_in_delivery,
        "win_rate_pct": win_rate_pct,
        "avg_cycle_days": avg_cycle_days,
    }

    # ---- Sales funnel: cohort of leads/opportunities *created* within the period, ----
    # ---- bucketed by their *current* stage (this is a distribution, not a strict lineage). ----
    leads_in_period = [l for l in leads if _dashboard_in_period(l.creation_date.date(), period_start)]
    opps_in_period = [o for o in opps if _dashboard_in_period(o.creation_date.date(), period_start)]
    qualified_leads = [l for l in leads_in_period if l.stage == "Qualified"]

    funnel_buckets: list[tuple[str, list]] = [("Qualified Leads", qualified_leads)]
    for stage_name in DASHBOARD_OPP_STAGE_TRACK:
        funnel_buckets.append((stage_name, [o for o in opps_in_period if o.stage == stage_name]))
    funnel_buckets.append((DASHBOARD_OPP_STAGE_WON, [o for o in opps_in_period if o.stage == DASHBOARD_OPP_STAGE_WON]))
    funnel_buckets.append((DASHBOARD_OPP_STAGE_LOST, [o for o in opps_in_period if o.stage == DASHBOARD_OPP_STAGE_LOST]))

    funnel = []
    prev_count: int | None = None
    for label, records in funnel_buckets:
        count = len(records)
        amounts = _dashboard_group_by_currency(
            [(r.currency or "AED", deal_size(r)) for r in records]
        )
        conversion_pct = round(count / prev_count * 100, 1) if prev_count else None
        funnel.append({"stage": label, "count": count, "amounts": amounts, "conversion_pct": conversion_pct})
        prev_count = count

    # ---- Open pipeline by engagement/contract type ----
    by_type: dict[str, list[Opportunity]] = {}
    for o in open_opps:
        by_type.setdefault(o.project_type or "Other", []).append(o)
    pipeline_by_type = [
        {"type": t, "amounts": _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in items])}
        for t, items in sorted(by_type.items())
    ]

    # ---- Weighted forecast for the next 6 months by expected closure date ----
    forecast_by_month = []
    y, m = today.year, today.month
    for i in range(6):
        mm = (m - 1 + i) % 12 + 1
        yy = y + (m - 1 + i) // 12
        bucket = [
            o for o in open_opps
            if o.expected_closure_date and o.expected_closure_date.year == yy and o.expected_closure_date.month == mm
        ]
        weighted = _dashboard_group_by_currency(
            [(opp_currency(o), deal_size(o) * Decimal(o.probability or 0) / Decimal(100)) for o in bucket]
        )
        forecast_by_month.append({
            "month": f"{yy}-{mm:02d}",
            "label": f"{date(yy, mm, 1).strftime('%b')} '{str(yy)[2:]}",
            "weighted_amounts": weighted,
            "deal_count": len(bucket),
        })

    # ---- Monthly Deal Tracker: open opportunities by Account Manager (rows) x Month (columns), ----
    # ---- months grouped into quarter header spans — a spreadsheet-style forecast view. ----
    def _short_stage_label(stage: str) -> str:
        if stage.startswith("Discovery"):
            return "Discovery"
        if stage.startswith("Tech Discussion"):
            return "Tech Disc."
        if stage.startswith("Proposal"):
            return "Proposal"
        if stage == DASHBOARD_OPP_STAGE_WON:
            return "Won"
        if stage == DASHBOARD_OPP_STAGE_LOST:
            return "Lost"
        return stage

    grid_months = [(y + (m - 1 + i) // 12, (m - 1 + i) % 12 + 1) for i in range(6)]
    grid_month_keys = [f"{yy}-{mm:02d}" for yy, mm in grid_months]
    grid_quarters = []
    for yy, mm in grid_months:
        q_label = f"Q{(mm - 1) // 3 + 1} {yy}"
        if grid_quarters and grid_quarters[-1]["label"] == q_label:
            grid_quarters[-1]["span"] += 1
        else:
            grid_quarters.append({"label": q_label, "span": 1})

    by_manager: dict[str, dict[str, list[Opportunity]]] = {}
    for o in open_opps:
        if not o.expected_closure_date:
            continue
        key = f"{o.expected_closure_date.year}-{o.expected_closure_date.month:02d}"
        if key not in grid_month_keys:
            continue
        mgr_name = o.account_manager or "Unassigned"
        by_manager.setdefault(mgr_name, {}).setdefault(key, []).append(o)

    grid_rows = []
    for mgr_name, months_map in by_manager.items():
        all_opps_for_mgr = [o for items in months_map.values() for o in items]
        cells = {
            key: [
                {
                    "id": o.id,
                    "opportunity_name": o.opportunity_name,
                    "deal_size": float(deal_size(o)),
                    "currency": opp_currency(o),
                    "probability": o.probability or 0,
                    "stage_label": _short_stage_label(o.stage),
                    "expected_closure_date": o.expected_closure_date.isoformat() if o.expected_closure_date else None,
                }
                for o in months_map.get(key, [])
            ]
            for key in grid_month_keys
        }
        grid_rows.append({
            "manager_name": mgr_name,
            "total_amounts": _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in all_opps_for_mgr]),
            "cells": cells,
        })
    grid_rows.sort(key=lambda r: sum(a["amount"] for a in r["total_amounts"]), reverse=True)
    grid_rows = grid_rows[:12]

    grid_month_totals = {
        key: _dashboard_group_by_currency([
            (opp_currency(o), deal_size(o))
            for months_map in by_manager.values()
            for o in months_map.get(key, [])
        ])
        for key in grid_month_keys
    }

    forecast_grid = {
        "months": [{"key": k, "label": lbl} for k, lbl in zip(grid_month_keys, (f["label"] for f in forecast_by_month))],
        "quarters": grid_quarters,
        "rows": grid_rows,
        "month_totals": grid_month_totals,
    }

    # ---- Pipeline movement (bridge) for the selected period ----
    opening_opps = []
    if period_start is not None:
        opening_opps = [
            o for o in opps
            if o.creation_date.date() < period_start
            and (is_open(o) or _dashboard_in_period(o.closure_date or o.creation_date.date(), period_start))
        ]
    new_added_opps = [o for o in opps if _dashboard_in_period(o.creation_date.date(), period_start)]
    pipeline_movement = {
        "opening": _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in opening_opps]),
        "new_added": _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in new_added_opps]),
        "won": closed_won_value,
        "lost": closed_lost_value,
        "closing": open_pipeline,
    }

    # ---- Deal tracking table: open opportunities, soonest expected close first ----
    def sort_key(o: Opportunity):
        return (o.expected_closure_date is None, o.expected_closure_date or date.max)

    deal_tracking = [
        {
            "id": o.id,
            "opportunity_name": o.opportunity_name,
            "account_name": o.account.account_name if o.account else "N/A",
            "stage": o.stage,
            "deal_size": float(deal_size(o)),
            "currency": opp_currency(o),
            "expected_closure_date": o.expected_closure_date.isoformat() if o.expected_closure_date else None,
        }
        for o in sorted(open_opps, key=sort_key)[:20]
    ]

    # ---- Lead source mix for this period's cohort ----
    source_counts: dict[str, int] = {}
    for l in leads_in_period:
        key = l.lead_source or "Unspecified"
        source_counts[key] = source_counts.get(key, 0) + 1
    total_leads_in_period = sum(source_counts.values())
    lead_source_mix = [
        {"source": s, "count": c, "pct": round(c / total_leads_in_period * 100, 1) if total_leads_in_period else 0}
        for s, c in sorted(source_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # ---- Closed Won value trend, trailing 6 calendar months ----
    closed_won_trend = []
    for i in range(5, -1, -1):
        mm = (today.month - 1 - i) % 12 + 1
        yy = today.year + (today.month - 1 - i) // 12
        bucket = [
            o for o in won_opps
            if (o.closure_date or o.creation_date.date()).year == yy
            and (o.closure_date or o.creation_date.date()).month == mm
        ]
        closed_won_trend.append({
            "month": f"{yy}-{mm:02d}",
            "label": date(yy, mm, 1).strftime("%b"),
            "amounts": _dashboard_group_by_currency([(opp_currency(o), deal_size(o)) for o in bucket]),
        })

    # ---- Needs attention: open deals with no logged activity in 7+ days ----
    open_opp_ids = [o.id for o in open_opps]
    last_activity: dict[int, date] = {}
    if open_opp_ids:
        for a in db.scalars(select(Activity).where(Activity.opportunity_id.in_(open_opp_ids))).all():
            d = a.activity_date.date()
            if a.opportunity_id not in last_activity or d > last_activity[a.opportunity_id]:
                last_activity[a.opportunity_id] = d

    needs_attention = []
    for o in open_opps:
        reference = last_activity.get(o.id, o.creation_date.date())
        days_idle = (today - reference).days
        if days_idle >= 7:
            needs_attention.append({
                "id": o.id,
                "opportunity_name": o.opportunity_name,
                "account_name": o.account.account_name if o.account else "N/A",
                "stage": o.stage,
                "days_idle": days_idle,
            })
    needs_attention.sort(key=lambda x: x["days_idle"], reverse=True)
    needs_attention = needs_attention[:6]

    # ---- Recent activity feed (global, unfiltered by the panel's filters) ----
    recent_raw = db.scalars(select(Activity).order_by(Activity.activity_date.desc()).limit(8)).all()
    actor_ids = {a.created_by for a in recent_raw if a.created_by}
    actor_name: dict[int, str] = {}
    if actor_ids:
        for u in db.scalars(select(User).where(User.id.in_(actor_ids))).all():
            actor_name[u.id] = u.user_name
    recent_activity = [
        {
            "id": a.id,
            "activity_name": a.activity_name,
            "record_action": a.record_action,
            "linked_name": a.account_name or a.contact_name or a.subsidiary_name or "—",
            "actor": actor_name.get(a.created_by, "Unknown"),
            "activity_date": a.activity_date.strftime("%Y-%m-%d %H:%M") if a.activity_date else "N/A",
        }
        for a in recent_raw
    ]

    return {
        "period": {"key": period, "start": period_start.isoformat() if period_start else None, "end": today.isoformat()},
        "kpis": kpis,
        "funnel": funnel,
        "pipeline_by_type": pipeline_by_type,
        "forecast_by_month": forecast_by_month,
        "forecast_grid": forecast_grid,
        "pipeline_movement": pipeline_movement,
        "deal_tracking": deal_tracking,
        "lead_source_mix": lead_source_mix,
        "closed_won_trend": closed_won_trend,
        "needs_attention": needs_attention,
        "recent_activity": recent_activity,
        "available_account_managers": available_account_managers,
    }


# =====================================================================
# Accounts Overview / Registry Query Endpoint
# =====================================================================

@app.get("/api/accounts/overview", dependencies=REQUIRE_LOGIN)
def get_accounts_overview(db: Session = Depends(get_db)):
    accounts = db.scalars(
        select(Account)
        .options(selectinload(Account.subsidiaries), selectinload(Account.contacts))
        .order_by(Account.id.desc())
    ).all()

    result = []
    for acc in accounts:
        result.append({
            "id": acc.id,
            "account_name": acc.account_name,
            "account_manager": acc.account_manager or "Unassigned",
            "region": acc.region or "N/A",
            "industry": acc.industry or "N/A",
            "website": acc.website or "N/A",
            "notes": acc.notes or "",
            "creation_date": acc.creation_date.strftime("%Y-%m-%d %H:%M") if acc.creation_date else "N/A",
            "subsidiaries": [
                {
                    "id": sub.id,
                    "subsidiary_name": sub.subsidiary_name,
                    "region": sub.region or "N/A",
                    "industry": sub.industry or "N/A",
                }
                for sub in acc.subsidiaries
            ],
            "contacts": [
                {
                    "id": con.id,
                    "contact_name": con.contact_name,
                    "designation": con.designation or "N/A",
                    "email": con.email or "N/A",
                    "mobile": con.mobile or "N/A",
                }
                for con in acc.contacts
            ],
        })
    return result


# =====================================================================
# Cross-Entity Lookup Endpoint (feeds all dropdowns + FK cross-refs)
# =====================================================================

@app.get("/api/lookups", dependencies=REQUIRE_LOGIN)
def get_lookups(db: Session = Depends(get_db)):
    accounts = db.scalars(select(Account).order_by(Account.account_name)).all()
    subsidiaries = db.scalars(select(Subsidiary).order_by(Subsidiary.subsidiary_name)).all()
    contacts = db.scalars(select(Contact).order_by(Contact.contact_name)).all()
    leads = db.scalars(select(Lead).order_by(Lead.id.desc())).all()
    opportunities = db.scalars(select(Opportunity).order_by(Opportunity.id.desc())).all()
    projects = db.scalars(select(Project).order_by(Project.id.desc())).all()

    acc_name = {a.id: a.account_name for a in accounts}
    sub_name = {s.id: s.subsidiary_name for s in subsidiaries}
    con_name = {c.id: c.contact_name for c in contacts}

    return {
        "accounts": [
            {"id": a.id, "account_name": a.account_name, "account_manager": a.account_manager,
             "region": a.region, "industry": a.industry}
            for a in accounts
        ],
        "subsidiaries": [
            {"id": s.id, "subsidiary_name": s.subsidiary_name, "account_id": s.account_id,
             "account_name": acc_name.get(s.account_id), "region": s.region, "industry": s.industry}
            for s in subsidiaries
        ],
        "contacts": [
            {"id": c.id, "contact_name": c.contact_name, "account_id": c.account_id,
             "account_name": acc_name.get(c.account_id), "subsidiary_id": c.subsidiary_id,
             "subsidiary_name": sub_name.get(c.subsidiary_id), "designation": c.designation,
             "email": c.email, "mobile": c.mobile}
            for c in contacts
        ],
        "leads": [
            {"id": l.id, "lead_name": l.lead_name, "account_id": l.account_id,
             "account_name": acc_name.get(l.account_id), "subsidiary_id": l.subsidiary_id,
             "contact_id": l.contact_id,
             "contact_name": con_name.get(l.contact_id), "stage": l.stage, "type": l.type,
             "deal_size": float(l.deal_size) if l.deal_size else None, "currency": l.currency,
             "project_type": l.project_type,
             "service_line": service_line_to_list(l.service_line),
             "technology": l.technology or [],
             "referred_by": l.referred_by}
            for l in leads
        ],
        "opportunities": [
            {"id": o.id, "opportunity_name": o.opportunity_name, "account_id": o.account_id,
             "account_name": acc_name.get(o.account_id), "subsidiary_id": o.subsidiary_id,
             "contact_id": o.contact_id,
             "contact_name": con_name.get(o.contact_id), "lead_id": o.lead_id, "stage": o.stage,
             "deal_size": float(o.deal_size) if o.deal_size else None, "currency": o.currency,
             "technology": o.technology or [],
             "service_line": service_line_to_list(o.service_line)}
            for o in opportunities
        ],
        "projects": [
            {"id": p.id, "project_name": p.project_name, "opportunity_id": p.opportunity_id,
             "account_id": p.account_id, "account_name": acc_name.get(p.account_id),
             "contact_id": p.contact_id, "stage": p.stage}
            for p in projects
        ],
    }


# =====================================================================
# Registry Overview Endpoints (feed the hierarchical registry tables)
# =====================================================================

@app.get("/api/subsidiaries/overview", dependencies=REQUIRE_LOGIN)
def get_subsidiaries_overview(db: Session = Depends(get_db)):
    subs = db.scalars(
        select(Subsidiary)
        .options(selectinload(Subsidiary.account), selectinload(Subsidiary.contacts))
        .order_by(Subsidiary.id.desc())
    ).all()

    return [
        {
            "id": s.id,
            "subsidiary_name": s.subsidiary_name,
            "region": s.region or "N/A",
            "industry": s.industry or "N/A",
            "notes": s.notes or "",
            "account_id": s.account_id,
            "account_name": s.account.account_name if s.account else "N/A",
            "account_manager": s.account.account_manager if s.account else "N/A",
            "creation_date": s.creation_date.strftime("%Y-%m-%d %H:%M") if s.creation_date else "N/A",
            "contacts": [
                {
                    "id": c.id, "contact_name": c.contact_name,
                    "designation": c.designation or "N/A",
                    "email": c.email or "N/A", "mobile": c.mobile or "N/A",
                }
                for c in s.contacts
            ],
        }
        for s in subs
    ]


@app.get("/api/contacts/overview", dependencies=REQUIRE_LOGIN)
def get_contacts_overview(db: Session = Depends(get_db)):
    contacts = db.scalars(
        select(Contact)
        .options(
            selectinload(Contact.account), selectinload(Contact.subsidiary),
            selectinload(Contact.leads), selectinload(Contact.opportunities),
        )
        .order_by(Contact.id.desc())
    ).all()

    return [
        {
            "id": c.id,
            "contact_name": c.contact_name,
            "designation": c.designation or "N/A",
            "department": c.department or "N/A",
            "email": c.email or "N/A",
            "secondary_email": c.secondary_email or "N/A",
            "mobile": c.mobile or "N/A",
            "linkedin_url": c.linkedin_url or "N/A",
            "account_id": c.account_id,
            "account_name": c.account.account_name if c.account else "N/A",
            "subsidiary_id": c.subsidiary_id,
            "subsidiary_name": c.subsidiary.subsidiary_name if c.subsidiary else None,
            "creation_date": c.creation_date.strftime("%Y-%m-%d %H:%M") if c.creation_date else "N/A",
            "leads": [
                {"id": ld.id, "lead_name": ld.lead_name, "stage": ld.stage,
                 "deal_size": float(ld.deal_size) if ld.deal_size else 0, "currency": ld.currency}
                for ld in c.leads
            ],
            "opportunities": [
                {"id": op.id, "opportunity_name": op.opportunity_name, "stage": op.stage,
                 "deal_size": float(op.deal_size) if op.deal_size else 0, "currency": op.currency}
                for op in c.opportunities
            ],
        }
        for c in contacts
    ]


@app.get("/api/leads/overview", dependencies=REQUIRE_LOGIN)
def get_leads_overview(db: Session = Depends(get_db)):
    leads = db.scalars(
        select(Lead)
        .options(selectinload(Lead.account), selectinload(Lead.contact), selectinload(Lead.opportunities))
        .order_by(Lead.id.desc())
    ).all()

    lead_ids = [l.id for l in leads]
    activities = []
    if lead_ids:
        activities = db.scalars(select(Activity).where(Activity.lead_id.in_(lead_ids)).order_by(Activity.id.desc())).all()
    acts_by_lead: dict[int, list] = {}
    for a in activities:
        acts_by_lead.setdefault(a.lead_id, []).append(a)

    return [
        {
            "id": l.id,
            "lead_name": l.lead_name,
            "account_id": l.account_id,
            "account_name": l.account.account_name if l.account else "N/A",
            "contact_id": l.contact_id,
            "contact_name": l.contact.contact_name if l.contact else "N/A",
            "account_manager": l.account_manager or "N/A",
            "deal_size": float(l.deal_size) if l.deal_size else 0,
            "currency": l.currency or "AED",
            "project_type": l.project_type or "N/A",
            "referred_by": l.referred_by or "N/A",
            "service_line": service_line_to_list(l.service_line),
            "stage": l.stage or "N/A",
            "type": l.type or "N/A",
            "lead_source": l.lead_source or "N/A",
            "campaign_name": l.campaign_name or "N/A",
            "technology": l.technology or [],
            "next_steps": l.next_steps or "N/A",
            "next_action_date": l.next_action_date.isoformat() if l.next_action_date else None,
            "creation_date": l.creation_date.strftime("%Y-%m-%d %H:%M") if l.creation_date else "N/A",
            "opportunities": [
                {"id": o.id, "opportunity_name": o.opportunity_name, "stage": o.stage}
                for o in l.opportunities
            ],
            "activities": [
                {"id": a.id, "activity_name": a.activity_name, "record_action": a.record_action,
                 "activity_date": a.activity_date.strftime("%Y-%m-%d %H:%M") if a.activity_date else "N/A"}
                for a in acts_by_lead.get(l.id, [])
            ],
        }
        for l in leads
    ]


@app.get("/api/opportunities/overview", dependencies=REQUIRE_LOGIN)
def get_opportunities_overview(db: Session = Depends(get_db)):
    opps = db.scalars(
        select(Opportunity)
        .options(selectinload(Opportunity.account), selectinload(Opportunity.contact), selectinload(Opportunity.lead))
        .order_by(Opportunity.id.desc())
    ).all()

    opp_ids = [o.id for o in opps]
    activities = []
    if opp_ids:
        activities = db.scalars(select(Activity).where(Activity.opportunity_id.in_(opp_ids)).order_by(Activity.id.desc())).all()
    acts_by_opp: dict[int, list] = {}
    for a in activities:
        acts_by_opp.setdefault(a.opportunity_id, []).append(a)

    return [
        {
            "id": o.id,
            "opportunity_name": o.opportunity_name,
            "account_id": o.account_id,
            "account_name": o.account.account_name if o.account else "N/A",
            "contact_id": o.contact_id,
            "contact_name": o.contact.contact_name if o.contact else "N/A",
            "lead_id": o.lead_id,
            "lead_name": o.lead.lead_name if o.lead else None,
            "account_manager": o.account_manager or "N/A",
            "deal_size": float(o.deal_size) if o.deal_size else 0,
            "currency": o.currency or "AED",
            "project_type": o.project_type or "N/A",
            "referred_by": o.referred_by or "N/A",
            "service_line": service_line_to_list(o.service_line),
            "stage": o.stage or "N/A",
            "probability": o.probability or 0,
            "technology": o.technology or [],
            "opportunity_source": o.opportunity_source or "N/A",
            "next_steps": o.next_steps or "N/A",
            "next_action_date": o.next_action_date.isoformat() if o.next_action_date else None,
            "expected_closure_date": o.expected_closure_date.isoformat() if o.expected_closure_date else None,
            "creation_date": o.creation_date.strftime("%Y-%m-%d %H:%M") if o.creation_date else "N/A",
            "activities": [
                {"id": a.id, "activity_name": a.activity_name, "record_action": a.record_action,
                 "activity_date": a.activity_date.strftime("%Y-%m-%d %H:%M") if a.activity_date else "N/A"}
                for a in acts_by_opp.get(o.id, [])
            ],
        }
        for o in opps
    ]


@app.get("/api/projects/overview", dependencies=REQUIRE_LOGIN)
def get_projects_overview(db: Session = Depends(get_db)):
    projects = db.scalars(
        select(Project)
        .options(selectinload(Project.account), selectinload(Project.opportunity))
        .order_by(Project.id.desc())
    ).all()

    return [
        {
            "id": p.id,
            "project_name": p.project_name,
            "opportunity_id": p.opportunity_id,
            "opportunity_name": p.opportunity.opportunity_name if p.opportunity else "N/A",
            "account_id": p.account_id,
            "account_name": p.account.account_name if p.account else "N/A",
            "contact_id": p.contact_id,
            "stage": p.stage or "N/A",
            "po_number": p.po_number or "N/A",
            "value": float(p.value) if p.value else 0,
            "currency": p.currency or "AED",
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "close_date": p.close_date.isoformat() if p.close_date else None,
            "technology": p.technology or [],
            "po_document_name": p.po_document_name,
            "po_uploaded_at": p.po_uploaded_at.isoformat() if p.po_uploaded_at else None,
            "creation_date": p.creation_date.strftime("%Y-%m-%d %H:%M") if p.creation_date else "N/A",
        }
        for p in projects
    ]


@app.get("/api/activities/overview", dependencies=REQUIRE_LOGIN)
def get_activities_overview(db: Session = Depends(get_db)):
    activities = db.scalars(select(Activity).order_by(Activity.id.desc()).limit(200)).all()

    lead_ids = {a.lead_id for a in activities if a.lead_id}
    opp_ids = {a.opportunity_id for a in activities if a.opportunity_id}
    proj_ids = {a.project_id for a in activities if a.project_id}
    account_ids = {a.account_id for a in activities if a.account_id}
    contact_ids = {a.contact_id for a in activities if a.contact_id}
    subsidiary_ids = {a.subsidiary_id for a in activities if a.subsidiary_id}

    lead_name = {l.id: l.lead_name for l in db.scalars(select(Lead).where(Lead.id.in_(lead_ids))).all()} if lead_ids else {}
    opp_name = {o.id: o.opportunity_name for o in db.scalars(select(Opportunity).where(Opportunity.id.in_(opp_ids))).all()} if opp_ids else {}
    proj_name = {p.id: p.project_name for p in db.scalars(select(Project).where(Project.id.in_(proj_ids))).all()} if proj_ids else {}
    account_name_by_id = {a.id: a.account_name for a in db.scalars(select(Account).where(Account.id.in_(account_ids))).all()} if account_ids else {}
    contact_name_by_id = {c.id: c.contact_name for c in db.scalars(select(Contact).where(Contact.id.in_(contact_ids))).all()} if contact_ids else {}
    subsidiary_name_by_id = {
        s.id: s.subsidiary_name for s in db.scalars(select(Subsidiary).where(Subsidiary.id.in_(subsidiary_ids))).all()
    } if subsidiary_ids else {}

    # System-generated rows (record_type == "System Generated") don't carry a single record_type
    # the way manually-logged activities do — log_system_activity() may set several FK columns at
    # once (e.g. approving a Lead Qualification sets both lead_id and the new opportunity_id). Pick
    # the most specific/most-recently-touched entity so the row links to the record that actually
    # changed, not just its parent Account.
    def resolve_system_type(a: Activity) -> str | None:
        if a.project_id:
            return "Project"
        if a.opportunity_id:
            return "Opportunity"
        if a.lead_id:
            return "Lead"
        if a.contact_id:
            return "Contact"
        if a.subsidiary_id:
            return "Subsidiary"
        if a.account_id:
            return "Account"
        return None

    def effective_type(a: Activity) -> str:
        if a.record_type == "System Generated":
            return resolve_system_type(a) or "System Generated"
        return a.record_type or "N/A"

    def linked_label(a: Activity, rtype_lower: str) -> str:
        if rtype_lower == "account":
            return a.account_name or account_name_by_id.get(a.account_id, "N/A")
        if rtype_lower == "subsidiary":
            return a.subsidiary_name or subsidiary_name_by_id.get(a.subsidiary_id, "N/A")
        if rtype_lower == "contact":
            return a.contact_name or contact_name_by_id.get(a.contact_id, "N/A")
        if rtype_lower == "lead":
            return lead_name.get(a.lead_id, "N/A")
        if rtype_lower == "opportunity":
            return opp_name.get(a.opportunity_id, "N/A")
        if rtype_lower == "project":
            return proj_name.get(a.project_id, "N/A")
        return "N/A"

    def linked_id(a: Activity, rtype_lower: str):
        return {
            "account": a.account_id, "subsidiary": a.subsidiary_id, "contact": a.contact_id,
            "lead": a.lead_id, "opportunity": a.opportunity_id, "project": a.project_id,
        }.get(rtype_lower)

    result = []
    for a in activities:
        etype = effective_type(a)
        rtype_lower = etype.lower()
        result.append({
            "id": a.id,
            "activity_name": a.activity_name,
            "record_type": etype,
            "is_system": a.record_type == "System Generated",
            "linked_record_id": linked_id(a, rtype_lower),
            "linked_label": linked_label(a, rtype_lower),
            "record_action": a.record_action or "N/A",
            "activity_date": a.activity_date.strftime("%Y-%m-%d %H:%M") if a.activity_date else "N/A",
            "next_step": a.next_step or "N/A",
            "next_action_date": a.next_action_date.isoformat() if a.next_action_date else None,
            "notes": a.notes or "",
        })
    return result


# =====================================================================
# Single-Record Detail Endpoints (feed the Edit forms with full field data)
# =====================================================================

@app.get("/api/account/{account_id}", dependencies=REQUIRE_LOGIN)
def get_account_detail(account_id: int, db: Session = Depends(get_db)):
    acc = db.scalar(select(Account).where(Account.id == account_id))
    if not acc:
        raise HTTPException(404, "Account not found.")
    return {
        "id": acc.id, "account_name": acc.account_name, "account_manager": acc.account_manager,
        "region": acc.region, "industry": acc.industry, "website": acc.website, "notes": acc.notes,
        "attributes": pack_attributes(acc),
    }


@app.get("/api/subsidiary/{subsidiary_id}", dependencies=REQUIRE_LOGIN)
def get_subsidiary_detail(subsidiary_id: int, db: Session = Depends(get_db)):
    sub = db.scalar(select(Subsidiary).where(Subsidiary.id == subsidiary_id))
    if not sub:
        raise HTTPException(404, "Subsidiary not found.")
    return {
        "id": sub.id, "account_id": sub.account_id, "subsidiary_name": sub.subsidiary_name,
        "region": sub.region, "industry": sub.industry, "notes": sub.notes,
        "attributes": pack_attributes(sub),
    }


@app.get("/api/contact/{contact_id}", dependencies=REQUIRE_LOGIN)
def get_contact_detail(contact_id: int, db: Session = Depends(get_db)):
    con = db.scalar(select(Contact).where(Contact.id == contact_id))
    if not con:
        raise HTTPException(404, "Contact not found.")
    return {
        "id": con.id, "account_id": con.account_id, "subsidiary_id": con.subsidiary_id,
        "contact_name": con.contact_name, "designation": con.designation, "department": con.department,
        "linkedin_url": con.linkedin_url, "email": con.email, "secondary_email": con.secondary_email,
        "mobile_country_code": con.mobile_country_code, "mobile": con.mobile,
        "secondary_mobile_country_code": con.secondary_mobile_country_code, "secondary_mobile": con.secondary_mobile,
        "notes": con.notes, "attributes": pack_attributes(con),
    }


@app.get("/api/lead/{lead_id}", dependencies=REQUIRE_LOGIN)
def get_lead_detail(lead_id: int, db: Session = Depends(get_db)):
    lead = db.scalar(select(Lead).where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(404, "Lead not found.")
    return {
        "id": lead.id, "account_id": lead.account_id, "subsidiary_id": lead.subsidiary_id,
        "contact_id": lead.contact_id, "lead_name": lead.lead_name, "account_manager": lead.account_manager,
        "deal_size": float(lead.deal_size) if lead.deal_size else None, "currency": lead.currency,
        "project_type": lead.project_type, "referred_by": lead.referred_by,
        "service_line": service_line_to_list(lead.service_line),
        "stage": lead.stage, "disqualification_reason": lead.disqualification_reason, "type": lead.type,
        "lead_source": lead.lead_source, "campaign_name": lead.campaign_name,
        "technology": lead.technology or [],
        "next_steps": lead.next_steps,
        "next_action_date": lead.next_action_date.isoformat() if lead.next_action_date else None,
        "notes": lead.notes, "attributes": pack_attributes(lead),
    }


@app.get("/api/opportunity/{opportunity_id}", dependencies=REQUIRE_LOGIN)
def get_opportunity_detail(opportunity_id: int, db: Session = Depends(get_db)):
    opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not opp:
        raise HTTPException(404, "Opportunity not found.")
    return {
        "id": opp.id, "lead_id": opp.lead_id, "account_id": opp.account_id, "subsidiary_id": opp.subsidiary_id,
        "contact_id": opp.contact_id, "opportunity_name": opp.opportunity_name,
        "account_manager": opp.account_manager,
        "deal_size": float(opp.deal_size) if opp.deal_size else None, "currency": opp.currency,
        "project_type": opp.project_type, "referred_by": opp.referred_by,
        "service_line": service_line_to_list(opp.service_line), "technology": opp.technology or [],
        "stage": opp.stage, "probability": opp.probability, "reason": opp.reason,
        "opportunity_type": opp.opportunity_type, "funded_by": opp.funded_by,
        "opportunity_source": opp.opportunity_source, "next_steps": opp.next_steps,
        "next_action_date": opp.next_action_date.isoformat() if opp.next_action_date else None,
        "expected_closure_date": opp.expected_closure_date.isoformat() if opp.expected_closure_date else None,
        "notes": opp.notes, "attributes": pack_attributes(opp),
    }


@app.get("/api/project/{project_id}", dependencies=REQUIRE_LOGIN)
def get_project_detail(project_id: int, db: Session = Depends(get_db)):
    proj = db.scalar(select(Project).where(Project.id == project_id))
    if not proj:
        raise HTTPException(404, "Project not found.")
    return {
        "id": proj.id, "opportunity_id": proj.opportunity_id, "account_id": proj.account_id,
        "subsidiary_id": proj.subsidiary_id, "contact_id": proj.contact_id, "project_name": proj.project_name,
        "technology": proj.technology or [],
        "value": float(proj.value) if proj.value else None, "currency": proj.currency,
        "start_date": proj.start_date.isoformat() if proj.start_date else None,
        "close_date": proj.close_date.isoformat() if proj.close_date else None,
        "po_status": proj.stage, "po_number": proj.po_number, "po_reason": proj.po_reason, "notes": proj.notes,
        "po_document_name": proj.po_document_name,
        "po_uploaded_at": proj.po_uploaded_at.isoformat() if proj.po_uploaded_at else None,
        "attributes": pack_attributes(proj),
    }


@app.get("/api/activity/{activity_id}", dependencies=REQUIRE_LOGIN)
def get_activity_detail(activity_id: int, db: Session = Depends(get_db)):
    act = db.scalar(select(Activity).where(Activity.id == activity_id))
    if not act:
        raise HTTPException(404, "Activity not found.")
    linked_id = {
        "account": act.account_id, "subsidiary": act.subsidiary_id, "contact": act.contact_id,
        "lead": act.lead_id, "opportunity": act.opportunity_id, "project": act.project_id,
    }.get((act.record_type or "").lower())
    return {
        "id": act.id, "activity_name": act.activity_name, "record_type": act.record_type,
        "linked_record_id": linked_id, "contact_id": act.contact_id, "record_action": act.record_action,
        "activity_date": act.activity_date.strftime("%Y-%m-%d %H:%M") if act.activity_date else None,
        "next_step": act.next_step,
        "next_action_date": act.next_action_date.isoformat() if act.next_action_date else None,
        "notes": act.notes, "attributes": pack_attributes(act),
    }


# =====================================================================
# Manual Form Save Endpoints (Direct POST from HTML Pages)
# =====================================================================

@app.post("/api/account/save", dependencies=REQUIRE_LOGIN)
def save_account_form(data: AccountFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    account = None
    if data.account_id:
        account = db.scalar(select(Account).where(Account.id == data.account_id))

    is_new = account is None
    old_name = account.account_name if account else None
    if not account:
        account = Account(account_name=data.account_name)
        db.add(account)

    account.account_name = data.account_name
    account.account_manager = data.account_manager
    account.region = data.region
    account.industry = data.industry
    account.website = data.website
    account.notes = data.notes
    apply_attributes(account, data.attributes)
    stamp_audit(account, user["uid"], is_new)
    db.flush()

    if is_new:
        log_system_activity(db, action="Account Created", user_id=user["uid"], account_id=account.id)
    elif old_name != data.account_name:
        log_system_activity(db, action="Editing Account name", user_id=user["uid"], account_id=account.id)

    db.commit()
    db.refresh(account)
    return {"status": "success", "account_id": account.id}


@app.post("/api/subsidiary/save", dependencies=REQUIRE_LOGIN)
def save_subsidiary_form(data: SubsidiaryFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    sub = None
    if data.subsidiary_id:
        sub = db.scalar(select(Subsidiary).where(Subsidiary.id == data.subsidiary_id))

    is_new = sub is None
    if not sub:
        sub = Subsidiary(account_id=data.account_id, subsidiary_name=data.subsidiary_name)
        db.add(sub)

    sub.account_id = data.account_id
    sub.subsidiary_name = data.subsidiary_name
    sub.region = data.region
    sub.industry = data.industry
    sub.notes = data.notes
    apply_attributes(sub, data.attributes)
    stamp_audit(sub, user["uid"], is_new)

    db.commit()
    db.refresh(sub)
    return {"status": "success", "subsidiary_id": sub.id}


@app.post("/api/contact/save", dependencies=REQUIRE_LOGIN)
def save_contact_form(data: ContactFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    contact = None
    if data.contact_id:
        contact = db.scalar(select(Contact).where(Contact.id == data.contact_id))

    is_new = contact is None
    old_name = contact.contact_name if contact else None
    if not contact:
        contact = Contact(account_id=data.account_id, contact_name=data.contact_name)
        db.add(contact)

    contact.account_id = data.account_id
    contact.subsidiary_id = data.subsidiary_id
    contact.contact_name = data.contact_name
    contact.designation = data.designation
    contact.department = data.department
    contact.email = data.email
    contact.secondary_email = data.secondary_email
    contact.mobile_country_code = data.mobile_country_code
    contact.mobile = data.mobile
    contact.secondary_mobile_country_code = data.secondary_mobile_country_code
    contact.secondary_mobile = data.secondary_mobile
    contact.linkedin_url = data.linkedin_url
    contact.notes = data.notes
    apply_attributes(contact, data.attributes)
    stamp_audit(contact, user["uid"], is_new)
    db.flush()

    if is_new:
        log_system_activity(db, action="Contact Created", user_id=user["uid"], contact_id=contact.id, account_id=contact.account_id)
    elif old_name != data.contact_name:
        log_system_activity(db, action="Editing Contact name", user_id=user["uid"], contact_id=contact.id, account_id=contact.account_id)

    db.commit()
    db.refresh(contact)
    return {"status": "success", "contact_id": contact.id}


@app.post("/api/lead/save", dependencies=REQUIRE_LOGIN)
def save_lead_form(data: LeadFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    lead = None
    if data.lead_id:
        lead = db.scalar(select(Lead).where(Lead.id == data.lead_id))

    is_new = lead is None
    old_stage = lead.stage if lead else None
    old_name = lead.lead_name if lead else None
    if not lead:
        lead = Lead(account_id=data.account_id, contact_id=data.contact_id, lead_name=data.lead_name)
        db.add(lead)

    lead.account_id = data.account_id
    lead.subsidiary_id = data.subsidiary_id
    lead.contact_id = data.contact_id
    lead.lead_name = data.lead_name
    lead.account_manager = data.account_manager
    lead.deal_size = data.deal_size
    lead.currency = data.currency
    lead.project_type = data.project_type
    lead.referred_by = data.referred_by
    lead.service_line = service_line_to_str(data.service_line)
    lead.stage = data.stage
    lead.disqualification_reason = data.disqualification_reason
    lead.type = data.type
    lead.lead_source = data.lead_source
    lead.campaign_name = data.campaign_name if data.lead_source == "Campaign" else None
    lead.technology = data.technology
    lead.next_steps = data.next_steps
    lead.next_action_date = data.next_action_date
    lead.notes = data.notes
    apply_attributes(lead, data.attributes)
    stamp_audit(lead, user["uid"], is_new)
    db.flush()

    if is_new:
        log_system_activity(db, action="Lead Created", user_id=user["uid"], lead_id=lead.id, account_id=lead.account_id)
    else:
        if old_stage != data.stage:
            log_system_activity(
                db, action=f"Lead Status Change: {old_stage} → {data.stage}",
                user_id=user["uid"], lead_id=lead.id, account_id=lead.account_id,
            )
        if old_name != data.lead_name:
            log_system_activity(db, action="Editing Lead name", user_id=user["uid"], lead_id=lead.id, account_id=lead.account_id)

    db.commit()
    db.refresh(lead)
    return {"status": "success", "lead_id": lead.id}


@app.post("/api/opportunity/save", dependencies=REQUIRE_LOGIN)
def save_opportunity_form(data: OpportunityFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    opp = None
    if data.opportunity_id:
        opp = db.scalar(select(Opportunity).where(Opportunity.id == data.opportunity_id))

    if opp is None and user["role"] == "Sales Representative":
        raise HTTPException(
            403,
            "Sales Representatives cannot create Opportunities directly — use Request for Qualification on the source Lead.",
        )

    is_new = opp is None
    old_stage = opp.stage if opp else None
    old_name = opp.opportunity_name if opp else None
    if not opp:
        opp = Opportunity(
            opportunity_name=data.opportunity_name,
            lead_id=data.lead_id,
            account_id=data.account_id,
            subsidiary_id=data.subsidiary_id,
            contact_id=data.contact_id,
            account_manager=data.account_manager,
            deal_size=data.deal_size,
            currency=data.currency,
            project_type=data.project_type,
            referred_by=data.referred_by,
            service_line=service_line_to_str(data.service_line),
            technology=data.technology,
            stage=data.stage,
            probability=data.probability,
            reason=data.reason,
            opportunity_type=data.opportunity_type,
            funded_by=data.funded_by,
            opportunity_source=data.opportunity_source,
            next_steps=data.next_steps,
            next_action_date=data.next_action_date,
            expected_closure_date=data.expected_closure_date,
            notes=data.notes,
        )
        db.add(opp)
    else:
        opp.opportunity_name = data.opportunity_name
        opp.account_manager = data.account_manager
        opp.deal_size = data.deal_size
        opp.currency = data.currency
        opp.project_type = data.project_type
        opp.referred_by = data.referred_by
        opp.service_line = service_line_to_str(data.service_line)
        opp.technology = data.technology
        opp.stage = data.stage
        opp.probability = data.probability
        opp.reason = data.reason
        opp.opportunity_type = data.opportunity_type
        opp.funded_by = data.funded_by
        opp.opportunity_source = data.opportunity_source
        opp.next_steps = data.next_steps
        opp.next_action_date = data.next_action_date
        opp.expected_closure_date = data.expected_closure_date
        opp.notes = data.notes

    apply_attributes(opp, data.attributes)
    stamp_audit(opp, user["uid"], is_new)

    db.flush()

    # Note: marking an Opportunity Closed Won no longer auto-creates a Project — a Team Lead must
    # request qualification (POST /api/qualifications/opportunity/{id}/request) and Admin must
    # approve it. See approve_qualification() below for the Project-creation logic this replaced.
    if is_new:
        log_system_activity(db, action="Opportunity Created", user_id=user["uid"], opportunity_id=opp.id, account_id=opp.account_id)
    else:
        if old_stage != data.stage:
            log_system_activity(
                db, action=f"Opportunity Stage Change from {old_stage} to {data.stage}",
                user_id=user["uid"], opportunity_id=opp.id, account_id=opp.account_id,
            )
        if old_name != data.opportunity_name:
            log_system_activity(db, action="Editing Opportunity name", user_id=user["uid"], opportunity_id=opp.id, account_id=opp.account_id)

    db.commit()
    return {"status": "success", "opportunity_id": opp.id}


class OpportunityClosureDateIn(BaseModel):
    expected_closure_date: date | None = None

    @field_validator("expected_closure_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        return resolve_relative_date(v)


@app.post("/api/opportunity/{opportunity_id}/expected-closure-date", dependencies=REQUIRE_DASHBOARD_VIEWER)
def update_opportunity_expected_closure_date(
    opportunity_id: int,
    data: OpportunityClosureDateIn,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Quick inline edit from the Home dashboard's Monthly Deal Tracker — updates only the
    expected closure date, without requiring the full Opportunity form payload."""
    require_write_access(user)
    opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    old_date = opp.expected_closure_date
    opp.expected_closure_date = data.expected_closure_date
    stamp_audit(opp, user["uid"], is_new=False)

    if old_date != data.expected_closure_date:
        log_system_activity(
            db, action=f"Expected Closure Date changed from {old_date} to {data.expected_closure_date}",
            user_id=user["uid"], opportunity_id=opp.id, account_id=opp.account_id,
        )

    db.commit()
    return {
        "status": "success",
        "opportunity_id": opp.id,
        "expected_closure_date": opp.expected_closure_date.isoformat() if opp.expected_closure_date else None,
    }


@app.post("/api/project/save", dependencies=REQUIRE_LOGIN)
def save_project_form(data: ProjectFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    proj = None
    if data.project_id:
        proj = db.scalar(select(Project).where(Project.id == data.project_id))

    if proj is None and user["role"] != "Admin":
        raise HTTPException(
            403,
            "Only Admin can create Projects directly — Projects are created by approving an Opportunity Qualification request.",
        )

    is_new = proj is None
    old_stage = proj.stage if proj else None
    if not proj:
        proj = Project(
            opportunity_id=data.opportunity_id,
            account_id=data.account_id,
            subsidiary_id=data.subsidiary_id,
            contact_id=data.contact_id,
            project_name=data.project_name,
            technology=data.technology,
            value=data.value,
            currency=data.currency,
            start_date=data.start_date,
            close_date=data.close_date,
            stage=data.po_status or "Awaited",
            po_number=data.po_number,
            po_reason=data.po_reason,
            notes=data.notes,
        )
        db.add(proj)
    else:
        proj.project_name = data.project_name
        proj.technology = data.technology
        proj.value = data.value
        proj.currency = data.currency
        proj.start_date = data.start_date
        proj.close_date = data.close_date
        proj.stage = data.po_status or "Awaited"
        proj.po_number = data.po_number
        proj.po_reason = data.po_reason
        proj.notes = data.notes

    apply_attributes(proj, data.attributes)
    stamp_audit(proj, user["uid"], is_new)
    db.flush()

    new_stage = data.po_status or "Awaited"
    if is_new:
        log_system_activity(db, action="Project Created", user_id=user["uid"], project_id=proj.id, account_id=proj.account_id)
    elif old_stage != new_stage:
        log_system_activity(
            db, action=f"Project Status Change from {old_stage} to {new_stage}",
            user_id=user["uid"], project_id=proj.id, account_id=proj.account_id,
        )

    db.commit()
    db.refresh(proj)
    return {"status": "success", "project_id": proj.id}


@app.post("/api/activity/save", dependencies=REQUIRE_LOGIN)
def save_activity_form(data: ActivityFormIn, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    require_write_access(user)
    act = None
    if data.activity_id:
        act = db.scalar(select(Activity).where(Activity.id == data.activity_id))

    is_new = act is None
    if not act:
        act = Activity(activity_name=data.activity_name, record_type=data.record_type)
        db.add(act)

    act.activity_name = data.activity_name
    act.record_type = data.record_type
    act.record_action = data.record_action
    act.notes = data.notes
    act.next_step = data.next_step
    act.next_action_date = resolve_relative_date(data.next_action_date)
    apply_attributes(act, data.attributes)
    stamp_audit(act, user["uid"], is_new)

    act.account_id = None
    act.subsidiary_id = None
    act.contact_id = None
    act.lead_id = None
    act.opportunity_id = None
    act.project_id = None

    rtype = data.record_type.lower()
    if rtype == "account":
        act.account_id = data.linked_record_id
    elif rtype == "subsidiary":
        act.subsidiary_id = data.linked_record_id
    elif rtype == "contact":
        act.contact_id = data.linked_record_id
    elif rtype == "lead":
        act.lead_id = data.linked_record_id
    elif rtype == "opportunity":
        act.opportunity_id = data.linked_record_id
    elif rtype == "project":
        act.project_id = data.linked_record_id

    # Independent contact tag (e.g. an Account-type activity that also names which
    # stakeholder it's about) — the Activity table carries account_id and contact_id
    # as separate nullable FKs, so this doesn't collide with the record_type mapping above.
    if data.contact_id and rtype != "contact":
        act.contact_id = data.contact_id

    db.commit()
    db.refresh(act)
    return {"status": "success", "activity_id": act.id}


# =====================================================================
# Admin: User Management (`user` table, also used for SSO sign-in)
# =====================================================================

@app.get("/api/roles", dependencies=REQUIRE_LOGIN)
def get_roles():
    return list(AUTH_ROLES)


@app.get("/api/users/overview", dependencies=REQUIRE_ADMIN)
def get_users_overview(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.desc())).all()

    result = []
    for u in users:
        result.append({
            "id": u.id,
            "user_name": u.user_name,
            "email_id": u.email_id,
            "designation": u.designation or "N/A",
            "region": u.region or "N/A",
            "phone": u.phone or "N/A",
            "role": u.role,
            "creation_date": u.creation_date.strftime("%Y-%m-%d %H:%M") if u.creation_date else "N/A",
            "can_sign_in": bool(u.is_active),
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        })
    return result


@app.get("/api/user/{user_id}", dependencies=REQUIRE_ADMIN)
def get_user_detail(user_id: int, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.id == user_id))
    if not u:
        raise HTTPException(404, "User not found.")
    return {
        "id": u.id, "user_name": u.user_name, "email_id": u.email_id,
        "designation": u.designation, "region": u.region, "phone": u.phone,
        "role": u.role,
    }


@app.post("/api/user/save", dependencies=REQUIRE_ADMIN)
def save_user_form(data: UserFormIn, db: Session = Depends(get_db)):
    email = data.email_id.strip().lower()

    # Upsert the `user` row (also grants sign-in access).
    user = None
    if data.user_id:
        user = db.scalar(select(User).where(User.id == data.user_id))
    if not user:
        user = db.scalar(select(User).where(User.email_id == email))
    if not user:
        user = User(email_id=email, user_name=data.user_name)
        db.add(user)

    user.user_name = data.user_name
    user.email_id = email
    user.designation = data.designation
    user.region = data.region
    user.phone = data.phone
    user.role = data.role
    user.is_active = True
    db.commit()
    db.refresh(user)

    return {"status": "success", "user_id": user.id}


# =====================================================================
# Qualification Requests
# Lead Qualification (Sales Representative -> Admin/Team Lead, approval auto-creates an
# Opportunity) and Opportunity Qualification (Team Lead -> Admin, approval auto-creates a
# Project). See the QualificationRequest model above.
# =====================================================================

@app.post("/api/qualifications/lead/{lead_id}/request", dependencies=REQUIRE_LOGIN)
def request_lead_qualification(lead_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] not in ("Sales Representative", "Admin"):
        raise HTTPException(403, "Only a Sales Representative can request Lead Qualification.")

    lead = db.scalar(select(Lead).where(Lead.id == lead_id))
    if not lead:
        raise HTTPException(404, "Lead not found.")

    existing = db.scalar(
        select(QualificationRequest).where(
            QualificationRequest.request_type == "lead_qualification",
            QualificationRequest.lead_id == lead_id,
            QualificationRequest.status == "Pending",
        )
    )
    if existing:
        raise HTTPException(409, "A qualification request for this Lead is already pending.")

    req = QualificationRequest(
        request_type="lead_qualification", lead_id=lead_id,
        requested_by_id=user["uid"], requested_by_name=user["name"],
    )
    db.add(req)
    db.flush()
    log_system_activity(db, action="Lead Qualification Requested", user_id=user["uid"], lead_id=lead_id, account_id=lead.account_id)
    db.commit()
    return {"status": "success", "request_id": req.id}


@app.post("/api/qualifications/opportunity/{opportunity_id}/request", dependencies=REQUIRE_LOGIN)
def request_opportunity_qualification(opportunity_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user["role"] not in ("Team Lead", "Admin"):
        raise HTTPException(403, "Only a Team Lead can request Opportunity Qualification.")

    opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not opp:
        raise HTTPException(404, "Opportunity not found.")
    if "Closed Won" not in (opp.stage or ""):
        raise HTTPException(400, "Only a Closed Won Opportunity can be sent for Project qualification.")

    if db.scalar(select(Project).where(Project.opportunity_id == opportunity_id)):
        raise HTTPException(409, "A Project already exists for this Opportunity.")

    existing_req = db.scalar(
        select(QualificationRequest).where(
            QualificationRequest.request_type == "opportunity_qualification",
            QualificationRequest.opportunity_id == opportunity_id,
            QualificationRequest.status == "Pending",
        )
    )
    if existing_req:
        raise HTTPException(409, "A qualification request for this Opportunity is already pending.")

    req = QualificationRequest(
        request_type="opportunity_qualification", opportunity_id=opportunity_id,
        requested_by_id=user["uid"], requested_by_name=user["name"],
    )
    db.add(req)
    db.flush()
    log_system_activity(db, action="Opportunity Qualification Requested", user_id=user["uid"], opportunity_id=opportunity_id, account_id=opp.account_id)
    db.commit()
    return {"status": "success", "request_id": req.id}


@app.get("/api/qualifications/overview", dependencies=REQUIRE_QUALIFICATION_VIEWER)
def get_qualifications_overview(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    reqs = db.scalars(select(QualificationRequest).order_by(QualificationRequest.id.desc())).all()

    lead_ids = {r.lead_id for r in reqs if r.lead_id}
    opp_ids = {r.opportunity_id for r in reqs if r.opportunity_id}
    lead_name = {l.id: l.lead_name for l in db.scalars(select(Lead).where(Lead.id.in_(lead_ids))).all()} if lead_ids else {}
    opp_name = {o.id: o.opportunity_name for o in db.scalars(select(Opportunity).where(Opportunity.id.in_(opp_ids))).all()} if opp_ids else {}

    is_admin = user["role"] == "Admin"
    is_team_lead = user["role"] == "Team Lead"
    result = []
    for r in reqs:
        result.append({
            "id": r.id,
            "request_type": r.request_type,
            "linked_label": lead_name.get(r.lead_id) if r.request_type == "lead_qualification" else opp_name.get(r.opportunity_id),
            "lead_id": r.lead_id,
            "opportunity_id": r.opportunity_id,
            "status": r.status,
            "requested_by_name": r.requested_by_name,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "decided_at": r.decided_at.isoformat() if r.decided_at else None,
            "can_approve": is_admin or (is_team_lead and r.request_type == "lead_qualification"),
        })
    return result


def _approve_lead_qualification(req: "QualificationRequest", db: Session, user_id: int) -> int:
    lead = db.scalar(select(Lead).where(Lead.id == req.lead_id))
    if not lead:
        raise HTTPException(404, "Source Lead no longer exists.")
    opp = Opportunity(
        opportunity_name=lead.lead_name,
        lead_id=lead.id,
        account_id=lead.account_id,
        subsidiary_id=lead.subsidiary_id,
        contact_id=lead.contact_id,
        account_manager=lead.account_manager,
        deal_size=lead.deal_size,
        currency=lead.currency or "AED",
        project_type=lead.project_type,
        referred_by=lead.referred_by,
        service_line=lead.service_line,
        technology=lead.technology,
        stage="Discovery — 40%",
        probability=40,
        opportunity_type="New",
        funded_by="Client",
        opportunity_source=lead.lead_source if (lead.lead_source and lead.lead_source != "Campaign") else None,
        next_steps=lead.next_steps,
        next_action_date=lead.next_action_date,
        notes=lead.notes,
    )
    apply_attributes(opp, pack_attributes(lead))
    stamp_audit(opp, user_id, True)
    db.add(opp)
    db.flush()
    log_system_activity(
        db, action="Lead Qualification Approved — Opportunity Created", user_id=user_id,
        lead_id=lead.id, opportunity_id=opp.id, account_id=lead.account_id,
    )
    return opp.id


def _approve_opportunity_qualification(req: "QualificationRequest", db: Session, user_id: int) -> int:
    opp = db.scalar(select(Opportunity).where(Opportunity.id == req.opportunity_id))
    if not opp:
        raise HTTPException(404, "Source Opportunity no longer exists.")
    proj = Project(
        opportunity_id=opp.id,
        account_id=opp.account_id,
        subsidiary_id=opp.subsidiary_id,
        contact_id=opp.contact_id,
        project_name=f"{opp.opportunity_name} — Delivery",
        technology=opp.technology,
        value=opp.deal_size,
        currency=opp.currency,
        stage="Awaited",
    )
    stamp_audit(proj, user_id, True)
    db.add(proj)
    db.flush()
    log_system_activity(
        db, action="Opportunity Qualification Approved — Project Created", user_id=user_id,
        opportunity_id=opp.id, project_id=proj.id, account_id=opp.account_id,
    )
    return proj.id


@app.post("/api/qualifications/{request_id}/approve", dependencies=REQUIRE_LOGIN)
def approve_qualification(request_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.scalar(select(QualificationRequest).where(QualificationRequest.id == request_id))
    if not req:
        raise HTTPException(404, "Qualification request not found.")
    if req.status != "Pending":
        raise HTTPException(409, f"This request has already been {req.status.lower()}.")

    if req.request_type == "lead_qualification":
        if user["role"] not in ("Admin", "Team Lead"):
            raise HTTPException(403, "Only Admin or Team Lead can approve a Lead Qualification request.")
        req.result_opportunity_id = _approve_lead_qualification(req, db, user["uid"])
    elif req.request_type == "opportunity_qualification":
        if user["role"] != "Admin":
            raise HTTPException(403, "Only Admin can approve an Opportunity Qualification request.")
        req.result_project_id = _approve_opportunity_qualification(req, db, user["uid"])
    else:
        raise HTTPException(400, "Unknown request type.")

    req.status = "Approved"
    req.decided_by_id = user["uid"]
    req.decided_at = datetime.now()
    db.commit()
    return {
        "status": "success", "request_id": req.id,
        "result_opportunity_id": req.result_opportunity_id, "result_project_id": req.result_project_id,
    }


@app.post("/api/qualifications/{request_id}/revoke", dependencies=REQUIRE_LOGIN)
def revoke_qualification(request_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    req = db.scalar(select(QualificationRequest).where(QualificationRequest.id == request_id))
    if not req:
        raise HTTPException(404, "Qualification request not found.")
    if req.status != "Pending":
        raise HTTPException(409, f"This request has already been {req.status.lower()}.")

    if req.request_type == "lead_qualification" and user["role"] not in ("Admin", "Team Lead"):
        raise HTTPException(403, "Only Admin or Team Lead can revoke a Lead Qualification request.")
    if req.request_type == "opportunity_qualification" and user["role"] != "Admin":
        raise HTTPException(403, "Only Admin can revoke an Opportunity Qualification request.")

    req.status = "Revoked"
    req.decided_by_id = user["uid"]
    req.decided_at = datetime.now()
    log_system_activity(
        db, action=f"{'Lead' if req.request_type == 'lead_qualification' else 'Opportunity'} Qualification Revoked",
        user_id=user["uid"], lead_id=req.lead_id, opportunity_id=req.opportunity_id,
    )
    db.commit()
    return {"status": "success", "request_id": req.id}


# =====================================================================
# Telemetry Retrieval Endpoint
# =====================================================================

@app.get("/api/voice/telemetry", dependencies=REQUIRE_LOGIN)
def get_telemetry(date_str: str | None = Query(None, alias="date")):
    target_date = date_str or datetime.now().strftime("%Y-%m-%d")
    log_file = LOGS_DIR / f"crm_telemetry_{target_date}.json"

    if not log_file.exists():
        return {
            "date": target_date,
            "total_calls": 0,
            "total_stt_cost_inr": 0.0,
            "total_llm_cost_usd": 0.0,
            "total_tokens": 0,
            "sessions": [],
        }

    try:
        with open(log_file, "r", encoding="utf-8") as f:
            sessions = json.load(f)
            if not isinstance(sessions, list):
                sessions = [sessions]
    except Exception:
        sessions = []

    total_stt_cost = sum(s.get("telemetry", {}).get("costs", {}).get("stt_cost_inr", 0.0) for s in sessions)
    total_llm_cost = sum(s.get("telemetry", {}).get("costs", {}).get("llm_cost_usd", 0.0) for s in sessions)
    total_tokens = sum(s.get("telemetry", {}).get("tokens", {}).get("total_tokens", 0) for s in sessions)

    return {
        "date": target_date,
        "total_calls": len(sessions),
        "total_stt_cost_inr": round(total_stt_cost, 6),
        "total_llm_cost_usd": round(total_llm_cost, 6),
        "total_tokens": total_tokens,
        "sessions": sessions[-25:],
    }


@app.get("/api/voice/drafts", dependencies=REQUIRE_LOGIN)
def get_voice_drafts(db: Session = Depends(get_db)):
    drafts = db.scalars(
        select(VoiceDraft).order_by(VoiceDraft.id.desc()).limit(30)
    ).all()

    res = []
    for d in drafts:
        raw_ext = {}
        if d.extracted_json:
            try:
                raw_ext = json.loads(d.extracted_json)
            except Exception:
                raw_ext = {}
        if not isinstance(raw_ext, dict):
            raw_ext = {}
        for key in ["account", "subsidiary", "contact", "lead", "opportunity"]:
            if key not in raw_ext or not isinstance(raw_ext.get(key), dict):
                raw_ext[key] = {}

        res.append({
            "id": d.id,
            "target_entity": d.target_entity,
            "raw_transcript": d.raw_transcript,
            "extracted_data": raw_ext,
            "missing_fields": d.missing_fields or [],
            "clarification_prompt": d.clarification_prompt,
            "status": d.status,
            "creation_date": d.creation_date.strftime("%Y-%m-%d %H:%M") if d.creation_date else "N/A",
        })
    return res


# =====================================================================
# Voice Ingestion Endpoint (AWS Transcribe + Bedrock Sonnet 5)
# =====================================================================

@app.post("/api/voice/process", dependencies=REQUIRE_LOGIN)
async def process_voice(
    audio: UploadFile = File(...),
    user_email: str | None = Form(None),
    user_phone: str | None = Form(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = user["uid"]
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(400, "Please upload a valid audio recording.")

    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty audio recording buffer.")
    if len(data) > settings().max_audio_mb * 1024 * 1024:
        raise HTTPException(413, f"Audio file exceeds {settings().max_audio_mb} MB limit.")

    fd, path = tempfile.mkstemp(prefix="sarvam_voice_", suffix=os.path.splitext(audio.filename or ".webm")[1])
    os.close(fd)
    start_total = time.perf_counter()

    try:
        with open(path, "wb") as f:
            f.write(data)

        wav_bytes, duration_sec = convert_to_wav_16k(path)

        start_transcribe = time.perf_counter()
        transcript = await _stt_service.transcribe(wav_bytes, duration_sec)
        transcribe_ms = int((time.perf_counter() - start_transcribe) * 1000)

        start_llm = time.perf_counter()
        payload, input_tokens, output_tokens = await _chat_service.extract(transcript)
        llm_ms = int((time.perf_counter() - start_llm) * 1000)
        total_ms = int((time.perf_counter() - start_total) * 1000)

        deterministic_transcript_fallback(payload, transcript)
        missing_fields, clarification_prompt = evaluate_mandatory_fields(payload, transcript)

        # Sarvam Saaras STT: ₹30/hour, 15-second minimum billing increment
        billable_seconds = max(15.0, duration_sec)
        stt_cost_inr = (billable_seconds / 3600.0) * 30.0

        # AWS Bedrock Claude Sonnet 5: $2.00/1M input tokens, $10.00/1M output tokens
        llm_input_cost = (input_tokens / 1_000_000.0) * 2.0
        llm_output_cost = (output_tokens / 1_000_000.0) * 10.0
        llm_cost_usd = llm_input_cost + llm_output_cost
        # STT (INR) and LLM (USD) are billed in different currencies — reported separately below,
        # not summed into a single misleading "total_cost".

        extracted_dict = payload.model_dump(mode="json")
        for key in ["account", "subsidiary", "contact", "lead", "opportunity"]:
            if key not in extracted_dict or not isinstance(extracted_dict.get(key), dict):
                extracted_dict[key] = {}

        draft = VoiceDraft(
            user_id=user_id,
            user_email=user_email,
            user_phone=user_phone,
            raw_transcript=transcript,
            target_entity=payload.intent,
            extracted_json=json.dumps(extracted_dict),
            missing_fields=missing_fields,
            clarification_prompt=clarification_prompt,
            status="INCOMPLETE" if missing_fields else "STAGED_READY",
        )
        db.add(draft)
        db.commit()

        if missing_fields:
            send_notification_alert(
                recipient_email=user_email,
                phone=user_phone,
                draft_id=draft.id,
                summary=transcript,
                questions=clarification_prompt,
            )

        telemetry = {
            "tokens": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            },
            "costs": {
                "stt_cost_inr": round(stt_cost_inr, 6),
                "llm_cost_usd": round(llm_cost_usd, 6),
                "details": {
                    "audio_duration_sec": round(duration_sec, 2),
                    "billable_seconds": round(billable_seconds, 2),
                },
            },
            "latency": {
                "transcribe_ms": transcribe_ms,
                "llm_ms": llm_ms,
                "backend_total_ms": total_ms,
            },
        }

        log_telemetry_entry({
            "timestamp": datetime.now().isoformat(),
            "draft_id": draft.id,
            "intent": payload.intent,
            "transcript": transcript,
            "missing_fields": missing_fields,
            "telemetry": telemetry,
        })

        return {
            "status": "draft_saved_incomplete" if missing_fields else "draft_ready_for_review",
            "draft_id": draft.id,
            "intent": payload.intent,
            "transcript": transcript,
            "extracted_data": extracted_dict,
            "missing_fields": missing_fields,
            "clarification_prompt": clarification_prompt,
            "telemetry": telemetry,
        }

    except Exception as exc:
        db.rollback()
        raise HTTPException(500, f"Voice Ingestion Pipeline Error: {exc}") from exc
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post("/api/voice/draft/{draft_id}/resume", dependencies=REQUIRE_LOGIN)
async def resume_voice_draft(
    draft_id: int,
    additional_audio: UploadFile | None = File(None),
    additional_text: str | None = Form(None),
    db: Session = Depends(get_db),
):
    draft = db.scalar(select(VoiceDraft).where(VoiceDraft.id == draft_id))
    if not draft:
        raise HTTPException(404, "Draft record not found.")
    if draft.status == "COMPLETED":
        raise HTTPException(400, "Draft is already finalized.")

    started = time.perf_counter()
    supplementary_text = ""
    transcribe_ms = 0
    duration_sec = 0.0

    if additional_audio:
        fd, path = tempfile.mkstemp(prefix="crm_draft_patch_", suffix=".webm")
        os.close(fd)
        try:
            with open(path, "wb") as f:
                f.write(await additional_audio.read())
            wav_bytes, duration_sec = convert_to_wav_16k(path)
            t_t0 = time.perf_counter()
            supplementary_text = await _stt_service.transcribe(wav_bytes, duration_sec)
            transcribe_ms = int((time.perf_counter() - t_t0) * 1000)
        finally:
            if os.path.exists(path):
                os.remove(path)
    elif additional_text:
        supplementary_text = additional_text.strip()
    else:
        raise HTTPException(400, "Provide supplementary audio or text input.")

    merged_transcript = f"{draft.raw_transcript}. Follow-up details: {supplementary_text}"
    t_llm0 = time.perf_counter()
    updated_payload, input_tokens, output_tokens = await _chat_service.extract(merged_transcript)
    llm_ms = int((time.perf_counter() - t_llm0) * 1000)

    deterministic_transcript_fallback(updated_payload, merged_transcript)
    missing_fields, clarification_prompt = evaluate_mandatory_fields(updated_payload, merged_transcript)
    total_backend_ms = int((time.perf_counter() - started) * 1000)

    billable_seconds = max(15.0, duration_sec) if duration_sec > 0 else 0.0
    stt_cost_inr = (billable_seconds / 3600.0) * 30.0 if billable_seconds > 0 else 0.0

    # AWS Bedrock Claude Sonnet 5: $2.00/1M input tokens, $10.00/1M output tokens
    llm_cost_usd = ((input_tokens / 1_000_000.0) * 2.0) + ((output_tokens / 1_000_000.0) * 10.0)

    extracted_dict = updated_payload.model_dump(mode="json")
    for key in ["account", "subsidiary", "contact", "lead", "opportunity"]:
        if key not in extracted_dict or not isinstance(extracted_dict.get(key), dict):
            extracted_dict[key] = {}

    draft.raw_transcript = merged_transcript
    draft.extracted_json = json.dumps(extracted_dict)
    draft.missing_fields = missing_fields
    draft.clarification_prompt = clarification_prompt
    draft.status = "INCOMPLETE" if missing_fields else "STAGED_READY"
    db.commit()

    telemetry = {
        "tokens": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        },
        "costs": {
            "stt_cost_inr": round(stt_cost_inr, 6),
            "llm_cost_usd": round(llm_cost_usd, 6),
        },
        "latency": {
            "transcribe_ms": transcribe_ms,
            "llm_ms": llm_ms,
            "backend_total_ms": total_backend_ms,
        },
    }

    log_telemetry_entry({
        "timestamp": datetime.now().isoformat(),
        "draft_id": draft.id,
        "action": "resumed_draft",
        "transcript": merged_transcript,
        "missing_fields": missing_fields,
        "telemetry": telemetry,
    })

    return {
        "status": "draft_saved_incomplete" if missing_fields else "draft_ready_for_review",
        "draft_id": draft.id,
        "intent": updated_payload.intent,
        "transcript": merged_transcript,
        "extracted_data": extracted_dict,
        "missing_fields": missing_fields,
        "clarification_prompt": clarification_prompt,
        "telemetry": telemetry,
    }


@app.post("/api/voice/commit", dependencies=REQUIRE_LOGIN)
async def commit_voice_records(payload: ConfirmedCommitPayload, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    started = time.perf_counter()
    payload.user_id = user["uid"]  # always the signed-in user, never client-supplied

    if payload.intent in ["create_lead", "create_opportunity"]:
        if not payload.account.account_name:
            raise HTTPException(422, "Cannot commit without enterprise Account Name.")
        if not payload.contact.contact_name:
            raise HTTPException(422, "Cannot commit without Contact Stakeholder Name.")
    elif payload.intent == "create_account":
        if not payload.account.account_name:
            raise HTTPException(422, "Cannot commit without Account Name.")
    elif payload.intent == "create_contact":
        if not payload.account.account_name:
            raise HTTPException(422, "Cannot commit contact without associated Account Name.")
        if not payload.contact.contact_name:
            raise HTTPException(422, "Cannot commit without Contact Name.")

    try:
        created_records = execute_full_hierarchy_commit(db, payload)
        if payload.draft_id:
            draft = db.scalar(select(VoiceDraft).where(VoiceDraft.id == payload.draft_id))
            if draft:
                draft.status = "COMPLETED"
                draft.missing_fields = []
                draft.clarification_prompt = None
                db.commit()

        interaction = VoiceInteraction(
            transcript=f"Confirmed commit for {payload.intent}",
            intent=payload.intent,
            extracted_json=json.dumps(payload.model_dump(mode="json")),
            status="success",
            processing_ms=int((time.perf_counter() - started) * 1000),
        )
        db.add(interaction)
        db.commit()

        return {
            "status": "committed",
            "intent": payload.intent,
            "created_records": created_records,
            "commit_ms": int((time.perf_counter() - started) * 1000),
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(500, f"Database transaction failed: {exc}") from exc



# =====================================================================
# React SPA Static Serving (production build) — registered last so it
# never shadows an /api/* route above it.
# =====================================================================

@app.get("/{full_path:path}")
def serve_spa(full_path: str, request: Request):
    # An unmatched /api/* path is a real 404, not a client route — never mask it with the SPA shell.
    if full_path.startswith("api/"):
        raise HTTPException(404, "Not found.")

    # Serve a real dist-root file (favicon.svg, icons.svg, ...) directly when the
    # request matches one. These are public, non-sensitive static files. Unlike the
    # content-hashed files under /assets/, these keep a stable filename across builds
    # (logo swaps, favicon changes), so they must never be cached by the browser.
    candidate = (FRONTEND_DIST_DIR / full_path).resolve()
    if full_path and candidate.is_file() and FRONTEND_DIST_DIR.resolve() in candidate.parents:
        return FileResponse(str(candidate), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    # Every real page of the CRM (index.html and all client-side routes) needs a signed-in user;
    # signed-out visitors are sent to /login.
    get_current_user_page(request)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(404, "Frontend build not found. Run `npm run build` in frontend/.")

    # index.html references the current build's hashed JS/CSS bundle — it must never be
    # cached, or the browser can keep running an old bundle indefinitely after a rebuild.
    return FileResponse(str(index_file), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
