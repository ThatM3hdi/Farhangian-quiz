from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================
# 1. Student Schemas
# ==========================================

class StudentCreate(BaseModel):
    """Model for when a student registers in the lobby (they only submit a name)."""
    name: str


class StudentOut(BaseModel):
    """Public output model for a student — used in the leaderboard and admin waiting list."""
    id: int
    name: str
    score: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 2. Question Schemas
# ==========================================

class QuestionOut(BaseModel):
    """
    Output model for displaying a question to the client during the game.
    NOTE: correct_option is intentionally excluded here so it is never sent
    to the browser — only the server-side model has it.
    """
    id: int
    question_text_1st_part: str
    question_text_2nd_part: str
    option_1: str
    option_2: str
    option_3: str
    option_4: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 3. Game & Answer Schemas
# ==========================================

class AnswerSubmit(BaseModel):
    """
    Validation model for when the student clicks an option.

    IMPORTANT: there is no student/user id field here on purpose. The
    student's identity must be resolved server-side from the session_token
    cookie (see lobby/game routers), never trusted from the request body —
    otherwise any client could submit answers on behalf of another student's id.
    """
    question_id: int
    selected_option: int


class AnswerResultOut(BaseModel):
    """Output model returned after an answer is submitted and graded."""
    is_correct: bool
    correct_option: int
    points_earned: int


# ==========================================
# 4. Game State Schemas
# ==========================================

class GameStatusOut(BaseModel):
    """Output model for polling the current game status (used by lobby.html and game.html)."""
    status: str  # one of: "waiting", "playing", "finished"

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 5. Leaderboard Schemas
# ==========================================

class LeaderboardOut(BaseModel):
    """Output model for the leaderboard page: students ordered by score, descending."""
    students: List[StudentOut]


# ==========================================
# 6. Admin Schemas
# ==========================================

class AdminLogin(BaseModel):
    """Validation model for the admin login form (hardcoded credentials checked server-side)."""
    username: str
    password: str


class StudentListOut(BaseModel):
    """Output for admin views that list registered students (e.g. the lobby waiting list)."""
    count: int
    students: List[StudentOut]


class GameSettingsOut(BaseModel):
    """Output model for the current game timing settings, shown in the admin panel."""
    game_time: int
    guid_time: int

    model_config = ConfigDict(from_attributes=True)


class GameSettingsUpdate(BaseModel):
    """
    Input model for the admin updating game timing settings. Both fields are
    optional so the teacher can change just one without resending the other.
    Values must be positive (enforced here, so an invalid request never even
    reaches the endpoint logic).
    """
    game_time: Optional[int] = Field(default=None, gt=0, description="مدت زمان کل بازی (ثانیه)")
    guid_time: Optional[int] = Field(default=None, gt=0, description="مدت زمان نمایش راهنما (ثانیه)")
