import aiosqlite
import datetime

DB_NAME = 'users.db'

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        # Таблица пользователей
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                username TEXT,
                full_name TEXT,
                join_date TEXT
            )
        ''')
        # Таблица напоминаний (одно на пользователя)
        await db.execute('''
            CREATE TABLE IF NOT EXISTS reminders (
                user_id INTEGER PRIMARY KEY,
                reminder_time TEXT,
                is_active BOOLEAN DEFAULT 1
            )
        ''')
        await db.commit()

async def add_user(telegram_id, username, full_name):
    async with aiosqlite.connect(DB_NAME) as db:
        try:
            join_date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            await db.execute(
                'INSERT OR IGNORE INTO users (telegram_id, username, full_name, join_date) VALUES (?, ?, ?, ?)',
                (telegram_id, username, full_name, join_date)
            )
            await db.commit()
        except Exception as e:
            print(f"Error adding user: {e}")

async def get_all_users():
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute('SELECT telegram_id FROM users') as cursor:
            return [row[0] for row in await cursor.fetchall()]

async def set_reminder(telegram_id, time_str):
    """time_str format: HH:MM"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            'INSERT OR REPLACE INTO reminders (user_id, reminder_time, is_active) VALUES (?, ?, 1)',
            (telegram_id, time_str)
        )
        await db.commit()

async def get_reminders_by_time(time_str):
    """Возвращает список ID пользователей, у которых напоминание на это время"""
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute(
            'SELECT user_id FROM reminders WHERE reminder_time = ? AND is_active = 1',
            (time_str,)
        ) as cursor:
            return [row[0] for row in await cursor.fetchall()]

async def get_users_count():
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute('SELECT COUNT(*) FROM users') as cursor:
            result = await cursor.fetchone()
            return result[0] if result else 0
