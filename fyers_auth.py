"""
Fyers API v3 OAuth Authentication App & Token Bridge
Handles 1-Click OAuth flow, auth_code exchange, profile validation, and callback hooks.
Ref: https://fyers.in/api-docs/v3/getting-started/authentication/
"""

import os
import json
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
FYERS_CONFIG_PATH = BASE_DIR / "fyers_config.json"
STANDARD_FYERS_REDIRECT_URI = "https://trade.fyers.in/api-login/redirect-uri/index.html"

# In-memory client cache
_cached_fyers_client = None
_cached_token = ""
_cached_app_id = ""

def get_config_path() -> Path:
    return FYERS_CONFIG_PATH

def load_fyers_config() -> Dict[str, Any]:
    if FYERS_CONFIG_PATH.exists():
        try:
            with open(FYERS_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading fyers_config.json: {e}")
    return {}

def save_fyers_config(cfg: Dict[str, Any]):
    global _cached_fyers_client, _cached_token, _cached_app_id
    with open(FYERS_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    _cached_fyers_client = None
    _cached_token = ""
    _cached_app_id = ""

def extract_fyers_code(raw: str) -> str:
    raw = str(raw or "").strip()
    if "code=" in raw or "auth_code=" in raw:
        if "?" in raw:
            raw = raw.split("?", 1)[1]
        qs = urllib.parse.parse_qs(raw)
        extracted = qs.get("code", qs.get("auth_code", [raw]))[0]
        return extracted.strip()
    return raw

def get_fyers_client_instance():
    global _cached_fyers_client, _cached_token, _cached_app_id
    cfg = load_fyers_config()
    enabled = bool(cfg.get("enabled", True))
    app_id = str(cfg.get("app_id", cfg.get("client_id", ""))).strip()
    tok = str(cfg.get("access_token", "")).strip()

    if not app_id or not tok:
        env_app_id = (os.environ.get("FYERS_APP_ID") or os.environ.get("FYERS_CLIENT_ID") or "").strip()
        env_tok = os.environ.get("FYERS_ACCESS_TOKEN", "").strip()
        if env_app_id and env_tok:
            app_id = env_app_id
            tok = env_tok
            enabled = True

    if not enabled or not app_id or not tok:
        return None

    try:
        if _cached_fyers_client and _cached_token == tok and _cached_app_id == app_id:
            return _cached_fyers_client
        from fyers_apiv3.fyersModel import FyersModel
        client = FyersModel(client_id=app_id, token=tok, is_async=False, log_path=None)
        _cached_fyers_client = client
        _cached_token = tok
        _cached_app_id = app_id
        return _cached_fyers_client
    except Exception as e:
        print(f"Error initializing Fyers client: {e}")
        return None

# Pydantic Models
class FyersConfigRequest(BaseModel):
    app_id: str
    access_token: str
    secret_key: Optional[str] = ""
    redirect_uri: Optional[str] = ""
    enabled: bool = True

class FyersCredentialsRequest(BaseModel):
    app_id: str
    secret_key: Optional[str] = ""
    redirect_uri: Optional[str] = ""
    enabled: bool = True

class FyersAuthUrlRequest(BaseModel):
    app_id: Optional[str] = ""
    secret_key: Optional[str] = ""
    redirect_uri: Optional[str] = ""

class FyersExchangeTokenRequest(BaseModel):
    auth_code: str
    app_id: Optional[str] = ""
    secret_key: Optional[str] = ""
    redirect_uri: Optional[str] = ""

# HTML Templates
def render_callback_success(profile: Dict[str, Any]) -> str:
    name = profile.get("name") or "Trader"
    fy_id = profile.get("fy_id") or ""
    email = profile.get("email_id") or ""
    prof_json = json.dumps(profile)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fyers Authentication Successful</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0f1318] text-[#d1d4dc] min-h-screen flex items-center justify-center p-4 font-sans">
  <div class="bg-[#181c24] border border-[#2a2e39] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
    <div class="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
    <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.35)] text-3xl">
      &#10003;
    </div>
    <h2 class="text-xl font-bold text-white mb-1">Fyers Connected!</h2>
    <p class="text-xs text-gray-400 mb-5">Your Fyers API v3 token was generated successfully and live market tick stream is active.</p>

    <div class="bg-[#12151c] rounded-xl p-4 border border-[#232733] mb-6 text-left space-y-2.5">
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-400">Trader Name:</span>
        <span class="font-bold text-emerald-400">{name}</span>
      </div>
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-400">Fyers ID:</span>
        <span class="font-mono text-gray-200">{fy_id or 'Authorized'}</span>
      </div>
      {f'<div class="flex justify-between items-center text-xs"><span class="text-gray-400">Email:</span><span class="text-gray-300">{email}</span></div>' if email else ''}
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-400">Status:</span>
        <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span> Live Feed Active
        </span>
      </div>
    </div>

    <p class="text-[11px] text-gray-500 mb-4">Returning to TradingView chart...</p>
    <a href="/" class="inline-block px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#2962ff] hover:bg-[#1e53e5] text-white transition shadow-lg">Return to Chart</a>
  </div>

  <script>
    try {{
      if (window.opener) {{
        window.opener.postMessage({{ type: 'FYERS_AUTH_SUCCESS', profile: {prof_json} }}, '*');
        setTimeout(() => window.close(), 1200);
      }} else {{
        setTimeout(() => {{ window.location.href = '/'; }}, 2000);
      }}
    }} catch(e) {{
      setTimeout(() => {{ window.location.href = '/'; }}, 2000);
    }}
  </script>
