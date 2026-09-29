from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import settings

DEMO_EMAIL_SUFFIX = "@dataphi.demo"

DEMO_USERS = [
    ("admin@dataphi.demo", "Demo Admin", "Admin"),
    ("executive@dataphi.demo", "Demo Executive", "Executive"),
    ("lead@dataphi.demo", "Demo Team Lead", "Team Lead"),
    ("rep@dataphi.demo", "Demo Sales Rep", "Sales Rep"),
]


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    url = settings().database_url
    # sqlite (used by the automated tests) refuses to be shared between threads unless told otherwise
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


@lru_cache
def _sessionmaker():
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def SessionLocal():
    return _sessionmaker()()


def init_db() -> None:
    """Create the users table. Demo mode adds test users; microsoft mode removes them."""
    from .models import User

    Base.metadata.create_all(bind=get_engine())
    db = SessionLocal()
    try:
        if settings().mode == "demo":
            for email, name, role in DEMO_USERS:
                if not db.query(User).filter(User.email == email).first():
                    db.add(User(email=email, full_name=name, role=role))
        else:
            db.query(User).filter(User.email.like(f"%{DEMO_EMAIL_SUFFIX}")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
