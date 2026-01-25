import asyncio
import logging
import os
import sys
from datetime import datetime

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton
)
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import database

# Загрузка переменных окружения
load_dotenv()
TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = os.getenv("ADMIN_ID")

# Логирование
logging.basicConfig(level=logging.INFO)

# Инициализация бота
bot = Bot(token=TOKEN)
dp = Dispatcher()
scheduler = AsyncIOScheduler()

# Ссылка на ваше Mini App
WEBAPP_URL = "https://donecloud.github.io/breathing-app/" 

# --- СОСТОЯНИЯ (FSM) ---
class FeedbackState(StatesGroup):
    waiting_for_text = State()

class ReminderState(StatesGroup):
    waiting_for_time = State()

class NewsState(StatesGroup):
    waiting_for_content = State()
    waiting_for_confirmation = State()

# --- КЛАВИАТУРЫ ---

def get_main_keyboard():
    # Главное меню (Reply - кнопки под строкой ввода)
    kb = [
        [KeyboardButton(text="🧘 Открыть приложение", web_app=types.WebAppInfo(url=WEBAPP_URL))],
        [KeyboardButton(text="⏰ Напоминания"), KeyboardButton(text="💬 Написать отзыв")]
    ]
    return ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)

def get_reminders_keyboard():
    # Меню напоминаний (Inline - кнопки в сообщении)
    kb = [
        [InlineKeyboardButton(text="🌅 Утро (08:00)", callback_data="set_time_08:00")],
        [InlineKeyboardButton(text="☀️ День (14:00)", callback_data="set_time_14:00")],
        [InlineKeyboardButton(text="🌃 Вечер (22:00)", callback_data="set_time_22:00")],
        [InlineKeyboardButton(text="✏️ Своё время", callback_data="set_time_custom")],
        [InlineKeyboardButton(text="🗑 Отключить", callback_data="set_time_off")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=kb)

def get_cancel_keyboard():
    kb = [[InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_action")]]
    return InlineKeyboardMarkup(inline_keyboard=kb)

def get_confirm_news_keyboard():
    kb = [
        [InlineKeyboardButton(text="✅ Отправить всем", callback_data="news_confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="news_cancel")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=kb)

# --- ОБРАБОТЧИКИ (HANDLERS) ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await database.add_user(message.from_user.id, message.from_user.username, message.from_user.full_name)
    
    await message.answer(
        f"Привет, {message.from_user.first_name}! 🌿\n\n"
        "Я бот приложения <b>Breathing</b>.\n"
        "Используйте меню внизу, чтобы открыть приложение, настроить напоминания или связаться со мной.",
        reply_markup=get_main_keyboard(),
        parse_mode="HTML"
    )

# --- ЛОГИКА НОВОСТЕЙ (NEWS WIZARD) ---

@dp.message(Command("news"))
async def cmd_news(message: types.Message, state: FSMContext):
    # Проверка на админа
    if str(message.from_user.id) != str(ADMIN_ID):
        return

    await message.answer(
        "📰 <b>Создание новости</b>\n\n"
        "Пришлите мне пост, который вы хотите отправить пользователям.\n"
        "Это может быть просто текст или фото с подписью.",
        parse_mode="HTML",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(NewsState.waiting_for_content)

@dp.message(NewsState.waiting_for_content)
async def process_news_content(message: types.Message, state: FSMContext):
    # Сохраняем ID сообщения, чтобы потом его скопировать
    await state.update_data(message_id=message.message_id, chat_id=message.chat.id)
    
    await message.answer("👁️ <b>Предпросмотр:</b>\n\nВот так будет выглядеть ваше сообщение:", parse_mode="HTML")
    
    # Копируем сообщение пользователю (как превью)
    try:
        await message.copy_to(chat_id=message.chat.id)
    except Exception as e:
        await message.answer(f"⚠️ Ошибка предпросмотра: {e}")
        return

    await message.answer(
        "Отправляем всем пользователям?",
        reply_markup=get_confirm_news_keyboard()
    )
    await state.set_state(NewsState.waiting_for_confirmation)

@dp.callback_query(F.data == "news_confirm", NewsState.waiting_for_confirmation)
async def confirm_news_send(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    msg_id = data.get('message_id')
    from_chat_id = data.get('chat_id')
    
    users = await database.get_all_users()
    count = 0
    
    status_msg = await callback.message.edit_text(f"🚀 Начинаю рассылку для {len(users)} пользователей...")
    
    for user_id in users:
        try:
            # Метод copy_message позволяет переслать любое сообщение (текст, фото, видео)
            # сохраняя его вид, но без пометки "переслано от"
            await bot.copy_message(chat_id=user_id, from_chat_id=from_chat_id, message_id=msg_id)
            count += 1
            await asyncio.sleep(0.05) # Anti-spam
        except Exception:
            pass # Бот заблокирован пользователем

    await status_msg.edit_text(f"✅ Рассылка завершена!\nДоставлено: <b>{count}</b> из {len(users)}.", parse_mode="HTML")
    await state.clear()

@dp.callback_query(F.data == "news_cancel", NewsState.waiting_for_confirmation)
async def cancel_news(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text("❌ Рассылка отменена.")

# --- ЛОГИКА ОТЗЫВОВ ---

@dp.message(F.text == "💬 Написать отзыв")
async def start_feedback(message: types.Message, state: FSMContext):
    await message.answer(
        "Напишите ваше сообщение (отзыв, идею или вопрос), и я передам его разработчику:",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(FeedbackState.waiting_for_text)

@dp.message(FeedbackState.waiting_for_text)
async def process_feedback(message: types.Message, state: FSMContext):
    # Отправляем админу
    if ADMIN_ID:
        try:
            await bot.send_message(
                ADMIN_ID, 
                f"📩 <b>Новый отзыв!</b>\nОт: {message.from_user.full_name} (@{message.from_user.username})\n\n{message.text}",
                parse_mode="HTML"
            )
            await message.answer("✅ Сообщение отправлено! Спасибо за обратную связь.", reply_markup=get_main_keyboard())
        except Exception as e:
            logging.error(f"Failed to send feedback: {e}")
            await message.answer("⚠️ Произошла ошибка при отправке.", reply_markup=get_main_keyboard())
    else:
        await message.answer("⚠️ Админ не настроен.", reply_markup=get_main_keyboard())
    
    await state.clear()

# --- ЛОГИКА НАПОМИНАНИЙ ---

@dp.message(F.text == "⏰ Напоминания")
async def show_reminders_menu(message: types.Message):
    await message.answer(
        "Когда вам напоминать о практике дыхания?",
        reply_markup=get_reminders_keyboard()
    )

@dp.callback_query(F.data.startswith("set_time_"))
async def process_time_selection(callback: types.CallbackQuery, state: FSMContext):
    action = callback.data.split("_")[2]
    
    if action == "custom":
        await callback.message.edit_text(
            "Введите время в формате <b>HH:MM</b> (например, 09:30):", 
            parse_mode="HTML",
            reply_markup=get_cancel_keyboard()
        )
        await state.set_state(ReminderState.waiting_for_time)
        return
        
    if action == "off":
        await database.set_reminder(callback.from_user.id, "OFF") # В базе можно просто удалить или пометить
        await callback.message.edit_text("🔕 Напоминания выключены.")
        await callback.answer()
        return

    # Если выбрано готовое время (08:00, etc)
    time_str = action
    await database.set_reminder(callback.from_user.id, time_str)
    await callback.message.edit_text(f"✅ Готово! Буду напоминать каждый день в <b>{time_str}</b>.", parse_mode="HTML")
    await callback.answer()

@dp.message(ReminderState.waiting_for_time)
async def process_custom_time(message: types.Message, state: FSMContext):
    time_str = message.text.strip()
    
    try:
        datetime.strptime(time_str, "%H:%M")
        await database.set_reminder(message.from_user.id, time_str)
        await message.answer(f"✅ Готово! Буду напоминать каждый день в <b>{time_str}</b>.", parse_mode="HTML", reply_markup=get_main_keyboard())
        await state.clear()
    except ValueError:
        await message.answer("❌ Неверный формат. Попробуйте ещё раз (например, 09:00) или нажмите кнопку Отмена.", reply_markup=get_cancel_keyboard())

# --- ОБЩИЕ ---

@dp.callback_query(F.data == "cancel_action")
async def cancel_handler(callback: types.CallbackQuery, state: FSMContext):
    current_state = await state.get_state()
    if current_state is None:
        return
    await state.clear()
    await callback.message.delete()
    await callback.message.answer("Действие отменено.", reply_markup=get_main_keyboard())
    await callback.answer()

@dp.message(Command("stats"))
async def cmd_stats(message: types.Message):
    if str(message.from_user.id) != str(ADMIN_ID):
        return
    count = await database.get_users_count()
    await message.answer(f"📊 Всего пользователей в базе: {count}")
    if str(message.from_user.id) != str(ADMIN_ID):
        return
    count = await database.get_users_count()
    await message.answer(f"📊 Всего пользователей в базе: {count}")

# --- SCHEDULER ---

async def check_reminders():
    # Эта функция запускается каждую минуту
    now = datetime.now().strftime("%H:%M")
    users_to_remind = await database.get_reminders_by_time(now)
    
    for user_id in users_to_remind:
        try:
            await bot.send_message(
                user_id,
                "🧘 <b>Время подышать!</b>\n\nСделайте паузу на пару минут, чтобы восстановить силы.",
                parse_mode="HTML",
                reply_markup=get_main_keyboard()
            )
        except Exception:
            pass 

async def main():
    if not TOKEN:
        print("Error: BOT_TOKEN not found in .env")
        return

    await database.init_db()
    
    scheduler.add_job(check_reminders, 'cron', second=0)
    scheduler.start()

    print("Bot started with FSM!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        if sys.platform == 'win32':
             asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot stopped")
