import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
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

@router.post("/register", response_model=schemas.StudentOut)
def register_student(
    student: schemas.StudentCreate,
    request: Request,
    response: Response,
    db: Session = Depends(database.get_db),
):
    name = student.name.strip()
    if not name:
        logger.warning("Registration rejected: empty name submitted")
        raise HTTPException(status_code=400, detail="نام نمی‌تواند خالی باشد")

    # X-Forwarded-For first, since ParsPack's reverse proxy sits in front of you —
    # request.client.host alone would just be the proxy's own IP otherwise.
    forwarded = request.headers.get("x-forwarded-for")
    ip_address = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else None
    )
    device_info = request.headers.get("user-agent")

    token = secrets.token_urlsafe(32)
    db_student = models.Student(
        name=name,
        session_token=token,
        score=0,
        ip_address=ip_address,
        device_info=device_info,
    )
    db.add(db_student)