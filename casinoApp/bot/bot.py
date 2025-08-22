from bot.handlers import play  # ← добавили импорт
dp.include_router(play.router) # ← подключили /play
