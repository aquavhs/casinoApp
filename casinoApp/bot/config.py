# ← убедись, что это есть
import os
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
ADMINS = [int(x) for x in os.getenv("ADMINS", "").split(",") if x]
WEBAPP_URL = os.getenv("WEBAPP_URL")  # ← URL от ngrok/домен
