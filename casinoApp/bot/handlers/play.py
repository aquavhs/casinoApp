# ← новый файл
from aiogram import Router, F  # ← добавили импорт
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton  # ← добавили импорт
from bot.config import WEBAPP_URL  # ← добавили импорт

router = Router()

@router.message(F.text == "/play")
async def cmd_play(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🎮 Играть", web_app=WebAppInfo(url=WEBAPP_URL))  # ← WebApp
    ]])
    await message.answer("Открой мини‑приложение и сделай ставку:", reply_markup=kb)
