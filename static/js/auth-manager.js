/**
 * TraderView - Authentication, User Profiles & Admin Traffic Analytics
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('tradeview_token') || null;
    this.currentUser = null;
    this.currentSettings = null;
    this.adminRefreshInterval = null;

    this.init();
  }

  getAuthHeaders() {
    return this.token ? { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async init() {
    this.bindDOMEvents();

    if (this.token) {
      await this.fetchCurrentUser();
    } else {
      this.updateHeaderUI();
      // Enforce strict authentication wall: charts will not work until user is signed in
      this.openAuthModal('login');
    }
  }

  bindDOMEvents() {
    // Auth Button in Header
    const btnAuth = document.getElementById('btn-user-auth');
    const profileMenu = document.getElementById('user-profile-menu');
    if (btnAuth && profileMenu) {
      btnAuth.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.currentUser) {
          this.openAuthModal('login');
        } else {
          profileMenu.classList.toggle('hidden');
        }
      });

      document.addEventListener('click', (e) => {
        if (!profileMenu.contains(e.target) && e.target !== btnAuth) {
          profileMenu.classList.add('hidden');
        }
      });
    }

    // Profile Dropdown Actions
    document.getElementById('btn-save-profile-setup')?.addEventListener('click', () => {
      profileMenu?.classList.add('hidden');
      this.saveCurrentWorkspace();
    });

    document.getElementById('btn-profile-logout')?.addEventListener('click', () => {
      profileMenu?.classList.add('hidden');
      this.logout();
    });

    // Admin Button in Header
    document.getElementById('btn-top-admin')?.addEventListener('click', () => {
      this.openAdminModal();
    });

    // Change Password Modal Events
    document.getElementById('btn-open-change-pwd')?.addEventListener('click', () => {
      document.getElementById('user-profile-menu')?.classList.add('hidden');
      this.openChangePasswordModal();
    });
    document.getElementById('btn-close-change-pwd-modal')?.addEventListener('click', () => this.closeChangePasswordModal());
    document.getElementById('btn-cancel-change-pwd')?.addEventListener('click', () => this.closeChangePasswordModal());
    document.getElementById('form-change-password')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleChangePassword();
    });
    document.getElementById('btn-close-admin-modal')?.addEventListener('click', () => this.closeAdminModal());
    document.getElementById('btn-close-create-user-modal')?.addEventListener('click', () => this.closeCreateUserModal());
    document.getElementById('btn-cancel-create-user')?.addEventListener('click', () => this.closeCreateUserModal());

    // Auth Modal Tabs (Sign In / Sign Up)
    document.getElementById('tab-auth-login')?.addEventListener('click', () => this.switchAuthTab('login'));
    document.getElementById('tab-auth-register')?.addEventListener('click', () => this.switchAuthTab('register'));

    // Auth Forms Submit
    document.getElementById('form-auth-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('form-auth-register')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Admin Dashboard Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-admin-tab');
        this.switchAdminTab(tab);
      });
    });

    // Admin Refresh
    document.getElementById('btn-admin-refresh')?.addEventListener('click', () => {
      this.loadAdminData();
    });

    // Admin Add User Button
    document.getElementById('btn-admin-add-user')?.addEventListener('click', () => {
      this.openCreateUserModal();
    });

    // Admin Create User Form
    document.getElementById('form-admin-create-user')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAdminCreateUser();
    });

    // SMTP & Email Panel Listeners
    document.getElementById('btn-save-smtp-config')?.addEventListener('click', () => this.saveSmtpConfig());
    document.getElementById('btn-send-test-email')?.addEventListener('click', () => this.sendTestEmail());
    document.getElementById('btn-refresh-email-logs')?.addEventListener('click', () => this.loadEmailLogs());
  }

  async fetchCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', { headers: this.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this.updateHeaderUI();
        await this.loadUserSettings();
      } else {
        // Token expired / invalid
        this.token = null;
        localStorage.removeItem('tradeview_token');
        this.currentUser = null;
        this.updateHeaderUI();
      }
    } catch (e) {
      console.warn('Error fetching current user:', e);
    }
  }

  updateHeaderUI() {
    const btnAuth = document.getElementById('btn-user-auth');
    const headerUsername = document.getElementById('header-username');
    const adminBtn = document.getElementById('btn-top-admin');
    const menuName = document.getElementById('profile-menu-name');
    const menuRole = document.getElementById('profile-menu-role');

    if (this.currentUser) {
      if (headerUsername) headerUsername.textContent = this.currentUser.username;
      if (menuName) menuName.textContent = this.currentUser.username;
      if (menuRole) menuRole.textContent = this.currentUser.role === 'admin' ? 'Administrator' : 'Standard User';

      if (btnAuth) {
        btnAuth.className = 'tv-btn bg-[#1e222d] border border-[#2a2e39] hover:border-[#2962ff] px-2.5 py-1 text-xs font-semibold shrink-0 transition flex items-center space-x-1.5 shadow-sm cursor-pointer text-[#d1d4dc]';
      }

      // Show Admin button if admin
      if (adminBtn) {
        if (this.currentUser.role === 'admin') {
          adminBtn.classList.remove('hidden');
        } else {
          adminBtn.classList.add('hidden');
        }
      }
    } else {
      if (headerUsername) headerUsername.textContent = 'Sign In / Register';
      if (btnAuth) {
        btnAuth.className = 'px-3 py-1 rounded text-xs font-bold bg-[#2962ff] hover:bg-[#1e53e5] text-white shadow-md flex items-center space-x-1.5 shrink-0 transition cursor-pointer select-none';
      }
      if (adminBtn) adminBtn.classList.add('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // ----------------- Auth Modal & Actions -----------------

  openAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    this.switchAuthTab(tab);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeAuthModal() {
    // Only allow closing if user is authenticated
    if (!this.currentUser && !this.token) {
      return;
    }
    document.getElementById('auth-modal')?.classList.add('hidden');
  }

  switchAuthTab(tab) {
    const loginForm = document.getElementById('form-auth-login');
    const regForm = document.getElementById('form-auth-register');
    const tabLogin = document.getElementById('tab-auth-login');
    const tabReg = document.getElementById('tab-auth-register');
    const msgEl = document.getElementById('auth-error-msg');
    if (msgEl) msgEl.textContent = '';

    if (tab === 'login') {
      loginForm?.classList.remove('hidden');
      regForm?.classList.add('hidden');
      tabLogin?.classList.add('border-[#2962ff]', 'text-white');
      tabLogin?.classList.remove('border-transparent', 'text-[#787b86]');
      tabReg?.classList.remove('border-[#2962ff]', 'text-white');
      tabReg?.classList.add('border-transparent', 'text-[#787b86]');
    } else {
      regForm?.classList.remove('hidden');
      loginForm?.classList.add('hidden');
      tabReg?.classList.add('border-[#2962ff]', 'text-white');
      tabReg?.classList.remove('border-transparent', 'text-[#787b86]');
      tabLogin?.classList.remove('border-[#2962ff]', 'text-white');
      tabLogin?.classList.add('border-transparent', 'text-[#787b86]');
    }
  }

  async handleLogin() {
    const username = document.getElementById('login-username-input')?.value.trim();
    const password = document.getElementById('login-password-input')?.value;
    const auth_code = document.getElementById('login-authcode-input')?.value.trim().toUpperCase() || '';
    const msgEl = document.getElementById('auth-error-msg');

    try {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#2962ff] animate-pulse';
        msgEl.textContent = 'Authenticating...';
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, auth_code })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('tradeview_token', this.token);
      this.updateHeaderUI();
      this.closeAuthModal();

      // Load user profile & settings
      await this.loadUserSettings();

      // Boot all charts with authenticated data feed
      if (window.app?.multiChartGrid) {
        window.app.multiChartGrid.instances.forEach(inst => inst.loadData());
      }
      if (window.watchlistPanel) {
        window.watchlistPanel.renderWatchlist();
      }

    } catch (e) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = `✕ ${e.message}`;
      }
    }
  }

  async handleRegister() {
    const username = document.getElementById('register-username-input')?.value.trim();
    const password = document.getElementById('register-password-input')?.value;
    const email = document.getElementById('register-email-input')?.value.trim();
    const msgEl = document.getElementById('auth-error-msg');

    if (!email) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = '✕ Email address is required';
      }
      return;
    }

    try {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#2962ff] animate-pulse';
        msgEl.textContent = 'Submitting registration for approval...';
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      if (data.status === 'pending_approval') {
        if (msgEl) {
          msgEl.className = 'text-xs text-amber-400 font-semibold p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 leading-relaxed';
          msgEl.innerHTML = `<b>✓ Registration Submitted!</b><br>An intimation has been sent to the administrator (jaipal.nair@gmail.com). Once approved, your 10-character authorization code will be emailed to <b>${email}</b>.`;
        }
        // Reset fields
        const uIn = document.getElementById('register-username-input');
        const pIn = document.getElementById('register-password-input');
        const eIn = document.getElementById('register-email-input');
        if (uIn) uIn.value = '';
        if (pIn) pIn.value = '';
        if (eIn) eIn.value = '';
        return;
      }

      // If pre-approved
      if (data.token) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem('tradeview_token', this.token);
        this.updateHeaderUI();
        this.closeAuthModal();
      }

    } catch (e) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = `✕ ${e.message}`;
      }
    }
  }

  async logout() {
    if (this.token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: this.getAuthHeaders() });
      } catch (e) {}
    }
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('tradeview_token');
    window.location.reload();
  }

  // ----------------- Profile Settings Persistence -----------------

  async loadUserSettings() {
    if (!this.token) return;
    try {
      const res = await fetch('/api/user/settings', { headers: this.getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const settings = data.settings || {};
      this.currentSettings = settings;

      // Apply settings if present
      if (settings.layout && window.app?.multiChartGrid) {
        window.app.multiChartGrid.setLayout(settings.layout);
      }
      if (settings.activeWatchlist && window.watchlistPanel) {
        window.watchlistPanel.setWatchlist(settings.activeWatchlist);
      }
    } catch (e) {
      console.warn('Error loading user settings:', e);
    }
  }

  async saveCurrentWorkspace() {
    if (!this.currentUser) {
      this.openAuthModal('login');
      return;
    }

    try {
      const grid = window.app?.multiChartGrid;
      const instances = grid ? grid.instances : [];

      const payload = {
        layout: grid ? grid.currentLayout : '4g',
        activeWatchlist: window.watchlistPanel ? window.watchlistPanel.activeWatchlistKey : 'indices',
        theme: document.body.classList.contains('light-theme') ? 'light' : 'dark',
        charts: instances.map(inst => ({
          symbol: inst.symbol,
          interval: inst.interval,
          chartType: inst.chartType,
          activeIndicators: Array.from(inst.activeIndicators || [])
        })),
        updated_at: new Date().toISOString()
      };

      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('✓ Workspace & chart settings saved to your profile cloud database!');
      } else {
        alert('Failed to save settings.');
      }
    } catch (e) {
      alert(`Error saving workspace: ${e.message}`);
    }
  }

  // ----------------- Admin Dashboard -----------------

  async openAdminModal() {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      alert('Administrator access required.');
      return;
    }
    const modal = document.getElementById('admin-panel-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    await this.loadAdminData();

    // Auto-refresh every 10 seconds while open
    clearInterval(this.adminRefreshInterval);
    this.adminRefreshInterval = setInterval(() => this.loadAdminData(), 10000);
  }

  closeAdminModal() {
    document.getElementById('admin-panel-modal')?.classList.add('hidden');
    clearInterval(this.adminRefreshInterval);
  }

  switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-admin-tab') === tab) {
        btn.classList.add('border-[#7c3aed]', 'text-white', 'bg-[#7c3aed]/20');
        btn.classList.remove('border-transparent', 'text-[#787b86]');
      } else {
        btn.classList.remove('border-[#7c3aed]', 'text-white', 'bg-[#7c3aed]/20');
        btn.classList.add('border-transparent', 'text-[#787b86]');
      }
    });

    ['admin-tab-users-content', 'admin-tab-approvals-content', 'admin-tab-activity-content', 'admin-tab-endpoints-content', 'admin-tab-smtp-content'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });

    if (tab === 'users') {
      document.getElementById('admin-tab-users-content')?.classList.remove('hidden');
    } else if (tab === 'approvals') {
      document.getElementById('admin-tab-approvals-content')?.classList.remove('hidden');
      this.loadPendingUsers();
    } else if (tab === 'activity') {
      document.getElementById('admin-tab-activity-content')?.classList.remove('hidden');
    } else if (tab === 'endpoints') {
      document.getElementById('admin-tab-endpoints-content')?.classList.remove('hidden');
    } else if (tab === 'smtp') {
      document.getElementById('admin-tab-smtp-content')?.classList.remove('hidden');
      this.loadSmtpConfig();
      this.loadEmailLogs();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async loadAdminData() {
    try {
      // 1. Stats
      await this.loadPendingUsers();
      const statsRes = await fetch('/api/admin/stats', { headers: this.getAuthHeaders() });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const s = statsData.data;
        document.getElementById('admin-kpi-total-users').textContent = s.total_users || 0;
        document.getElementById('admin-kpi-active-today').textContent = s.active_users_today || 0;
        document.getElementById('admin-kpi-active-sessions').textContent = s.active_sessions || 0;
        document.getElementById('admin-kpi-total-requests').textContent = s.total_requests || 0;

        // Render top endpoints
        const epBody = document.getElementById('admin-endpoints-list');
        if (epBody && s.top_endpoints) {
          epBody.innerHTML = s.top_endpoints.map(ep => `
            <div class="flex items-center justify-between p-2.5 rounded bg-[#131722] border border-[#2a2e39] text-xs font-mono">
              <span class="text-[#d1d4dc] font-semibold">${ep.endpoint}</span>
              <span class="px-2 py-0.5 rounded bg-[#2962ff]/20 text-[#2962ff] font-bold">${ep.count} hits</span>
            </div>
          `).join('');
        }
      }

      // 2. Users Table
      const usersRes = await fetch('/api/admin/users', { headers: this.getAuthHeaders() });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const tbody = document.getElementById('admin-users-table-body');
        if (tbody) {
          tbody.innerHTML = (usersData.users || []).map(u => {
            const isAdmin = u.role === 'admin';
            const isActive = !!u.is_active;
            const authCodeHtml = u.auth_code ? `
              <div class="flex items-center space-x-1">
                <span class="font-mono text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 text-[11px]">${u.auth_code}</span>
                <button onclick="window.authManager.copyToClipboard('${u.auth_code}')" class="p-1 hover:text-white text-[#787b86]" title="Copy Auth Code">
                  <i data-lucide="copy" class="w-3 h-3"></i>
                </button>
              </div>
            ` : '<span class="text-[#787b86]">—</span>';

            return `
              <tr class="border-b border-[#2a2e39]/50 hover:bg-[#1e222d]/60 font-mono text-xs">
                <td class="py-2.5 px-3 text-white font-bold">${u.id}</td>
                <td class="py-2.5 px-3 text-white font-semibold">
                  <div class="flex items-center space-x-1.5">
                    <span class="w-2 h-2 rounded-full ${isActive ? 'bg-[#089981]' : 'bg-[#f23645]'}"></span>
                    <span>${u.username}</span>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[#787b86]">${u.email || '—'}</td>
                <td class="py-2.5 px-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isAdmin ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-[#2962ff]/20 text-[#2962ff] border border-[#2962ff]/30'}">
                    ${u.role.toUpperCase()}
                  </span>
                </td>
                <td class="py-2.5 px-3">${authCodeHtml}</td>
                <td class="py-2.5 px-3 text-[#787b86] text-[11px]">${u.created_at}</td>
                <td class="py-2.5 px-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-[#089981]/20 text-[#089981]' : 'bg-[#f23645]/20 text-[#f23645]'}">
                    ${isActive ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </td>
                <td class="py-2.5 px-3 text-right">
                  <div class="flex items-center justify-end space-x-1.5">
                    ${!isAdmin ? `
                      <button onclick="window.authManager.resendAuthCode(${u.id})" class="px-2 py-1 rounded text-[11px] font-semibold bg-[#2962ff]/20 hover:bg-[#2962ff] text-[#2962ff] hover:text-white transition" title="Resend Code Email">
                        Resend Code
                      </button>
                    ` : ''}
                    <button class="btn-admin-toggle-user px-2 py-1 rounded text-[11px] font-semibold bg-[#2a2e39] hover:bg-[#2962ff] text-white transition" data-id="${u.id}" data-active="${isActive}">
                      ${isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn-admin-reset-pwd px-2 py-1 rounded text-[11px] font-semibold bg-[#2a2e39] hover:bg-amber-500 text-white transition" data-id="${u.id}" data-username="${u.username}">
                      Reset Key
                    </button>
                    ${!isAdmin ? `
                      <button class="btn-admin-delete-user px-2 py-1 rounded text-[11px] font-semibold bg-[#2a2e39] hover:bg-[#f23645] text-white transition" data-id="${u.id}" data-username="${u.username}">
                        Delete
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Bind Action Buttons
          tbody.querySelectorAll('.btn-admin-toggle-user').forEach(b => {
            b.addEventListener('click', () => {
              const id = b.getAttribute('data-id');
              const currentActive = b.getAttribute('data-active') === 'true';
              this.toggleUserStatus(id, !currentActive);
            });
          });

          tbody.querySelectorAll('.btn-admin-reset-pwd').forEach(b => {
            b.addEventListener('click', () => {
              const id = b.getAttribute('data-id');
              const username = b.getAttribute('data-username');
              this.promptResetPassword(id, username);
            });
          });

          tbody.querySelectorAll('.btn-admin-delete-user').forEach(b => {
            b.addEventListener('click', () => {
              const id = b.getAttribute('data-id');
              const username = b.getAttribute('data-username');
              this.deleteUser(id, username);
            });
          });
        }
      }

      // 3. Activity Table
      const actRes = await fetch('/api/admin/activity?limit=50', { headers: this.getAuthHeaders() });
      if (actRes.ok) {
        const actData = await actRes.json();
        const actTbody = document.getElementById('admin-activity-table-body');
        if (actTbody) {
          actTbody.innerHTML = (actData.activity || []).map(a => `
            <tr class="border-b border-[#2a2e39]/40 hover:bg-[#1e222d]/60 font-mono text-[11px]">
              <td class="py-2 px-3 text-[#787b86]">${a.timestamp}</td>
              <td class="py-2 px-3 text-white font-semibold">${a.username || 'guest'}</td>
              <td class="py-2 px-3 text-[#d1d4dc]"><span class="text-[#2962ff] font-bold">${a.method}</span> ${a.endpoint}</td>
              <td class="py-2 px-3 text-[#787b86]">${a.ip_address}</td>
              <td class="py-2 px-3 font-bold ${a.status_code < 400 ? 'text-[#089981]' : 'text-[#f23645]'}">${a.status_code}</td>
            </tr>
          `).join('');
        }
      }

    } catch (e) {
      console.warn('Error loading admin data:', e);
    }
  }

  async toggleUserStatus(userId, newStatus) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ is_active: newStatus })
      });
      if (res.ok) {
        this.loadAdminData();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to update user status');
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async promptResetPassword(userId, username) {
    const newPwd = prompt(`Enter new password for user '${username}':`);
    if (!newPwd || newPwd.trim().length < 4) {
      if (newPwd !== null) alert('Password must be at least 4 characters');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ new_password: newPwd.trim() })
      });
      if (res.ok) {
        alert(`✓ Password for '${username}' has been updated successfully!`);
        this.loadAdminData();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to reset password');
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to permanently delete user '${username}' and their saved settings?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        this.loadAdminData();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to delete user');
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  // ----------------- Create User Modal -----------------

  openCreateUserModal() {
    document.getElementById('admin-create-user-modal')?.classList.remove('hidden');
    document.getElementById('admin-create-user-status-msg').textContent = '';
  }

  closeCreateUserModal() {
    document.getElementById('admin-create-user-modal')?.classList.add('hidden');
  }

  async handleAdminCreateUser() {
    const username = document.getElementById('new-user-username-input')?.value.trim();
    const password = document.getElementById('new-user-password-input')?.value.trim();
    const email = document.getElementById('new-user-email-input')?.value.trim();
    const role = document.getElementById('new-user-role-select')?.value || 'user';
    const statusMsg = document.getElementById('admin-create-user-status-msg');

    try {
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#2962ff] animate-pulse';
        statusMsg.textContent = 'Creating user...';
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ username, password, email, role })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create user');
      }

      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#089981] font-semibold';
        statusMsg.textContent = `✓ User '${username}' created successfully!`;
      }

      setTimeout(() => {
        this.closeCreateUserModal();
        this.loadAdminData();
      }, 1000);

    } catch (e) {
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#f23645] font-semibold';
        statusMsg.textContent = `✕ ${e.message}`;
      }
    }
  }

  // ----------------- Change Password -----------------

  openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    const curIn = document.getElementById('change-current-pwd-input');
    const newIn = document.getElementById('change-new-pwd-input');
    const confIn = document.getElementById('change-confirm-pwd-input');
    if (curIn) curIn.value = '';
    if (newIn) newIn.value = '';
    if (confIn) confIn.value = '';
    const msgEl = document.getElementById('change-pwd-status-msg');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.className = 'text-center text-xs';
    }
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeChangePasswordModal() {
    document.getElementById('change-password-modal')?.classList.add('hidden');
  }

  async handleChangePassword() {
    const curPwd = document.getElementById('change-current-pwd-input')?.value;
    const newPwd = document.getElementById('change-new-pwd-input')?.value;
    const confirmPwd = document.getElementById('change-confirm-pwd-input')?.value;
    const msgEl = document.getElementById('change-pwd-status-msg');

    if (newPwd !== confirmPwd) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = '✕ New passwords do not match';
      }
      return;
    }

    try {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#2962ff] animate-pulse';
        msgEl.textContent = 'Updating password...';
      }

      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          current_password: curPwd,
          new_password: newPwd
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to change password');
      }

      if (msgEl) {
        msgEl.className = 'text-xs text-[#089981] font-semibold';
        msgEl.textContent = '✓ Password updated successfully!';
      }

      setTimeout(() => {
        this.closeChangePasswordModal();
      }, 1200);

    } catch (e) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = `✕ ${e.message}`;
      }
    }
  }

  // ----------------- User Approvals & Authorization -----------------

  async loadPendingUsers() {
    try {
      const res = await fetch('/api/admin/pending-users', { headers: this.getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const pending = data.pending_users || [];
      const badge = document.getElementById('admin-pending-count-badge');
      if (badge) {
        badge.textContent = pending.length;
        if (pending.length > 0) {
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      const tbody = document.getElementById('admin-pending-table-body');
      const emptyMsg = document.getElementById('admin-pending-empty-msg');
      if (!tbody) return;

      if (pending.length === 0) {
        tbody.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
      }

      if (emptyMsg) emptyMsg.classList.add('hidden');
      tbody.innerHTML = pending.map(u => `
        <tr class="border-b border-[#2a2e39]/50 hover:bg-[#1e222d]/60 font-mono text-xs">
          <td class="py-2.5 px-3 text-white font-bold">${u.id}</td>
          <td class="py-2.5 px-3 text-white font-semibold">
            <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">${u.username}</span>
          </td>
          <td class="py-2.5 px-3 text-[#2962ff] font-semibold">${u.email}</td>
          <td class="py-2.5 px-3 text-[#787b86] text-[11px]">${u.created_at}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              PENDING APPROVAL
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <div class="flex items-center justify-end space-x-2">
              <button onclick="window.authManager.approvePendingUser(${u.id}, '${u.username}', '${u.email}')" class="px-3 py-1 rounded text-xs font-semibold bg-[#089981] hover:bg-[#0bb397] text-white transition shadow flex items-center space-x-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Approve & Send Code</span>
              </button>
              <button onclick="window.authManager.rejectPendingUser(${u.id}, '${u.username}')" class="px-2.5 py-1 rounded text-xs font-semibold bg-[#2a2e39] hover:bg-[#f23645] text-[#787b86] hover:text-white transition">
                Reject
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      console.warn('Error loading pending users:', e);
    }
  }

  async approvePendingUser(userId, username, email) {
    if (!confirm(`Authorize user '${username}' (${email})?\nThis will generate a 10-character code and email it to them.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Approval failed');
        return;
      }
      alert(`✓ User '${username}' approved!\n\n10-Character Authorization Code: ${data.auth_code}\n\nSent to: ${email}`);
      await this.loadAdminData();
      await this.loadPendingUsers();
    } catch (e) {
      alert(`Error approving user: ${e.message}`);
    }
  }

  async rejectPendingUser(userId, username) {
    if (!confirm(`Are you sure you want to decline registration for '${username}'?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Reject failed');
        return;
      }
      alert(`User registration for '${username}' was declined.`);
      await this.loadAdminData();
      await this.loadPendingUsers();
    } catch (e) {
      alert(`Error rejecting user: ${e.message}`);
    }
  }

  async resendAuthCode(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-code`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'Failed to resend authorization code');
        return;
      }
      alert(`✓ ${data.message}\nCode: ${data.auth_code}`);
    } catch (e) {
      alert(`Error resending code: ${e.message}`);
    }
  }

  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert(`Copied authorization code: ${text}`);
    } else {
      prompt('Copy Authorization Code:', text);
    }
  }

  // ----------------- SMTP & Email Management -----------------

  async loadSmtpConfig() {
    try {
      const res = await fetch('/api/admin/smtp-config', { headers: this.getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const cfg = data.config;

      const ind = document.getElementById('smtp-status-indicator');
      if (ind) {
        if (cfg.is_configured) {
          ind.className = 'text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          ind.textContent = 'Active (Ready)';
        } else {
          ind.className = 'text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30';
          ind.textContent = 'App Password Needed';
        }
      }

      const hostIn = document.getElementById('smtp-host-input');
      const portIn = document.getElementById('smtp-port-input');
      const userIn = document.getElementById('smtp-user-input');
      const adminIn = document.getElementById('smtp-admin-email-input');

      if (hostIn && cfg.host) hostIn.value = cfg.host;
      if (portIn && cfg.port) portIn.value = cfg.port;
      if (userIn && cfg.user) userIn.value = cfg.user;
      if (adminIn && cfg.admin_email) adminIn.value = cfg.admin_email;
    } catch (e) {
      console.warn('Error loading SMTP config:', e);
    }
  }

  async saveSmtpConfig() {
    const statusEl = document.getElementById('smtp-save-status');
    const host = document.getElementById('smtp-host-input')?.value;
    const port = document.getElementById('smtp-port-input')?.value;
    const user = document.getElementById('smtp-user-input')?.value;
    const pwd = document.getElementById('smtp-password-input')?.value;
    const adminEmail = document.getElementById('smtp-admin-email-input')?.value;

    try {
      if (statusEl) {
        statusEl.className = 'text-xs text-[#2962ff] animate-pulse';
        statusEl.textContent = 'Saving settings...';
      }

      const payload = {
        smtp_host: host,
        smtp_port: port,
        smtp_user: user,
        admin_email: adminEmail
      };
      if (pwd) payload.smtp_password = pwd;

      const res = await fetch('/api/admin/smtp-config', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');

      if (statusEl) {
        statusEl.className = 'text-xs text-emerald-400 font-semibold';
        statusEl.textContent = '✓ Saved successfully!';
        setTimeout(() => { statusEl.textContent = ''; }, 2500);
      }
      await this.loadSmtpConfig();
    } catch (e) {
      if (statusEl) {
        statusEl.className = 'text-xs text-[#f23645] font-semibold';
        statusEl.textContent = `✕ ${e.message}`;
      }
    }
  }

  async sendTestEmail() {
    const target = document.getElementById('smtp-test-target-input')?.value.trim();
    const msgEl = document.getElementById('smtp-test-result-msg');
    if (!target) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645]';
        msgEl.textContent = 'Please provide target email';
      }
      return;
    }

    try {
      if (msgEl) {
        msgEl.className = 'text-xs text-emerald-400 animate-pulse';
        msgEl.textContent = 'Dispatching test email...';
      }

      const res = await fetch('/api/admin/send-test-email', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email: target })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Email test failed');

      if (msgEl) {
        msgEl.className = 'text-xs text-emerald-400 font-semibold';
        msgEl.textContent = `✓ ${data.message}`;
      }
      await this.loadEmailLogs();
    } catch (e) {
      if (msgEl) {
        msgEl.className = 'text-xs text-[#f23645] font-semibold';
        msgEl.textContent = `✕ ${e.message}`;
      }
    }
  }

  async loadEmailLogs() {
    try {
      const res = await fetch('/api/admin/email-logs?limit=30', { headers: this.getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      const tbody = document.getElementById('admin-email-logs-table-body');
      if (!tbody) return;

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-[#787b86]">No emails logged yet.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => {
        const isSent = l.status === 'sent';
        return `
          <tr class="hover:bg-[#1e222d]/60">
            <td class="py-2 px-3 text-[#787b86]">${l.created_at}</td>
            <td class="py-2 px-3 text-white">${l.recipient}</td>
            <td class="py-2 px-3"><span class="px-1.5 py-0.5 rounded text-[10px] bg-[#2a2e39] text-[#d1d4dc]">${l.email_type}</span></td>
            <td class="py-2 px-3 text-[#d1d4dc]">${l.subject}</td>
            <td class="py-2 px-3">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isSent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                ${l.status.toUpperCase()}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.warn('Error loading email logs:', e);
    }
  }

}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.authManager = new AuthManager();
});
