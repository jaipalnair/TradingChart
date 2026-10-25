"""
Email Service for TraderView Chart Platform.
Handles:
1. Intimation emails to admin (jaipal.nair@gmail.com) upon new user registration.
2. 10-character authorization code emails to approved users.
3. SMTP configuration management (environment variables + database fallback).
4. Background non-blocking email dispatch and persistent logging in SQLite.
"""

import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

# Default platform settings
DEFAULT_ADMIN_EMAIL = "jaipal.nair@gmail.com"
DEFAULT_SMTP_HOST = "smtp.gmail.com"
DEFAULT_SMTP_PORT = 587
DEFAULT_SITE_URL = "https://traderview-chart.onrender.com"

def get_smtp_config():
    """Retrieve SMTP configuration from environment or database."""
    import database
    
    # 1. Environment variables take precedence
    host = os.environ.get("SMTP_HOST", "").strip() or database.get_config("smtp_host", DEFAULT_SMTP_HOST)
    port_str = os.environ.get("SMTP_PORT", "").strip() or database.get_config("smtp_port", str(DEFAULT_SMTP_PORT))
    try:
        port = int(port_str)
    except Exception:
        port = DEFAULT_SMTP_PORT

    user = os.environ.get("SMTP_USER", "").strip() or database.get_config("smtp_user", DEFAULT_ADMIN_EMAIL)
    password = os.environ.get("SMTP_PASSWORD", "").strip() or database.get_config("smtp_password", "")
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip() or database.get_config("admin_email", DEFAULT_ADMIN_EMAIL)
    site_url = os.environ.get("SITE_URL", "").strip() or database.get_config("site_url", DEFAULT_SITE_URL)

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "admin_email": admin_email,
        "site_url": site_url,
        "is_configured": bool(user and password)
    }

def _send_email_sync(to_email: str, subject: str, text_content: str, html_content: str, email_type: str):
    """Synchronous internal worker that connects to SMTP server and sends email."""
    import database
    
    cfg = get_smtp_config()
    sender = cfg["user"] or cfg["admin_email"]
    
    if not cfg["is_configured"]:
        msg = f"SMTP not configured (SMTP_USER or SMTP_PASSWORD missing). Email recorded for {to_email}."
        print(f"[EmailService] {msg}")
        database.log_email(
            recipient=to_email,
            subject=subject,
            body=text_content,
            email_type=email_type,
            status="queued_unconfigured",
            error_message=msg
        )
        return False, msg

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"TraderView Platform <{sender}>"
        msg["To"] = to_email

        # Attach text and html versions
        part1 = MIMEText(text_content, "plain", "utf-8")
        part2 = MIMEText(html_content, "html", "utf-8")
        msg.attach(part1)
        msg.attach(part2)

        if cfg["port"] == 465:
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10)
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(cfg["user"], cfg["password"])
        server.sendmail(sender, [to_email], msg.as_string())
        server.quit()

        print(f"[EmailService] Successfully sent '{subject}' to {to_email}")
        database.log_email(
            recipient=to_email,
            subject=subject,
            body=text_content,
            email_type=email_type,
            status="sent",
            error_message=""
        )
        return True, "Email sent successfully"

    except Exception as e:
        err = str(e)
        print(f"[EmailService] Failed to send email to {to_email}: {err}")
        database.log_email(
            recipient=to_email,
            subject=subject,
            body=text_content,
            email_type=email_type,
            status="failed",
            error_message=err
        )
        return False, err

def dispatch_email_async(to_email: str, subject: str, text_content: str, html_content: str, email_type: str):
    """Fire and forget email delivery in a background daemon thread."""
    t = threading.Thread(
        target=_send_email_sync,
        args=(to_email, subject, text_content, html_content, email_type),
        daemon=True
    )
    t.start()

# ----------------- Specific Email Notifications -----------------

def notify_admin_new_user_registration(username: str, user_email: str):
    """Send intimation email to jaipal.nair@gmail.com when a new user registers."""
    cfg = get_smtp_config()
    admin_email = cfg["admin_email"]
    now_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M:%S UTC")
    site_url = cfg["site_url"]

    subject = f"[TraderView Alert] New User Access Request: {username}"

    text_body = f"""Hello Jaipal,

A new user has registered on TraderView Chart Platform and is awaiting your authorization.

User Details:
- Username: {username}
- Email: {user_email}
- Registered At: {now_str}
- Status: Pending Approval

To approve or reject this request, please log in to your Admin Control Center:
{site_url}

Best regards,
TraderView Platform Notification System
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #131722; color: #d1d4dc; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #1e222d; border: 1px solid #2a2e39; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="background-color: #181b24; padding: 18px 24px; border-bottom: 1px solid #2a2e39; display: flex; align-items: center;">
      <h2 style="margin: 0; color: #2962ff; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">TraderView Chart &bull; Admin Alert</h2>
    </div>
    <div style="padding: 24px;">
      <h3 style="margin-top: 0; color: #ffffff; font-size: 16px;">New User Access Request Pending Approval</h3>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
        A new user has submitted a registration request on your charting platform. Please review and authorize access:
      </p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #131722; border-radius: 8px; border: 1px solid #2a2e39; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; color: #787b86; border-bottom: 1px solid #2a2e39; width: 120px;">Username:</td>
          <td style="padding: 10px 14px; color: #ffffff; font-weight: 600; border-bottom: 1px solid #2a2e39;">{username}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #787b86; border-bottom: 1px solid #2a2e39;">Email:</td>
          <td style="padding: 10px 14px; color: #2962ff; font-weight: 600; border-bottom: 1px solid #2a2e39;">{user_email}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #787b86; border-bottom: 1px solid #2a2e39;">Time:</td>
          <td style="padding: 10px 14px; color: #d1d4dc; border-bottom: 1px solid #2a2e39;">{now_str}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #787b86;">Status:</td>
          <td style="padding: 10px 14px; color: #f59e0b; font-weight: 600;">Pending Authorization</td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="{site_url}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 12px rgba(124,58,237,0.4);">
          Open Admin Control Panel to Approve
        </a>
      </div>

      <p style="color: #6b7280; font-size: 11px; text-align: center; margin-top: 20px;">
        Once approved in your Admin Panel, the user will automatically receive a 10-character authorization code to access the charts.
      </p>
    </div>
  </div>
</body>
</html>
"""

    dispatch_email_async(admin_email, subject, text_body, html_body, "admin_intimation")

