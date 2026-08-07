import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import database, models
from app.main import app

# Make sure logger.info/warning/error calls inside the app (e.g. app/routers/lobby.py,
# app/routers/game.py) actually get printed when running `pytest -v -s`.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def _build_isolated_client(initial_status: str, seed_questions: bool):
    """
    Shared setup for both fixtures below: a fresh in-memory SQLite database
    (via StaticPool, so every session shares the same underlying connection —
    otherwise each new connection to ':memory:' gets its own blank database),
    wired into the app through a get_db override so tests never touch the
    real game.db used for the actual classroom game.
    """
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    models.Base.metadata.create_all(bind=test_engine)

    seed_db = TestSessionLocal()
    seed_db.add(models.GameState(id=1, status=initial_status))
    seed_db.add(models.GameSettings(id=1, game_time=300, guid_time=20))

    if seed_questions:
        seed_db.add(
            models.Question(
                id=1,
                question_text_1st_part="پایتخت ایران",
                question_text_2nd_part="کدام شهر است؟",
                option_1="تهران",
                option_2="اصفهان",
                option_3="شیراز",
                option_4="تبریز",
                correct_option=1,
            )
        )
        seed_db.add(
            models.Question(
                id=2,
                question_text_1st_part="عدد ۲ به توان ۳",
                question_text_2nd_part="برابر است با؟",
                option_1="۴",
                option_2="۶",
                option_3="۸",
                option_4="۱۶",
                correct_option=3,
            )
        )

    seed_db.commit()
    seed_db.close()

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db


@pytest.fixture()
def client():
    """Isolated TestClient with the game in its default 'waiting' state — for lobby tests."""
    _build_isolated_client(initial_status="waiting", seed_questions=False)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def playing_client():
    """
    Isolated TestClient with the game already in the 'playing' state and two
    sample questions seeded — needed for app/routers/game.py tests, since
    those endpoints reject requests unless an admin has started the game.
    """
    _build_isolated_client(initial_status="playing", seed_questions=True)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