</body>
</html>"""

def render_callback_error(error_msg: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fyers Authentication Failed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0f1318] text-[#d1d4dc] min-h-screen flex items-center justify-center p-4 font-sans">
  <div class="bg-[#181c24] border border-[#2a2e39] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
    <div class="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.35)] text-3xl">
      &#10005;
    </div>
    <h2 class="text-xl font-bold text-white mb-1">Authentication Failed</h2>
    <p class="text-xs text-red-400 bg-red-950/40 p-3 rounded-lg border border-red-800/40 my-4 text-left font-mono break-all">{error_msg}</p>
    <p class="text-xs text-gray-400 mb-6">Please check your App ID, Secret Key, and Redirect URI settings at myapi.fyers.in.</p>
    <div class="flex items-center justify-center gap-3">
      <a href="/" class="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2962ff] hover:bg-[#1e53e5] text-white transition">Return to Chart</a>
      <button onclick="window.close()" class="px-4 py-2 rounded-lg text-xs bg-[#2a2e39] hover:bg-[#363a45] text-gray-300 transition">Close Window</button>
    </div>
  </div>
</body>
</html>"""

def render_fyers_auth_standalone() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fyers API v3 Authentication App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #0b0e14; color: #d1d4dc; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    .glass-panel { background: rgba(24, 28, 36, 0.85); backdrop-filter: blur(12px); border: 1px solid #2a2e39; }
    .btn-gradient { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
    .btn-gradient:hover { background: linear-gradient(135deg, #1d4ed8, #1e40af); }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">
  <div class="glass-panel rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-[#2a2e39]">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-[#2a2e39] bg-[#141822] flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-lg">
          ⚡
        </div>
        <div>
          <h1 class="text-base font-bold text-white tracking-wide">Fyers API v3 Authentication App</h1>
          <p class="text-xs text-[#787b86]">Official OAuth 2.0 Auth Code & Live Token Bridge</p>
        </div>
      </div>
      <a href="/" class="text-xs text-[#787b86] hover:text-white px-3 py-1.5 rounded-lg border border-[#2a2e39] bg-[#1a1e29] hover:bg-[#252a3a] transition flex items-center gap-1.5">
        <i class="fa-solid fa-arrow-left text-[10px]"></i> Back to Chart
      </a>
    </div>

    <!-- Status Banner -->
    <div class="p-6 space-y-5">
      <div id="auth-status-card" class="p-4 rounded-xl border border-[#2a2e39] bg-[#12151e] flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span id="auth-status-dot" class="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]"></span>
          <div>
            <div id="auth-status-title" class="text-xs font-semibold text-white">Status: Disconnected</div>
            <div id="auth-status-sub" class="text-[11px] text-[#787b86]">No active Fyers session. Log in below to stream live market ticks.</div>
          </div>
        </div>
        <button id="btn-disconnect-app" class="hidden text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 transition">
          Disconnect
        </button>
      </div>

      <!-- Step 1: App Credentials -->
      <div class="space-y-3 bg-[#131722]/60 p-4 rounded-xl border border-[#232733]">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-[#2962ff]/20 text-[#2962ff] text-[11px] flex items-center justify-center font-bold">1</span>
            Fyers App Credentials
          </span>
          <a href="https://myapi.fyers.in" target="_blank" class="text-[11px] text-[#2962ff] hover:underline flex items-center gap-1">
            myapi.fyers.in <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] text-[#848e9c] mb-1">App ID (Client ID)</label>
            <input type="text" id="fyers-app-id" placeholder="e.g. XC12345-100" class="w-full bg-[#0d1017] border border-[#2a2e39] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#2962ff] focus:outline-none font-mono">
          </div>
          <div>
            <label class="block text-[11px] text-[#848e9c] mb-1">Secret Key (App Secret)</label>
            <input type="password" id="fyers-secret-key" placeholder="Enter App Secret" class="w-full bg-[#0d1017] border border-[#2a2e39] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#2962ff] focus:outline-none font-mono">
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="text-[11px] text-[#848e9c]">Redirect URI (Configured in your Fyers Dashboard)</label>
            <div class="flex items-center space-x-1.5">
              <button type="button" id="btn-use-standard-uri" class="text-[10px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 transition font-medium cursor-pointer">
                Standard Fyers URL
              </button>
              <button type="button" id="btn-copy-redirect" class="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer">
                <i class="fa-regular fa-copy"></i> Copy URI
              </button>
            </div>
          </div>
          <input type="text" id="fyers-redirect-uri" value="https://trade.fyers.in/api-login/redirect-uri/index.html" class="w-full bg-[#0d1017] border border-[#2a2e39] rounded-lg px-3 py-2 text-xs text-white font-mono text-[11px]">
          <p class="text-[10px] text-gray-400 mt-1">Official Fyers Redirect URL: <code class="text-amber-400 font-mono select-all">https://trade.fyers.in/api-login/redirect-uri/index.html</code> (Matches your Fyers Developer Dashboard App).</p>
        </div>
      </div>

      <!-- Step 2: 1-Click Fast Login -->
      <div class="space-y-3 bg-[#131722]/60 p-4 rounded-xl border border-[#232733]">
        <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-[#2962ff]/20 text-[#2962ff] text-[11px] flex items-center justify-center font-bold">2</span>
          1-Click Fyers OAuth Login
        </span>
        <p class="text-xs text-[#848e9c]">Click below to launch official Fyers 2FA / TOTP login in a secure window:</p>
        <button id="btn-launch-oauth" class="w-full btn-gradient py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-2 transition cursor-pointer">
          <i class="fa-solid fa-bolt"></i> Launch Fyers Login
        </button>
      </div>

      <!-- Step 3: Manual Auth Code Fallback -->
      <div class="space-y-3 bg-[#131722]/60 p-4 rounded-xl border border-[#232733]">
        <span class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-[#2962ff]/20 text-[#2962ff] text-[11px] flex items-center justify-center font-bold">3</span>
          Manual Auth Code or Redirect URL Exchange
        </span>
        <p class="text-[11px] text-[#848e9c]">If you use standard Fyers redirect URL (<code>trade.fyers.in/api-login/...</code>) or popup was blocked, paste the full URL or auth_code:</p>
        <div class="flex gap-2">
          <input type="text" id="fyers-auth-code-input" placeholder="Paste auth_code or full redirected browser URL here..." class="flex-1 bg-[#0d1017] border border-[#2a2e39] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-[#2962ff] focus:outline-none font-mono">
          <button id="btn-exchange-code" class="px-4 py-2 rounded-lg text-xs font-bold bg-[#2962ff] hover:bg-[#1e53e5] text-white transition shrink-0">
            Generate Token
          </button>
        </div>
      </div>

      <!-- Feedback Alert -->
      <div id="auth-alert" class="hidden p-3 rounded-lg text-xs font-medium border"></div>
    </div>
  </div>

  <script>
    const appEl = {
      appId: document.getElementById('fyers-app-id'),
      secretKey: document.getElementById('fyers-secret-key'),
      redirectUri: document.getElementById('fyers-redirect-uri'),
      authCode: document.getElementById('fyers-auth-code-input'),
      btnLaunch: document.getElementById('btn-launch-oauth'),
      btnExchange: document.getElementById('btn-exchange-code'),
      btnCopy: document.getElementById('btn-copy-redirect'),
      btnDisconnect: document.getElementById('btn-disconnect-app'),
      statusDot: document.getElementById('auth-status-dot'),
      statusTitle: document.getElementById('auth-status-title'),
      statusSub: document.getElementById('auth-status-sub'),
      alert: document.getElementById('auth-alert')
    };

    function showAlert(msg, isError = false) {
      appEl.alert.textContent = msg;
      appEl.alert.className = isError 
        ? 'p-3 rounded-lg text-xs font-medium border bg-red-950/40 text-red-300 border-red-800/40 block' 
        : 'p-3 rounded-lg text-xs font-medium border bg-emerald-950/40 text-emerald-300 border-emerald-800/40 block';
    }

    async function loadConfig() {
      try {
        const r = await fetch('/api/fyers/config');
        const cfg = await r.json();
        if (cfg.app_id) appEl.appId.value = cfg.app_id;
        if (cfg.secret_key) appEl.secretKey.value = cfg.secret_key;
        appEl.redirectUri.value = cfg.redirect_uri || 'https://trade.fyers.in/api-login/redirect-uri/index.html';

        const isConnected = cfg.enabled && cfg.has_token && cfg.status === 'Connected';
        if (isConnected) {
          appEl.statusDot.className = 'w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse';
          const name = cfg.profile?.name || 'Trader';
          const fyId = cfg.profile?.fy_id || '';
          appEl.statusTitle.textContent = `Status: Connected as ${name} (${fyId || 'Live Feed Active'})`;
          appEl.statusTitle.className = 'text-xs font-bold text-emerald-400';
          appEl.statusSub.textContent = `Active token generated: ${cfg.token_updated_at || 'Today'}. Live quotes & historical charts enabled.`;
          appEl.btnDisconnect.classList.remove('hidden');
        } else {
          appEl.statusDot.className = 'w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]';
          appEl.statusTitle.textContent = 'Status: Disconnected';
          appEl.statusTitle.className = 'text-xs font-semibold text-white';
          appEl.statusSub.textContent = 'No active Fyers session. Log in below to stream live market ticks.';
          appEl.btnDisconnect.classList.add('hidden');
        }
      } catch(e) {}
    }

    appEl.btnCopy?.addEventListener('click', () => {
      const uri = appEl.redirectUri.value.trim();
      navigator.clipboard.writeText(uri).then(() => {
        appEl.btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          appEl.btnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copy URI';
        }, 2000);
      });
    });

    appEl.btnLaunch?.addEventListener('click', async () => {
      const appId = appEl.appId.value.trim();
      const secret = appEl.secretKey.value.trim();
      const redirectUri = appEl.redirectUri.value.trim();

      if (!appId || !secret) {
        showAlert('Please provide both App ID and Secret Key first.', true);
        return;
      }

      appEl.btnLaunch.disabled = true;
      appEl.btnLaunch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Fyers Login URL...';

      try {
        const resp = await fetch('/api/fyers/auth-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId, secret_key: secret, redirect_uri: redirectUri })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
          showAlert('Opening Fyers login window... Complete 2FA login in the popup window.');
          window.open(res.auth_url, 'fyers_oauth_popup', 'width=620,height=750,menubar=no,toolbar=no');
        } else {
          showAlert(res.message || 'Failed to generate auth url', true);
        }
      } catch(e) {
        showAlert('Network error: ' + e.message, true);
      } finally {
        appEl.btnLaunch.disabled = false;
        appEl.btnLaunch.innerHTML = '<i class="fa-solid fa-bolt"></i> Launch Fyers Login';
      }
    });

    appEl.btnExchange?.addEventListener('click', async () => {
      const code = appEl.authCode.value.trim();
      const appId = appEl.appId.value.trim();
      const secret = appEl.secretKey.value.trim();
      const redirectUri = appEl.redirectUri.value.trim();

      if (!code) {
        showAlert('Please paste the auth_code or full redirected URL first.', true);
        return;
      }

      appEl.btnExchange.disabled = true;
      appEl.btnExchange.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

      try {
        const resp = await fetch('/api/fyers/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth_code: code, app_id: appId, secret_key: secret, redirect_uri: redirectUri })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
          showAlert(res.message);
          appEl.authCode.value = '';
          loadConfig();
        } else {
          showAlert(res.message || 'Failed to exchange token', true);
        }
      } catch(e) {
        showAlert('Network error: ' + e.message, true);
      } finally {
        appEl.btnExchange.disabled = false;
        appEl.btnExchange.innerHTML = 'Generate Token';
      }
    });

    appEl.btnDisconnect?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to disconnect Fyers live session?')) return;
      await fetch('/api/fyers/disconnect', { method: 'POST' });
      showAlert('Disconnected from Fyers.');
      loadConfig();
    });

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'FYERS_AUTH_SUCCESS') {
        showAlert('🎉 Successfully authenticated with Fyers via 1-Click OAuth!');
        loadConfig();
      }
    });

    loadConfig();
  </script>
</body>
</html>"""