def send_user_approval_code_email(username: str, user_email: str, auth_code: str):
    """Send 10-character authorization code to user once approved by admin."""
    cfg = get_smtp_config()
    site_url = cfg["site_url"]

    subject = f"[TraderView] Account Approved - Your Authorization Code: {auth_code}"

    text_body = f"""Hello {username},

Congratulations! Your TraderView Chart account has been approved by the administrator.

Your 10-Character Authorization Code is:
=======================================
{auth_code}
=======================================

You can now log in to the platform here:
{site_url}

Sign In Credentials:
- Username: {username}
- Password: (the password you created during registration)
- Authorization Code: {auth_code}

Keep this authorization code safe for accessing your charts.

Happy Trading!
TraderView Platform Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #131722; color: #d1d4dc; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #1e222d; border: 1px solid #2a2e39; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <div style="background-color: #181b24; padding: 20px 24px; border-bottom: 1px solid #2a2e39;">
      <h2 style="margin: 0; color: #089981; font-size: 18px; font-weight: 700;">Account Approved &bull; TraderView Chart</h2>
    </div>
    <div style="padding: 24px;">
      <h3 style="margin-top: 0; color: #ffffff; font-size: 16px;">Welcome aboard, {username}!</h3>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
        Your trader account has been reviewed and approved by the administrator. Use the 10-character authorization code below to log in:
      </p>
      
      <!-- Authorization Code Box -->
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #1e222d 100%); border: 2px dashed #7c3aed; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="color: #a78bfa; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          Your 10-Character Authorization Code
        </div>
        <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: 4px;">
          {auth_code}
        </div>
      </div>

      <div style="background-color: #131722; border-radius: 8px; border: 1px solid #2a2e39; padding: 14px 18px; margin-bottom: 24px; font-size: 13px;">
        <div style="color: #787b86; font-size: 11px; font-weight: 600; margin-bottom: 6px; text-transform: uppercase;">Sign In Instructions</div>
        <div style="color: #d1d4dc; margin-bottom: 4px;">1. Visit <a href="{site_url}" style="color: #2962ff; text-decoration: none;">{site_url}</a></div>
        <div style="color: #d1d4dc; margin-bottom: 4px;">2. Enter Username: <b style="color: #ffffff;">{username}</b></div>
        <div style="color: #d1d4dc; margin-bottom: 4px;">3. Enter your Password</div>
        <div style="color: #d1d4dc;">4. Enter Authorization Code: <b style="color: #a78bfa; font-family: monospace;">{auth_code}</b></div>
      </div>

      <div style="text-align: center; margin: 20px 0;">
        <a href="{site_url}" style="display: inline-block; background-color: #2962ff; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 6px; box-shadow: 0 4px 12px rgba(41,98,255,0.4);">
          Launch Chart Platform
        </a>
      </div>

      <p style="color: #6b7280; font-size: 11px; text-align: center; margin-top: 24px;">
        Please do not share this authorization code with others. If you have questions, reach out to your administrator.
      </p>
    </div>
  </div>
</body>
</html>
"""

    dispatch_email_async(user_email, subject, text_body, html_body, "user_approval_code")

def send_test_email(to_email: str):
    """Synchronous test email helper for Admin Panel testing."""
    subject = "[TraderView Test] SMTP Email Service Test"
    text_body = f"Hello! This is a test email from your TraderView Chart platform sent to {to_email} at {datetime.now(timezone.utc)}."
    html_body = f"""<div style="font-family:sans-serif; background:#131722; color:#fff; padding:20px; border-radius:8px;">
        <h3 style="color:#089981;">✓ SMTP Service Verified</h3>
        <p>Your TraderView email configuration is working properly.</p>
        <p style="color:#787b86; font-size:12px;">Sent to {to_email}</p>
    </div>"""
    return _send_email_sync(to_email, subject, text_body, html_body, "test")
