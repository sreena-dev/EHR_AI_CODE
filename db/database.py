"""
Database engine setup — SQLite via SQLAlchemy.
Swap DATABASE_URL to postgresql+asyncpg://... for production.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
import logging

logger = logging.getLogger(__name__)

# ─── Database URL ───────────────────────────────────────────────
# Default: SQLite file stored in <project>/data/ehr.db
_DB_DIR = Path(__file__).resolve().parent.parent / "data"
_DB_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DB_DIR / 'ehr.db'}")

# ─── Engine ─────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,  # Set True for SQL debugging
    pool_pre_ping=True,
)

# Enable SQLite WAL mode + foreign keys (performance + integrity)
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# ─── Session factory ────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ─── Declarative base ──────────────────────────────────────────
Base = declarative_base()


def get_db():
    """
    FastAPI dependency — yields a DB session per request.
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all tables and seed initial data.
    Called once at app startup.
    """
    # Import models so Base.metadata knows about them
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    logger.info(f"Database tables created/verified at: {DATABASE_URL}")

    # Seed default data if tables are empty
    from .seed import seed_default_data
    db = SessionLocal()
    try:
        seed_default_data(db)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Seed data error: {e}")
    finally:
        db.close()
