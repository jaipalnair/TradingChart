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
            email TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            approval_status TEXT DEFAULT 'approved',
            auth_code TEXT DEFAULT '',
            approved_at TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    ''')

    # Migration: add missing columns if upgrading existing database
    for col_name, col_type in [
        ("approval_status", "TEXT DEFAULT 'approved'"),
        ("auth_code", "TEXT DEFAULT ''"),
        ("approved_at", "TEXT DEFAULT ''")
    ]:
        try:
            c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    # Email logs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS email_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT,
            email_type TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # System configuration table
    c.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
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

AUTHCODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

def generate_10char_auth_code() -> str:
    """Generate a clean 10-character alphanumeric authorization code (mix of numbers and uppercase letters)."""
    return "".join(secrets.choice(AUTHCODE_ALPHABET) for _ in range(10))

def create_pending_user(username: str, password: str, email: str = "") -> dict:
    """Register a new user whose account is pending administrator approval."""
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    pw_hash = hash_password(password)
    try:
        c.execute('''
            INSERT INTO users (username, password_hash, email, role, is_active, approval_status, auth_code, created_at)
            VALUES (?, ?, ?, 'user', 0, 'pending', '', ?)
        ''', (username.strip(), pw_hash, email.strip(), now))
        user_id = c.lastrowid
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
        return {
            "id": user_id,
            "username": username.strip(),
            "email": email.strip(),
            "role": "user",
            "approval_status": "pending",
            "created_at": now
        }
    finally:
        conn.close()

def get_pending_users():
    """Get all registration requests awaiting administrator approval."""
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT id, username, email, role, approval_status, created_at
        FROM users
        WHERE approval_status = 'pending'
        ORDER BY id DESC
    ''')
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def approve_user(user_id: int, custom_code: str = None) -> dict:
    """Approve pending user, generate 10-character auth code, and activate access."""
    conn = get_connection()
    c = conn.cursor()
    code = custom_code.strip().upper() if custom_code else generate_10char_auth_code()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        UPDATE users
        SET approval_status = 'approved',
            is_active = 1,
            auth_code = ?,
            approved_at = ?
        WHERE id = ?
    ''', (code, now, user_id))
    c.execute('SELECT id, username, email, role, approval_status, auth_code, approved_at FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None

def reject_user(user_id: int) -> dict:
    """Reject pending user access request."""
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        UPDATE users
        SET approval_status = 'rejected',
            is_active = 0
        WHERE id = ?
    ''', (user_id,))
    c.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
    c.execute('SELECT id, username, email, role, approval_status FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email: str):
    """Check if an email is already registered."""
    if not email:
        return None
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT id, username, email FROM users WHERE email = ? COLLATE NOCASE', (email.strip(),))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def log_email(recipient: str, subject: str, body: str, email_type: str, status: str, error_message: str = ""):
    """Record outgoing email history in database."""
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO email_logs (recipient, subject, body, email_type, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (recipient, subject, body, email_type, status, error_message, now))
    conn.commit()
    conn.close()

def get_email_logs(limit: int = 50):
    """Get recent email history logs."""
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        SELECT id, recipient, subject, email_type, status, error_message, created_at
        FROM email_logs
        ORDER BY id DESC
        LIMIT ?
    ''', (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_config(key: str, default: str = "") -> str:
    """Retrieve persistent platform configuration setting."""
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT value FROM system_config WHERE key = ?', (key,))
    row = c.fetchone()
    conn.close()
    return row['value'] if row else default

def set_config(key: str, value: str):
    """Store persistent platform configuration setting."""
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    ''', (key, value, now))
    conn.commit()
    conn.close()


def create_user(username: str, password: str, email: str = "", role: str = "user") -> dict:
    """Create pre-approved user account manually by admin, with 10-char authorization code."""
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    pw_hash = hash_password(password)
    code = generate_10char_auth_code() if role != 'admin' else ''
    try:
        c.execute('''
            INSERT INTO users (username, password_hash, email, role, is_active, approval_status, auth_code, approved_at, created_at)
            VALUES (?, ?, ?, ?, 1, 'approved', ?, ?, ?)
        ''', (username.strip(), pw_hash, email.strip(), role, code, now, now))
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
        return {
            "id": user_id,
            "username": username.strip(),
            "email": email.strip(),
            "role": role,
            "approval_status": "approved",
            "auth_code": code,
            "created_at": now
        }
    finally:
        conn.close()

def authenticate_user(username: str, password: str, auth_code: str = ""):
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ? COLLATE NOCASE', (username.strip(),))
    user = c.fetchone()
    if not user:
        conn.close()
        return None
    if not verify_password(password, user['password_hash']):
        conn.close()
        return None

    user_keys = user.keys()
    app_status = user['approval_status'] if 'approval_status' in user_keys else 'approved'
    if app_status == 'pending':
        conn.close()
        return "PENDING"
    if app_status == 'rejected':
        conn.close()
        return "REJECTED"
    if not user['is_active']:
        conn.close()
        return "INACTIVE"

    # Enforce 10-char authorization code for non-admin users if user has an auth_code
    user_auth_code = user['auth_code'] if 'auth_code' in user_keys else ''
    if user['role'] != 'admin' and user_auth_code:
        if not auth_code or not auth_code.strip():
            conn.close()
            return "CODE_REQUIRED"
        if auth_code.strip().upper() != user_auth_code.upper():
            conn.close()
            return "INVALID_CODE"

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
        SELECT id, username, email, role, is_active, approval_status, auth_code, approved_at, created_at, last_login
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

def change_password(user_id: int, current_password: str, new_password: str) -> bool:
    conn = get_connection()
    c = conn.cursor()
    c.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    if not row or not verify_password(current_password, row['password_hash']):
        conn.close()
        return False
    pw_hash = hash_password(new_password)
    c.execute('UPDATE users SET password_hash = ? WHERE id = ?', (pw_hash, user_id))
    conn.commit()
    conn.close()
    return True

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

    # Pending user registration requests
    c.execute("SELECT COUNT(*) as cnt FROM users WHERE approval_status = 'pending'")
    pending_approvals = c.fetchone()['cnt']

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
        "pending_approvals": pending_approvals,
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
