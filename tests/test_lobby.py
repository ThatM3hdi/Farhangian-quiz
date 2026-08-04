def test_register_student_success(client):
    """تست ثبت‌نام موفقیت‌آمیز یک دانش‌آموز"""

    response = client.post(
        "/api/lobby/register",
        json={"name": "علی"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "علی"
    assert data["score"] == 0
    assert "id" in data

    assert "session_token" in response.cookies


def test_register_student_empty_name(client):
    """تست جلوگیری از ثبت‌نام با نام خالی"""

    response = client.post(
        "/api/lobby/register",
        json={"name": "   "}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "نام نمی‌تواند خالی باشد"


def test_status_returns_waiting_by_default(client):
    """تست اینکه در ابتدای بازی وضعیت روی waiting باشد"""

    response = client.get("/api/lobby/status")

    assert response.status_code == 200
    assert response.json()["status"] == "waiting"


def test_two_students_get_different_session_tokens(client):
    """تست اینکه هر دانش‌آموز توکن جلسه‌ی جداگانه‌ای می‌گیرد"""

    r1 = client.post("/api/lobby/register", json={"name": "دانش‌آموز الف"})
    r2 = client.post("/api/lobby/register", json={"name": "دانش‌آموز ب"})

    token1 = r1.cookies.get("session_token")
    token2 = r2.cookies.get("session_token")

    assert token1 and token2 and token1 != token2


def test_me_endpoint_requires_login(client):
    """تست اینکه بدون کوکی معتبر، /me رد می‌شود"""

    response = client.get("/api/lobby/me")
    assert response.status_code == 401


def test_me_endpoint_returns_current_student_after_registration(client):
    """تست اینکه بعد از ثبت‌نام، /me همون دانش‌آموز رو برمی‌گردونه (شبیه‌سازی رفرش صفحه)"""

    register_response = client.post(
        "/api/lobby/register", json={"name": "دانش‌آموز من"}
    )
    registered_id = register_response.json()["id"]

    response = client.get("/api/lobby/me")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == registered_id
    assert data["name"] == "دانش‌آموز من"


def test_public_settings_returns_default_values(client):
    """تست اینکه بدون نیاز به لاگین ادمین، مقادیر پیش‌فرض تنظیمات خونده می‌شه"""

    response = client.get("/api/lobby/settings")

    assert response.status_code == 200
    data = response.json()
    assert data["game_time"] == 300
    assert data["guid_time"] == 20


def test_public_settings_reflects_admin_changes(client):
    """تست اینکه اگه ادمین guid_time رو عوض کنه، همین اندپوینت مقدار جدید رو برمی‌گردونه"""
    from app.routers.admin import ADMIN_PASSWORD, ADMIN_USERNAME

    client.post(
        "/api/admin/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    client.put("/api/admin/settings", json={"guid_time": 30})

    response = client.get("/api/lobby/settings")
    assert response.json()["guid_time"] == 30
