def test_leaderboard_empty_by_default(client):
    response = client.get("/api/leaderboard/")

    assert response.status_code == 200
    assert response.json() == {"students": []}


def test_leaderboard_orders_higher_scorer_first(playing_client):
    playing_client.post("/api/lobby/register", json={"name": "دانش‌آموز کم‌امتیاز"})
    playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 2}
    )  # غلط -> ۰ امتیاز

    playing_client.post("/api/lobby/register", json={"name": "دانش‌آموز پرامتیاز"})
    playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 1}
    )  # درست -> ۱ امتیاز

    response = playing_client.get("/api/leaderboard/")
    assert response.status_code == 200

    students = response.json()["students"]
    assert students[0]["name"] == "دانش‌آموز پرامتیاز"
    assert students[0]["score"] == 1
    assert students[1]["score"] == 0


def test_leaderboard_breaks_ties_by_registration_order(playing_client):
    playing_client.post("/api/lobby/register", json={"name": "دانش‌آموز الف"})
    playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 1}
    )  # درست -> ۱ امتیاز

    playing_client.post("/api/lobby/register", json={"name": "دانش‌آموز ب"})
    playing_client.post(
        "/api/game/answer", json={"question_id": 1, "selected_option": 2}
    )  # غلط -> ۰ امتیاز
    playing_client.post(
        "/api/game/answer", json={"question_id": 2, "selected_option": 3}
    )  # درست -> ۱ امتیاز

    response = playing_client.get("/api/leaderboard/")
    names_in_order = [s["name"] for s in response.json()["students"]]

    # هر دو یک امتیاز دارند؛ چون دانش‌آموز الف زودتر ثبت‌نام کرده، باید بالاتر باشد
    assert names_in_order[0] == "دانش‌آموز الف"
