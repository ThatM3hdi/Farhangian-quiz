import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routers import admin, lobby, game, leaderboard
from app import database, models

# path of the folder where the main.py file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Making Database tables
models.Base.metadata.create_all(bind=database.engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # The codes in this section are executed when the server starts.
    db = database.SessionLocal()
    try:
        # 1. Initial settings values
        if not db.query(models.GameState).first():
            db.add(models.GameState(id=1, status="waiting"))
        if not db.query(models.GameSettings).first():
            db.add(models.GameSettings(id=1, game_time=300, guid_time=20))
        
        # Add questions from JSON
        if db.query(models.Question).count() == 0:
            json_path = os.path.join(os.path.dirname(__file__), "questions.json")
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    questions_data = json.load(f)
                    for q in questions_data:
                        db_q = models.Question(**q)
                        db.add(db_q)
                print("questions have been added from JSON")
        db.commit()
    finally:
        db.close()
        
    yield  # This command tells FastAPI to keep the server running

# The server shutdown code (if needed) goes here

# Define the application and attach the lifespan to it
app = FastAPI(title="Class Quiz Game", lifespan=lifespan)

# Importing modules (routes)
# The /api prefix ensures that they do not interfere with frontend files
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(lobby.router, prefix="/api/lobby", tags=["Lobby"])
app.include_router(game.router, prefix="/api/game", tags=["Game"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])

# Serving static frontend files (must be the last line)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")