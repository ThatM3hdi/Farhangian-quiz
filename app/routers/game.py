import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import database, models, schemas
from app.dependencies import get_current_student

router = APIRouter()
logger = logging.getLogger("game")


def _ensure_game_is_playing(db: Session) -> None:
    """
    Blocks question/answer endpoints unless the admin has actually started the
    game. Without this, a student could hit these endpoints directly (skipping
    the lobby's countdown) before "شروع بازی", or keep submitting answers
    after the admin has pressed "پایان بازی".
    """
    game_state = db.query(models.GameState).first()
    if game_state is None or game_state.status != "playing":
        raise HTTPException(status_code=403, detail="بازی در حال حاضر فعال نیست")


@router.get("/question/{question_id}", response_model=schemas.QuestionOut)
def get_question(
    question_id: int,
    current_student: models.Student = Depends(get_current_student),
    db: Session = Depends(database.get_db),
):
    """Returns a question and its four options. correct_option is never included
    (schemas.QuestionOut doesn't have that field, so there's nothing to leak)."""
    _ensure_game_is_playing(db)

    question = (
        db.query(models.Question).filter(models.Question.id == question_id).first()
    )
    if question is None:
        # No question with this id => the quiz is over for this student.
        # The frontend should treat a 404 with detail "finished" as the
        # cue to redirect to the leaderboard.
        logger.info(
            "Student id=%s reached the end of the quiz (requested question_id=%s)",
            current_student.id,
            question_id,
        )
        raise HTTPException(status_code=404, detail="finished")

    return question


@router.post("/answer", response_model=schemas.AnswerResultOut)
def submit_answer(
    answer: schemas.AnswerSubmit,
    current_student: models.Student = Depends(get_current_student),
    db: Session = Depends(database.get_db),
):
    """
    Grades a submitted answer, updates the student's score if correct, and
    logs the attempt in student_answers. Rejects a second submission for a
    question the student has already answered (checked in-app, and backed by
    a DB-level unique constraint in case of a race between two near-
    simultaneous requests).
    """
    _ensure_game_is_playing(db)

    question = (
        db.query(models.Question)
        .filter(models.Question.id == answer.question_id)
        .first()
    )
    if question is None:
        raise HTTPException(status_code=404, detail="سوال مورد نظر یافت نشد")

    already_answered = (
        db.query(models.StudentAnswer)
        .filter(
            models.StudentAnswer.student_id == current_student.id,
            models.StudentAnswer.question_id == answer.question_id,
        )
        .first()
    )
    if already_answered is not None:
        logger.warning(
            "Duplicate answer attempt: student_id=%s question_id=%s",
            current_student.id,
            answer.question_id,
        )
        raise HTTPException(
            status_code=409, detail="شما قبلاً به این سوال پاسخ داده‌اید"
        )

    is_correct = answer.selected_option == question.correct_option
    points_earned = 1 if is_correct else 0

    db.add(
        models.StudentAnswer(
            student_id=current_student.id,
            question_id=answer.question_id,
            selected_option=answer.selected_option,
            is_correct=is_correct,
        )
    )
    if is_correct:
        current_student.score += points_earned

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.warning(
            "Duplicate answer race condition caught by DB constraint: "
            "student_id=%s question_id=%s",
            current_student.id,
            answer.question_id,
        )
        raise HTTPException(
            status_code=409, detail="شما قبلاً به این سوال پاسخ داده‌اید"
        )
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to save answer: student_id=%s question_id=%s",
            current_student.id,
            answer.question_id,
        )
        raise HTTPException(status_code=500, detail="خطا در ثبت پاسخ، دوباره تلاش کنید")

    logger.info(
        "Answer recorded: student_id=%s question_id=%s selected=%s correct=%s",
        current_student.id,
        answer.question_id,
        answer.selected_option,
        is_correct,
    )

    return schemas.AnswerResultOut(
        is_correct=is_correct,
        correct_option=question.correct_option,
        points_earned=points_earned,
    )
