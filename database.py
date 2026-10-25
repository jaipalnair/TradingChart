import sqlite3
import os
import hashlib
import secrets
import json
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trading_platform.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key_hex = stored_hash.split("$")
        test_key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return secrets.compare_digest(test_key.hex(), key_hex)
    except Exception:
        return False

def init_db():
    conn = get_connection()
    c = conn.cursor()

    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    ''')

    # User sessions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # User settings / profiles table
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INTEGER PRIMARY KEY,
            settings_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Traffic & Analytics logs
    c.execute('''
        CREATE TABLE IF NOT EXISTS traffic_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            status_code INTEGER,
            timestamp TEXT NOT NULL
        )
    ''')

    # Paper trading portfolio per user
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_paper_accounts (
            user_id INTEGER PRIMARY KEY,
            balance REAL DEFAULT 100000.0,
            equity REAL DEFAULT 100000.0,
            positions_json TEXT DEFAULT '{}',
            orders_json TEXT DEFAULT '[]',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Create default admin user if no users exist
    c.execute('SELECT COUNT(*) as count FROM users')
    count = c.fetchone()['count']
    if count == 0:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        admin_pass = hash_password("admin123")
        c.execute('''
            INSERT INTO users (username, password_hash, email, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('admin', admin_pass, 'admin@tradingview.local', 'admin', 1, now))
        admin_id = c.lastrowid
        # Default settings
        default_settings = {
            "layout": "4g",
            "theme": "dark",
            "activeWatchlist": "indices",
            "indicators": ["supertrend", "vwap", "volume"],
            "dhan_config": {
                "client_id": "1100189396",
                "enabled": True
            }
        }
        c.execute('''
            INSERT INTO user_settings (user_id, settings_json, updated_at)
            VALUES (?, ?, ?)
        ''', (admin_id, json.dumps(default_settings), now))
        conn.commit()
        print("Initialized DB with default admin user (admin / admin123)")

    conn.commit()
    conn.close()

# ----------------- User Management -----------------

def create_user(username: str, password: str, email: str = "", role: str = "user") -> dict:
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    pw_hash = hash_password(password)
    try:
        c.execute('''
            INSERT INTO users (username, password_hash, email, role, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
        ''', (username.strip(), pw_hash, email.strip(), role, now))
        user_id = c.lastrowid
        # default settings
        default_settings = {
            "layout": "4g",
            "theme": "dark",
            "activeWatchlist": "indices",
            "indicators": ["supertrend", "vwap", "volume"]
        }
        c.execute('''
            INSERT INTO user_settings (user_id, settings_json, updated_at)
            VALUES (?, ?, ?)
        ''', (user_id, json.dumps(default_settings), now))
        conn.commit()
        return {"id": user_id, "username": username, "email": email, "role": role, "created_at": now}
    finally:
        conn.close()

def authenticate_user(username: str, password: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ? COLLATE NOCASE', (username.strip(),))
    user = c.fetchone()
    if not user:
        conn.close()
        return None
    if not user['is_active']:
        conn.close()
        return "INACTIVE"
    if not verify_password(password, user['password_hash']):
        conn.close()
        return None

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    c.execute('UPDATE users SET last_login = ? WHERE id = ?', (now, user['id']))

    # Create new session token
    token = secrets.token_urlsafe(32)
    c.execute('INSERT INTO user_sessions (token, user_id, created_at) VALUES (?, ?, ?)',
              (token, user['id'], now))
    conn.commit()

    user_dict = dict(user)
    user_dict.pop('password_hash')
    user_dict['token'] = token
    conn.close()
    return user_dict

def get_user_by_token(token: str):
    if not token:
        return None
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at, u.last_login
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    ''', (token,))
    row = c.fetchone()
    conn.close()
    if row and row['is_active']:
        return dict(row)
    return None

def logout_user(token: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM user_sessions WHERE token = ?', (token,))
    conn.commit()
    conn.close()

def list_all_users():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT id, username, email, role, is_active, created_at, last_login
        FROM users
        ORDER BY id DESC
    ''')
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def update_user_status(user_id: int, is_active: bool):
    conn = get_connection()
    c = conn.cursor()
    c.execute('UPDATE users SET is_active = ? WHERE id = ?', (1 if is_active else 0, user_id))
    if not is_active:
        # invalidate all sessions
        c.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()

def delete_user(user_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute('DELETE FROM users WHERE id = ?', (user_id,))
    c.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
    c.execute('DELETE FROM user_settings WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()

def reset_user_password(user_id: int, new_password: str):
    conn = get_connection()
    c = conn.cursor()
    pw_hash = hash_password(new_password)
    c.execute('UPDATE users SET password_hash = ? WHERE id = ?', (pw_hash, user_id))
    # invalidate old sessions so user re-logs in
    c.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()

# ----------------- User Settings -----------------

def get_user_settings(user_id: int) -> dict:
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT settings_json FROM user_settings WHERE user_id = ?', (user_id,))
    row = c.fetchone()
    conn.close()
    if row and row['settings_json']:
        try:
            return json.loads(row['settings_json'])
        except Exception:
            return {}
    return {}

def save_user_settings(user_id: int, settings: dict):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    settings_str = json.dumps(settings)
    c.execute('''
        INSERT INTO user_settings (user_id, settings_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            settings_json = excluded.settings_json,
            updated_at = excluded.updated_at
    ''', (user_id, settings_str, now))
    conn.commit()
    conn.close()

# ----------------- Traffic & Analytics -----------------

def log_traffic(user_id: int, username: str, endpoint: str, method: str, ip_address: str, user_agent: str, status_code: int = 200):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO traffic_logs (user_id, username, endpoint, method, ip_address, user_agent, status_code, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, username, endpoint, method, ip_address, user_agent, status_code, now))
    conn.commit()
    conn.close()

def get_traffic_stats():
    conn = get_connection()
    c = conn.cursor()
    today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Total users
    c.execute('SELECT COUNT(*) as cnt FROM users')
    total_users = c.fetchone()['cnt']

    # Active users today
    c.execute('SELECT COUNT(DISTINCT user_id) as cnt FROM traffic_logs WHERE timestamp LIKE ? AND user_id IS NOT NULL', (f"{today_prefix}%",))
    active_today = c.fetchone()['cnt']

    # Total requests
    c.execute('SELECT COUNT(*) as cnt FROM traffic_logs')
    total_requests = c.fetchone()['cnt']

    # Active sessions in last 30 minutes
    c.execute('SELECT COUNT(DISTINCT user_id) as cnt FROM user_sessions')
    active_sessions = c.fetchone()['cnt']

    # Requests by top endpoints
    c.execute('''
        SELECT endpoint, COUNT(*) as count 
        FROM traffic_logs 
        GROUP BY endpoint 
        ORDER BY count DESC 
        LIMIT 6
    ''')
    top_endpoints = [dict(r) for r in c.fetchall()]

    conn.close()
    return {
        "total_users": total_users,
        "active_users_today": active_today,
        "total_requests": total_requests,
        "active_sessions": active_sessions,
        "top_endpoints": top_endpoints
    }

def get_recent_activity(limit: int = 50):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT id, user_id, username, endpoint, method, ip_address, status_code, timestamp
        FROM traffic_logs
        ORDER BY id DESC
        LIMIT ?
    ''', (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows
