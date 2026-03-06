import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    MenuButtonWebApp,
)

# ─── Конфиг ────────────────────────────────────────────────────────────────────
BOT_TOKEN = "8685740136:AAGjnjUYfv5idoYIOEP5gL6QmDY1_71fErY"          # вставь токен от @BotFather
MINIAPP_URL = "https://your-domain.com"    # URL, где хостится miniapp/index.html
# ────────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


# /start — приветствие + кнопка запуска мини-приложения
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🥚 Играть в Petnix",
                    web_app=WebAppInfo(url=MINIAPP_URL),
                )
            ]
        ]
    )
    await message.answer(
        "👋 Привет! Добро пожаловать в <b>Petnix</b>!\n\n"
        "🥚 У тебя появится яйцо — подожди <b>24 часа</b>, и из него вылупится питомец.\n"
        "🐣 За питомцем нужно ухаживать: кормить, играть и давать отдыхать.\n\n"
        "Нажми кнопку ниже, чтобы начать:",
        parse_mode="HTML",
        reply_markup=kb,
    )


# /help
@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "📖 <b>Помощь Petnix</b>\n\n"
        "/start — запустить игру\n"
        "/help  — это сообщение\n\n"
        "В игре:\n"
        "• Дождись вылупления питомца (24ч)\n"
        "• Корми его — иначе упадёт сытость\n"
        "• Играй — повышает настроение\n"
        "• Давай спать — восстанавливает энергию\n"
        "• Если питомец долго без ухода — он грустит 😢",
        parse_mode="HTML",
    )


# Устанавливаем кнопку меню
async def set_menu_button():
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="🥚 Petnix",
            web_app=WebAppInfo(url=MINIAPP_URL),
        )
    )


async def main():
    await set_menu_button()
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
