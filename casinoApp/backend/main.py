# backend/main.py
# ← новый/проверить содержимое
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from backend.api.rounds import router as rounds_router  # ← добавили импорт


app = FastAPI(title="Game Backend")
app.include_router(rounds_router)                       # ← подключили роутер

BASE_DIR = os.path.dirname(os.path.dirname(__file__))          # ← добавили вычисление путей
WEB_DIR = os.path.join(BASE_DIR, "web")                        # ← добавили путь к фронту

app.mount("/app", StaticFiles(directory=WEB_DIR, html=True), name="web")  # ← отдаем index.html по "/"

@app.get("/api/health")
async def health():
    return JSONResponse({"status": "ok"})                      # ← тестовая ручка
