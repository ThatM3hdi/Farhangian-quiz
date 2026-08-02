from pydantic import BaseModel, ConfigDict
from typing import List

# ==========================================
# 1. User Schemas
# ==========================================

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    """Model for when a user registers or logs into the game"""
    pass

class UserOut(UserBase):
    """Output model for displaying user information"""
    id: int
    total_score: int

# This setting tells Pydantic to read data directly from the database model (SQLAlchemy)
    model_config = ConfigDict(from_attributes=True)

# ==========================================
# 2. Question Schemas
# ==========================================

class QuestionOut(BaseModel):
    """
    Output model for displaying questions to users during the game.
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
    """Validation model for when the user clicks on an option"""
    user_id: int
    question_id: int
    selected_option: int

class AnswerResultOut(BaseModel):
    """Output model for when the server returns the result of the user's response"""
    is_correct: bool
    correct_option: int
    points_earned: int