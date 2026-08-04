from typing import Optional

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app import database, models


def get_current_student(
    session_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(database.get_db),
) -> models.Student:
    """
    Resolves the currently-authenticated student from their session_token cookie.

    This is the ONLY source of student identity anywhere in the app — a
    student id must never be trusted from a request body or query param, or
    any client could act on behalf of someone else. Shared by lobby.py
    (the /me endpoint) and game.py (question/answer endpoints).
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="شما هنوز وارد بازی نشده‌اید")

    student = (
        db.query(models.Student)
        .filter(models.Student.session_token == session_token)
        .first()
    )
    if student is None:
        raise HTTPException(
            status_code=401, detail="نشست شما معتبر نیست، دوباره از لابی وارد شوید"
        )

    return student
