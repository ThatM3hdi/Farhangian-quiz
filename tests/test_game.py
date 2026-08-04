def _register(client, name="دانش‌آموز تست"):
    """ثبت‌نام یک دانش‌آموز؛ کوکی session_token روی خود client ست می‌شود."""
    return client.post("/api/lobby/register", json={"name": name})


def test_get_question_success(playing_client):
    _register(playing_client)
    response = playing_client.get("/api/game/question/1")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["option_1"] == "تهران"
    assert "correct_option" not in data  # هرگز نباید جواب صحیح لو برود


def test_get_question_requires_login(playing_client):
    response = playing_client.get("/api/game/question/1")
    assert response.status_code == 401


def test_get_question_blocked_before_game_starts(client):
    # فیکسچر client وضعیت را روی waiting می‌سازد
    _register(client)
    response = client.get("/api/game/question/1")
    assert response.status_code == 403


def test_get_question_returns_404_when_no_more_questions(playing_client):
    _register(playing_client)
    response = playing_client.get("/api/game/question/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "finished"


def test_submit_answer_requires_login(playing_client):
    response = playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 1}
    )
    assert response.status_code == 401


def test_submit_correct_answer_increases_score(playing_client):
    _register(playing_client)

    response = playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 1}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_correct"] is True
    assert data["correct_option"] == 1
    assert data["points_earned"] == 1


def test_submit_wrong_answer_does_not_earn_points(playing_client):
    _register(playing_client)

    response = playing_client.post(
        "/api/game/answer", json={"question_id": 2, "selected_option": 1}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_correct"] is False
    assert data["points_earned"] == 0


def test_cannot_answer_same_question_twice(playing_client):
    _register(playing_client)

    first = playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 1}
    )
    assert first.status_code == 200

    second = playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 2}
    )
    assert second.status_code == 409
