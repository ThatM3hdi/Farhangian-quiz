import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
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

    Each row also carries accuracy: % correct out of the questions this
    student has actually answered so far — not out of the whole question
    bank, so someone mid-quiz on question 5 isn't shown a misleadingly low
    number just for not having reached question 15 yet.
    """
    students = (
        db.query(models.Student)
        .order_by(models.Student.score.desc(), models.Student.created_at.asc())
        .all()
    )

    # یک کوئری تجمیعی برای همه‌ی دانش‌آموزها، به‌جای زدن N کوئری جدا برای
    # هر ردیف لیدربرد (که با پولینگ هر ۵ ثانیه، فشار غیرضروری روی دیتابیس
    # می‌گذاشت).
    answered_counts = dict(
        db.query(models.StudentAnswer.student_id, func.count(models.StudentAnswer.id))
        .group_by(models.StudentAnswer.student_id)
        .all()
    )
    correct_counts = dict(
        db.query(models.StudentAnswer.student_id, func.count(models.StudentAnswer.id))
        .filter(models.StudentAnswer.is_correct.is_(True))
        .group_by(models.StudentAnswer.student_id)
        .all()
    )

    entries = []
    for student in students:
        answered_count = answered_counts.get(student.id, 0)
        correct_count = correct_counts.get(student.id, 0)
        accuracy = round((correct_count / answered_count) * 100) if answered_count else None

        entries.append(
            schemas.LeaderboardEntryOut(
                id=student.id,
                name=student.name,
                score=student.score,
                answered_count=answered_count,
                accuracy=accuracy,
            )
        )

    return schemas.LeaderboardOut(students=entries)
