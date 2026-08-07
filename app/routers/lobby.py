import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import database, models, schemas
from app.dependencies import get_current_student

router = APIRouter()
logger = logging.getLogger("lobby")

SESSION_COOKIE_NAME = "session_token"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 12


@router.post("/register", response_model=schemas.StudentOut)
def register_student(
    student: schemas.StudentCreate,
    response: Response,
    db: Session = Depends(database.get_db),
):
    """
    Registers a new student in the lobby and sets their session_token as an
    HttpOnly cookie. Identity for every later request (answers, etc.) must be
    resolved from this cookie server-side — never from a client-supplied id.
    """
    name = student.name.strip()
    if not name:
        logger.warning("Registration rejected: empty name submitted")
        raise HTTPException(status_code=400, detail="نام نمی‌تواند خالی باشد")

    token = secrets.token_urlsafe(32)
    db_student = models.Student(name=name, session_token=token, score=0)
    db.add(db_student)

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Registration failed for name=%s", name)
        raise HTTPException(status_code=500, detail="خطا در ثبت‌نام، دوباره تلاش کنید")

    db.refresh(db_student)
    logger.info("Student registered: id=%s name=%s", db_student.id, db_student.name)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
    )

    return db_student


@router.get("/me", response_model=schemas.StudentOut)
def get_my_registration(
    current_student: models.Student = Depends(get_current_student),
):
    """
    Lets the frontend check, on page load, whether this browser already has a
    valid registration — so refreshing lobby.html resumes the waiting/game
    screen instead of showing the registration form again. Necessary because
    session_token is an HttpOnly cookie (on purpose, for security), so
    JavaScript can't just read it directly to check.
    """
    return current_student


@router.get("/status", response_model=schemas.GameStatusOut)
def get_game_status(db: Session = Depends(database.get_db)):
    """Returns the current game status (waiting / playing / finished) for lobby polling."""
    game_state = db.query(models.GameState).first()

    if game_state is None:
        logger.error("Game_State row missing — was startup_event() run?")
        raise HTTPException(
            status_code=500,
            detail="وضعیت بازی تعریف نشده است. این مشکل از شما نیست، به پشتیبانی اطلاع دهید.",
        )

    return game_state


@router.get("/settings", response_model=schemas.GameSettingsOut)
def get_public_settings(db: Session = Depends(database.get_db)):
    """
    Public, read-only view of the timing settings (game_time, guid_time), so
    the frontend (lobby countdown, and later the in-game timer) always
    matches whatever the admin has configured — no login needed, since these
    are just two durations, not sensitive data. Contrast with
    app/routers/admin.py's /settings, which allows *changing* them and is
    admin-only.
    """
    settings = db.query(models.GameSettings).first()
    if settings is None:
        raise HTTPException(status_code=500, detail="تنظیمات بازی تعریف نشده است")
    return settings
