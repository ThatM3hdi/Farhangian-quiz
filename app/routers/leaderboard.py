import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import database, models, schemas

router = APIRouter()
logger = logging.getLogger("leaderboard")


@router.get("/", response_model=schemas.LeaderboardOut)
def get_leaderboard(db: Session = Depends(database.get_db)):
    """
    Returns every student sorted by score, descending — polled every few
    seconds by index.html. No auth required; this is meant to be visible
    on the classroom screen at all times (before, during, and after the game).

    Ties are broken by created_at ascending, so whoever reached a given
    score first (i.e. registered earlier and answered correctly sooner)
    ranks above someone who reaches the same score later.
    """
    students = (
        db.query(models.Student)
        .order_by(models.Student.score.desc(), models.Student.created_at.asc())
        .all()
    )
    return schemas.LeaderboardOut(students=students)
