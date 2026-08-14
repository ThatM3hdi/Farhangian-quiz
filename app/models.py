from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    session_token = Column(String, unique=True, index=True, nullable=False)
    score = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ip_address = Column(String, nullable=True)
    device_info = Column(String, nullable=True)  # User-Agent + optional screen size, for tracing inappropriate names
    answers = relationship("StudentAnswer", back_populates="student")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text_1st_part = Column(String, nullable=False)  # قبل از جای خالی
    question_text_2nd_part = Column(String, nullable=False)  # بعد از جای خالی
    option_1 = Column(String, nullable=False)
    option_2 = Column(String, nullable=False)
    option_3 = Column(String, nullable=False)
    option_4 = Column(String, nullable=False)
    correct_option = Column(Integer, nullable=False)  # (1:5)


class StudentAnswer(Base):
    __tablename__ = "student_answers"
    __table_args__ = (
        # Defense-in-depth against the "duplicate answer" race condition:
        # even if two near-simultaneous requests both slip past the app-level
        # check in game.py, the database itself refuses the second insert.
        UniqueConstraint(
            "student_id", "question_id", name="uq_student_question_once"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    selected_option = Column(Integer, nullable=False)  # 5 for empty
    is_correct = Column(Boolean, default=False)

    student = relationship("Student", back_populates="answers")


class GameState(Base):
    __tablename__ = "game_state"

    id = Column(Integer, primary_key=True, default=1)
    status = Column(String, default="waiting")  # waiting, playing, finished


class GameSettings(Base):
    __tablename__ = "game_settings"

    id = Column(Integer, primary_key=True, default=1)
    starting_time = Column(DateTime, nullable=True)  # when game is started
    game_time = Column(Integer, default=240)         # play time (sec)
    guid_time = Column(Integer, default=20)          # show guide (sec)
