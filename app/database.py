import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Resolve the DB file relative to this module's own location (app/), not the
# process's current working directory. WORKDIR in the container is /code,
# but only ./app is bind-mounted to /code/app — so a cwd-relative path like
# "sqlite:///./game.db" would silently create the file *outside* the mounted
# volume and lose all data on every rebuild. Anchoring it to this file's
# folder keeps it inside app/, where it actually persists.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'game.db')}"

# connect_args={"check_same_thread": False} Required only for SQLite in FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency to get database session in APIs
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
