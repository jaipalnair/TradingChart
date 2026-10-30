/**

 * Main Application Controller for TradeView Multi-Chart

 * Coordinates Header, Layout Picker, Sync Options, Modals, Hotkeys & UI

 */

class TradeViewApp {
  constructor() {
    // Full list of 13 supported timeframes grouped logically
    this.timeframes = [
      { tf: '1m', label: '1 minute', display: '1m', group: 'Minutes' },
      { tf: '2m', label: '2 minutes', display: '2m', group: 'Minutes' },
      { tf: '3m', label: '3 minutes', display: '3m', group: 'Minutes' },
      { tf: '5m', label: '5 minutes', display: '5m', group: 'Minutes' },
      { tf: '10m', label: '10 minutes', display: '10m', group: 'Minutes' },
      { tf: '15m', label: '15 minutes', display: '15m', group: 'Minutes' },
      { tf: '30m', label: '30 minutes', display: '30m', group: 'Minutes' },
      { tf: '1h', label: '1 hour', display: '1H', group: 'Hours' },
      { tf: '2h', label: '2 hours', display: '2H', group: 'Hours' },
      { tf: '4h', label: '4 hours', display: '4H', group: 'Hours' },
      { tf: '1d', label: '1 day', display: '1D', group: 'Days & Periods' },
      { tf: '1w', label: '1 week', display: '1W', group: 'Days & Periods' },
      { tf: '1M', label: '1 month', display: '1M', group: 'Days & Periods' }
    ];

    this.initTheme();
    this.init();
  }

  init() {

    // 1. Initialize Multi-Chart Grid

    const gridEl = document.getElementById('chart-grid');

    window.multiChartGrid = new MultiChartGrid(gridEl);

    // 2. Initialize Watchlist Panel

    const watchlistEl = document.getElementById('watchlist-panel-container');

    window.watchlistPanel = new WatchlistPanel(watchlistEl);

    // 3. Initialize Paper Trading Panel

    const paperEl = document.getElementById('paper-dock-container');

    window.paperPanel = new PaperTradingPanel(paperEl);

    // 4. Bind UI Event Handlers

    this.bindHeaderControls();

    this.bindDrawingToolbar();

    this.bindModals();

    this.bindHotkeys();

    this.initFyersIntegration();

    // 5. Market status & IST Clock checking

    this.updateMarketStatusBadge();

    this.updateISTClock();

    setInterval(() => this.updateMarketStatusBadge(), 10000);

    setInterval(() => this.updateISTClock(), 1000);

    // 6. Render SVG Icons

    if (window.lucide) {

      window.lucide.createIcons();

    }

  }

  updateHeaderForActiveChart(chartInstance) {

    if (!chartInstance) return;

    // Update Symbol button text

    const symBtnText = document.getElementById('header-symbol-text');

    if (symBtnText) {

      symBtnText.textContent = chartInstance.symbol;

    }

    // Update active timeframe pill and ensure active TF is visible

    this.renderHeaderTimeframePills();

    // Update sync badges

    this.updateSyncUI();

  }

  bindHeaderControls() {

    const layoutDropdown = document.getElementById('layout-picker-dropdown');

    const syncDropdown = document.getElementById('sync-options-dropdown');

    // Symbol Search Modal Trigger

    const symBtn = document.getElementById('btn-symbol-search');

    if (symBtn) {

      symBtn.addEventListener('click', () => this.openSymbolSearchModal());

    }

    // Timeframe selector with favorites

    this.initTimeframeControls();

    // Layout Selector Dropdown Trigger

    const layoutBtn = document.getElementById('btn-layout-picker');

    if (layoutBtn && layoutDropdown) {

      layoutBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        layoutDropdown.classList.toggle('hidden');

        if (syncDropdown) syncDropdown.classList.add('hidden');

      });

      // Grid options click

      layoutDropdown.querySelectorAll('.layout-opt-btn').forEach(btn => {

        btn.addEventListener('click', () => {

          const layout = btn.dataset.layout;

          window.multiChartGrid.applyLayout(layout);

          layoutDropdown.classList.add('hidden');

        });

      });

    }

    // Sync Options Dropdown Trigger

    const syncBtn = document.getElementById('btn-sync-options');

    if (syncBtn && syncDropdown) {

      syncBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        syncDropdown.classList.toggle('hidden');

        if (layoutDropdown) layoutDropdown.classList.add('hidden');

      });

      // Sync checkbox toggles

      document.getElementById('sync-crosshair-toggle')?.addEventListener('change', (e) => {

        window.multiChartGrid.syncCrosshair = e.target.checked;

        window.multiChartGrid.saveState();

        this.updateSyncUI();

      });

      document.getElementById('sync-symbol-toggle')?.addEventListener('change', (e) => {

        window.multiChartGrid.syncSymbol = e.target.checked;

        window.multiChartGrid.saveState();

        this.updateSyncUI();

      });

      document.getElementById('sync-interval-toggle')?.addEventListener('change', (e) => {

        window.multiChartGrid.syncInterval = e.target.checked;

        window.multiChartGrid.saveState();

        this.updateSyncUI();

      });

      document.getElementById('sync-time-toggle')?.addEventListener('change', (e) => {

        window.multiChartGrid.syncTime = e.target.checked;

        window.multiChartGrid.saveState();

        this.updateSyncUI();

      });

    }

    // Indicators Modal Trigger

    const indBtn = document.getElementById('btn-global-indicators');

    if (indBtn) {

      indBtn.addEventListener('click', () => {

        this.showIndicatorModal(window.multiChartGrid.activeChart);

      });

    }

    // Chart Type Dropdown Trigger

    const ctBtn = document.getElementById('btn-global-chart-type');

    if (ctBtn) {

      ctBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        this.showChartTypeDropdown(ctBtn, (type) => {

          window.multiChartGrid.changeChartType(type);

        });

      });

    }

    // Global Refresh All Charts

    const refreshBtn = document.getElementById('btn-refresh-all');

    if (refreshBtn) {

      refreshBtn.addEventListener('click', () => {

        refreshBtn.classList.add('animate-spin');

        if (window.multiChartGrid) {

          window.multiChartGrid.refreshAllCharts();

        }

        if (window.watchlistPanel) {

          window.watchlistPanel.renderWatchlist();

          window.watchlistPanel.renderDepth();

        }

        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);

      });

    }

    // Top Bar Watchlist Toggle

    const topWlBtn = document.getElementById('btn-top-toggle-sidebar');

    if (topWlBtn) {

      topWlBtn.addEventListener('click', () => {

        const sidebar = document.getElementById('watchlist-panel-container');

        if (sidebar && sidebar.classList.contains('collapsed')) {

          window.watchlistPanel?.restoreSidebar();

        } else {

          window.watchlistPanel?.collapseSidebar();

        }

      });

    }

    // Floating Sidebar Restore Tab click

    const restoreTab = document.getElementById('sidebar-restore-tab');

    if (restoreTab) {

      restoreTab.addEventListener('click', () => {

        window.watchlistPanel?.restoreSidebar();

      });

    }

    // Theme Switcher Toggle (Dark / Light)

    const themeBtn = document.getElementById('btn-toggle-theme');

    if (themeBtn) {

      themeBtn.addEventListener('click', () => {

        this.toggleTheme();

      });

    }

    // Fullscreen Toggle

    const fsBtn = document.getElementById('btn-toggle-fullscreen');

    if (fsBtn) {

      fsBtn.addEventListener('click', () => {

        if (!document.fullscreenElement) {

          document.documentElement.requestFullscreen().catch(err => {});

        } else {

          document.exitFullscreen();

        }

      });

    }

    // Save Layout Button Trigger

    const saveLayoutBtn = document.getElementById('btn-save-layout');

    if (saveLayoutBtn) {

      saveLayoutBtn.addEventListener('click', () => this.handleSaveLayout());

    }

    // Take Snapshot Screenshot

    const snapBtn = document.getElementById('btn-take-snapshot');

    if (snapBtn) {

      snapBtn.addEventListener('click', () => {

        const activeChart = window.multiChartGrid.activeChart;

        if (!activeChart || !activeChart.chart) return;

        const canvas = activeChart.chart.takeScreenshot();

        const a = document.createElement('a');

        a.download = `${activeChart.symbol}_${activeChart.interval}_chart.png`;

        a.href = canvas.toDataURL('image/png');

        a.click();

      });

    }

    // Close any open popovers only when clicking outside

    layoutDropdown?.addEventListener('click', (e) => {

      // Don't close when interacting inside layout dropdown unless an option is clicked

      if (!e.target.closest('.layout-opt-btn')) {

        e.stopPropagation();

      }

    });

    syncDropdown?.addEventListener('click', (e) => {

      // Allow user to toggle checkboxes without collapsing the sync menu

      e.stopPropagation();

    });

    document.addEventListener('click', (e) => {

      if (!layoutBtn?.contains(e.target) && !layoutDropdown?.contains(e.target)) {

        layoutDropdown?.classList.add('hidden');

      }

      if (!syncBtn?.contains(e.target) && !syncDropdown?.contains(e.target)) {

        syncDropdown?.classList.add('hidden');

      }

    });

  }

  updateSyncUI() {

    const grid = window.multiChartGrid;

    const cCrosshair = document.getElementById('sync-crosshair-toggle');

    const cSymbol = document.getElementById('sync-symbol-toggle');

    const cInterval = document.getElementById('sync-interval-toggle');

    const cTime = document.getElementById('sync-time-toggle');

    if (cCrosshair) cCrosshair.checked = grid.syncCrosshair;

    if (cSymbol) cSymbol.checked = grid.syncSymbol;

    if (cInterval) cInterval.checked = grid.syncInterval;

    if (cTime) cTime.checked = grid.syncTime;

    // Header badge

    const badge = document.getElementById('sync-active-badge');

    if (badge) {

      const activeCount = [grid.syncCrosshair, grid.syncSymbol, grid.syncInterval, grid.syncTime].filter(Boolean).length;

      badge.textContent = activeCount;

      badge.className = activeCount > 0 ? 'bg-[#089981] text-white text-[10px] px-1 rounded' : 'hidden';

    }

  }

  initTheme() {

    const savedTheme = localStorage.getItem('tradeview_theme') || 'dark';

    if (savedTheme === 'light') {

      document.body.classList.add('theme-light');

    } else {

      document.body.classList.remove('theme-light');

    }

    setTimeout(() => this.updateThemeButton(), 0);

  }

  updateThemeButton() {

    const themeBtn = document.getElementById('btn-toggle-theme');

    if (!themeBtn) return;

    const isDark = !document.body.classList.contains('theme-light');

    const label = themeBtn.querySelector('#theme-toggle-label');

    const icon = themeBtn.querySelector('.theme-toggle-icon');

    if (isDark) {

      if (label) {

        label.textContent = 'Dark';

        label.className = 'text-[11px] font-semibold text-[#d1d4dc]';

      }

      if (icon) icon.innerHTML = `<i data-lucide="moon" class="w-3.5 h-3.5 text-amber-300"></i>`;

      themeBtn.className = 'theme-switch-btn flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold border border-[#2a2e39] bg-[#1e222d] hover:border-[#2962ff] transition shadow-sm select-none cursor-pointer shrink-0';

    } else {

      if (label) {

        label.textContent = 'Light';

        label.className = 'text-[11px] font-semibold text-[#131722]';

      }

      if (icon) icon.innerHTML = `<i data-lucide="sun" class="w-3.5 h-3.5 text-amber-500"></i>`;

      themeBtn.className = 'theme-switch-btn flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold border border-[#e0e3eb] bg-[#ffffff] hover:border-[#2962ff] transition shadow-sm select-none cursor-pointer text-[#131722] shrink-0';

    }

    if (window.lucide) window.lucide.createIcons();

  }

  toggleTheme() {

    document.body.classList.toggle('theme-light');

    const isDark = !document.body.classList.contains('theme-light');

    try {

      localStorage.setItem('tradeview_theme', isDark ? 'dark' : 'light');

    } catch (e) {}

    this.updateThemeButton();

    // Apply theme and ensure grid lines remain hidden across all charts

    if (window.multiChartGrid && Array.isArray(window.multiChartGrid.charts)) {

      window.multiChartGrid.charts.forEach(c => {

        if (c && typeof c.applyTheme === 'function') {

          c.applyTheme(isDark);

        }

      });

    }

    this.showToast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`);

  }

  bindDrawingToolbar() {

    const toolBtns = document.querySelectorAll('.tv-tool-btn');

    toolBtns.forEach(btn => {

      btn.addEventListener('click', () => {

        const tool = btn.dataset.tool;

        if (tool === 'clear') {

          if (confirm('Clear all drawings across charts?')) {

            window.multiChartGrid.clearAllDrawings();

          }

          return;

        }

        toolBtns.forEach(b => b.classList.remove('active'));

        btn.classList.add('active');

        window.multiChartGrid.setDrawingTool(tool);

      });

    });

  }

  bindModals() {

    // Symbol Search Modal

    const modal = document.getElementById('symbol-search-modal');

    const input = document.getElementById('symbol-search-input');

    const closeBtn = document.getElementById('btn-close-symbol-modal');

    closeBtn?.addEventListener('click', () => {

      modal.classList.add('hidden');

    });

    input?.addEventListener('input', (e) => {

      this.filterSymbolList(e.target.value);

    });

    // Category Tabs in Symbol Modal

    document.querySelectorAll('.symbol-cat-btn').forEach(btn => {

      btn.addEventListener('click', () => {

        document.querySelectorAll('.symbol-cat-btn').forEach(b => {

          b.className = 'px-3 py-1 rounded text-xs font-medium text-[#787b86] hover:text-[#d1d4dc] symbol-cat-btn';

        });

        btn.className = 'px-3 py-1 rounded text-xs font-medium text-[#2962ff] bg-[rgba(41,98,255,0.12)] symbol-cat-btn';

        this.filterSymbolCategory(btn.dataset.category);

      });

    });

  }

  initFyersIntegration() {
    const modal = document.getElementById('fyers-modal') || document.getElementById('dhan-modal');
    const openBtn = document.getElementById('btn-fyers-modal') || document.getElementById('btn-dhan-modal');
    const closeBtn = document.getElementById('btn-close-fyers-modal') || document.getElementById('btn-close-dhan-modal');
    const cancelBtn = document.getElementById('btn-cancel-fyers-modal') || document.getElementById('btn-cancel-dhan-modal');
    const saveBtn = document.getElementById('btn-save-fyers-config') || document.getElementById('btn-save-dhan-config');
    const statusDot = document.getElementById('fyers-status-dot') || document.getElementById('dhan-status-dot');
    const modalDot = document.getElementById('fyers-modal-dot') || document.getElementById('dhan-modal-dot');
    const statusText = document.getElementById('fyers-modal-status-text') || document.getElementById('dhan-modal-status-text');
    const enableToggle = document.getElementById('fyers-enable-toggle') || document.getElementById('dhan-enable-toggle');
    const appIdInput = document.getElementById('fyers-app-id-input') || document.getElementById('dhan-client-id-input');
    const tokenInput = document.getElementById('fyers-access-token-input') || document.getElementById('dhan-access-token-input');
    const saveMsg = document.getElementById('fyers-save-msg') || document.getElementById('dhan-save-msg');

    const updateStatusUI = (cfg) => {
      const isConnected = cfg.enabled && cfg.has_token && cfg.status === 'Connected';
      if (openBtn) {
        if (isConnected) {
          openBtn.className = 'btn-fyers-embossed-green select-none shrink-0 transition';
          openBtn.title = 'Fyers Live Feed: Connected 🟢 (Click to configure)';
        } else {
          openBtn.className = 'btn-fyers-embossed-red select-none shrink-0 transition';
          openBtn.title = 'Fyers Account: Disconnected 🔴 (Click to connect for real-time NSE feed)';
        }
      }
      if (statusDot) {
        statusDot.className = isConnected 
          ? 'w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#4ade80] shrink-0' 
          : 'w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_#f87171] shrink-0';
      }
      if (modalDot) {
        modalDot.className = isConnected 
          ? 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]' 
          : 'w-2.5 h-2.5 rounded-full bg-gray-400';
      }
      if (statusText) {
        statusText.textContent = 'Status: ' + (cfg.status || (isConnected ? 'Connected' : 'Not Configured'));
        statusText.className = isConnected ? 'font-semibold text-emerald-400' : 'font-semibold text-[#d1d4dc]';
      }
      if (enableToggle) {
        enableToggle.checked = !!cfg.enabled;
      }
      if (appIdInput && (cfg.app_id || cfg.client_id)) {
        appIdInput.value = cfg.app_id || cfg.client_id;
      }
    };

    // Check status on startup
    fetch('/api/fyers/config')
      .then(r => r.json())
      .then(cfg => updateStatusUI(cfg))
      .catch(() => {});

    // Open Modal
    openBtn?.addEventListener('click', () => {
      if (saveMsg) saveMsg.textContent = '';
      fetch('/api/fyers/config')
        .then(r => r.json())
        .then(cfg => {
          updateStatusUI(cfg);
          modal?.classList.remove('hidden');
          if (window.lucide) window.lucide.createIcons();
        })
        .catch(() => {
          modal?.classList.remove('hidden');
          if (window.lucide) window.lucide.createIcons();
        });
    });

    // Close Modal
    [closeBtn, cancelBtn].forEach(b => {
      b?.addEventListener('click', () => modal?.classList.add('hidden'));
    });

    // Save & Connect
    saveBtn?.addEventListener('click', async () => {
      const appId = appIdInput?.value?.trim() || '';
      const token = tokenInput?.value?.trim() || '';
      const enabled = enableToggle?.checked ?? true;

      if (!appId) {
        if (saveMsg) {
          saveMsg.textContent = 'Please enter your Fyers App ID (e.g. XC12345-100)';
          saveMsg.className = 'text-[11px] text-[#f23645]';
        }
        return;
      }

      saveBtn.disabled = true;
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span>Verifying...</span>';
      if (saveMsg) {
        saveMsg.textContent = 'Testing connection with Fyers API...';
        saveMsg.className = 'text-[11px] text-amber-400';
      }

      try {
        const resp = await fetch('/api/fyers/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId, access_token: token, enabled: enabled })
        });
        const res = await resp.json();
        if (res.status === 'ok') {
          const isSuccess = res.connection_status === 'Connected';
          if (saveMsg) {
            saveMsg.textContent = isSuccess ? '🟢 Connected to Fyers!' : res.connection_status;
            saveMsg.className = isSuccess ? 'text-[11px] text-emerald-400 font-semibold' : 'text-[11px] text-amber-400';
          }
          this.showToast(isSuccess ? '🟢 Fyers Live Feed Connected!' : 'Fyers Saved: ' + res.connection_status);
          
          // Refresh status
          const cfgResp = await fetch('/api/fyers/config');
          const cfg = await cfgResp.json();
          updateStatusUI(cfg);

          // Clear token input for security
          if (tokenInput) tokenInput.value = '';

          setTimeout(() => {
            modal?.classList.add('hidden');
          }, 1200);

          // Reload all charts to pull Fyers data
          if (window.multiChartGrid) {
            window.multiChartGrid.charts.forEach(c => c.loadData());
          }
        } else {
          if (saveMsg) {
            saveMsg.textContent = res.message || 'Save failed';
            saveMsg.className = 'text-[11px] text-[#f23645]';
          }
        }
      } catch (err) {
        if (saveMsg) {
          saveMsg.textContent = 'Failed to connect: ' + err.message;
          saveMsg.className = 'text-[11px] text-[#f23645]';
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    });
  }

  openSymbolSearchModal() {

    const modal = document.getElementById('symbol-search-modal');

    const input = document.getElementById('symbol-search-input');

    if (!modal) return;

    modal.classList.remove('hidden');

    input.value = '';

    input.focus();

    this.renderSymbolSearchResults(window.dataFeed?.symbols || []);

  }

  filterSymbolList(query) {

    const q = query.trim().toUpperCase();

    const symbols = window.dataFeed?.symbols || [];

    const filtered = symbols.filter(s =>

      s.symbol.toUpperCase().includes(q) ||

      (s.name && s.name.toUpperCase().includes(q))

    );

    this.renderSymbolSearchResults(filtered);

  }

  filterSymbolCategory(category) {

    const symbols = window.dataFeed?.symbols || [];

    if (category === 'ALL') {

      this.renderSymbolSearchResults(symbols);

    } else {

      const filtered = symbols.filter(s => s.category.toUpperCase() === category.toUpperCase());

      this.renderSymbolSearchResults(filtered);

    }

  }

  renderSymbolSearchResults(symbols) {

    const container = document.getElementById('symbol-results-list');

    if (!container) return;

    if (!symbols || symbols.length === 0) {

      container.innerHTML = `<div class="p-6 text-center text-[#787b86] text-xs">No matching symbols found</div>`;

      return;

    }

    container.innerHTML = '';

    symbols.forEach(s => {

      const row = document.createElement('div');

      row.className = 'flex items-center justify-between px-4 py-2 hover:bg-[#2a2e39] cursor-pointer transition';

      row.innerHTML = `

        <div class="flex items-center space-x-3">

          <span class="text-lg">${s.icon || '🪙'}</span>

          <div>

            <div class="font-bold text-sm text-[#d1d4dc]">${s.symbol}</div>

            <div class="text-[11px] text-[#787b86]">${s.name || ''}</div>

          </div>

        </div>

        <div class="flex items-center space-x-3 text-xs">

          <span class="px-2 py-0.5 rounded bg-[#131722] text-[#787b86] border border-[#2a2e39] font-mono">${s.exchange}</span>

          <span class="text-[#2962ff] font-medium">${s.category}</span>

        </div>

      `;

      row.addEventListener('click', () => {

        window.multiChartGrid.changeSymbol(s.symbol);

        document.getElementById('symbol-search-modal').classList.add('hidden');

      });

      container.appendChild(row);

    });

  }

  showIndicatorModal(chartInstance, targetIndicatorId = null) {

    const modal = document.getElementById('indicators-modal');

    const container = document.getElementById('indicators-options-list');

    if (!modal || !container || !chartInstance) return;

    const presetSwatches = ['#2962ff', '#089981', '#f23645', '#ff9800', '#facc15', '#9c27b0', '#26a69a', '#00bcd4', '#ffffff'];

    const renderLineStyleRow = (label, colorKey, widthKey, currentColor, currentWidth) => `

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 border-b border-[#2a2e39]/50">

        <span class="text-xs text-[#9aa0a6] font-medium shrink-0">${label}:</span>

        <div class="flex items-center space-x-2 flex-wrap">

          <div class="flex items-center space-x-1.5 bg-[#131722] px-2 py-1 rounded border border-[#2a2e39]">

            <input type="color" value="${currentColor}" class="color-picker-input" data-color-key="${colorKey}">

            <span class="font-mono text-[10px] text-[#d1d4dc] uppercase color-hex-label">${currentColor}</span>

          </div>

          <div class="flex items-center space-x-1 bg-[#131722] p-1 rounded border border-[#2a2e39]">

            ${presetSwatches.map(c => `

              <button type="button" data-color="${c}" data-color-key="${colorKey}" class="w-3.5 h-3.5 rounded-full border border-black/50 hover:scale-125 transition swatch-btn ${currentColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white scale-110' : ''}" style="background-color: ${c};" title="${c}"></button>

            `).join('')}

          </div>

          <div class="flex items-center space-x-0.5 bg-[#131722] p-0.5 rounded border border-[#2a2e39] thickness-group" data-width-key="${widthKey}">

            ${[1, 2, 3, 4].map(w => `

              <button type="button" data-width="${w}" class="px-2 py-0.5 text-[10px] font-bold rounded transition ${currentWidth == w ? 'bg-[#2962ff] text-white shadow-sm' : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'}">

                ${w}px

              </button>

            `).join('')}

          </div>

        </div>

      </div>

    `;

    const renderBarColorRow = (label, colorKey, currentColor) => `

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 border-b border-[#2a2e39]/50">

        <span class="text-xs text-[#9aa0a6] font-medium shrink-0">${label}:</span>

        <div class="flex items-center space-x-2 flex-wrap">

          <div class="flex items-center space-x-1.5 bg-[#131722] px-2 py-1 rounded border border-[#2a2e39]">

            <input type="color" value="${currentColor}" class="color-picker-input" data-color-key="${colorKey}">

            <span class="font-mono text-[10px] text-[#d1d4dc] uppercase color-hex-label">${currentColor}</span>

          </div>

          <div class="flex items-center space-x-1 bg-[#131722] p-1 rounded border border-[#2a2e39]">

            ${presetSwatches.map(c => `

              <button type="button" data-color="${c}" data-color-key="${colorKey}" class="w-3.5 h-3.5 rounded-full border border-black/50 hover:scale-125 transition swatch-btn ${currentColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white scale-110' : ''}" style="background-color: ${c};" title="${c}"></button>

            `).join('')}

          </div>

        </div>

      </div>

    `;

    const availableIndicators = [

      { id: 'supertrend', name: 'Supertrend', desc: 'ATR trend filter with Bullish/Bearish colors & Buy/Sell signals', type: 'supertrend' },

      { id: 'vwap', name: 'VWAP', desc: 'Volume Weighted Average Price (Resets daily at session start)', type: 'vwap' },

      { id: 'highlow', name: 'ORB High & Low (Opening Range)', desc: 'Current day Opening Range High & Low static levels staying day-long', type: 'highlow' },

      { id: 'ema20', name: 'EMA 20', desc: 'Short-term Exponential Moving Average', type: 'ma' },

      { id: 'ema50', name: 'EMA 50', desc: 'Medium-term Exponential Moving Average', type: 'ma' },

      { id: 'sma200', name: 'SMA 200', desc: 'Long-term Simple Moving Average', type: 'ma' },

      { id: 'bb', name: 'Bollinger Bands (20, 2)', desc: 'Upper, Middle Basis, and Lower Standard Deviation bands', type: 'bb' },

      { id: 'volume', name: 'Volume', desc: 'Trading Volume histogram with color coding', type: 'volume' }

    ];

    container.innerHTML = '';

    availableIndicators.forEach(ind => {

      const isChecked = chartInstance.activeIndicators.has(ind.id);

      const cfg = chartInstance.getIndicatorConfig(ind.id);

      const isTarget = targetIndicatorId === ind.id;

      const card = document.createElement('div');

      card.className = `indicator-card rounded-lg bg-[#181b24] border ${isTarget ? 'border-[#2962ff] shadow-lg shadow-blue-500/10' : 'border-[#2a2e39]'} transition overflow-hidden`;

      card.dataset.id = ind.id;

      // Color badge for card header preview

      let colorPreviewDot = '';

      if (ind.id === 'supertrend') {

        colorPreviewDot = `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.bullColor || '#089981'}"></span><span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.bearColor || '#f23645'}"></span>`;

      } else if (ind.id === 'bb') {

        colorPreviewDot = `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.midColor || '#ff9800'}"></span>`;

      } else if (ind.id === 'highlow') {

        colorPreviewDot = `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.highColor || '#089981'}"></span><span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.lowColor || '#f23645'}"></span>`;

      } else if (ind.id === 'volume') {

        colorPreviewDot = `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.upColor || '#089981'}"></span>`;

      } else {

        colorPreviewDot = `<span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cfg.color || '#2962ff'}"></span>`;

      }

      // Generate Settings Drawer Body

      let drawerBody = '';

      if (ind.id === 'supertrend') {

        drawerBody = `

          <div class="grid grid-cols-2 gap-3 py-1.5 border-b border-[#2a2e39]/50">

            <div class="flex items-center justify-between bg-[#131722] px-2.5 py-1.5 rounded border border-[#2a2e39]">

              <span class="text-xs text-[#9aa0a6] font-medium">ATR Period:</span>

              <input type="number" min="1" max="100" value="${cfg.period || 10}" class="w-16 bg-[#1e222d] border border-[#2a2e39] rounded px-1.5 py-0.5 text-xs text-white text-right font-mono focus:border-[#2962ff] focus:outline-none input-param" data-param="period">

            </div>

            <div class="flex items-center justify-between bg-[#131722] px-2.5 py-1.5 rounded border border-[#2a2e39]">

              <span class="text-xs text-[#9aa0a6] font-medium">Multiplier:</span>

              <input type="number" min="0.5" max="10" step="0.5" value="${cfg.multiplier || 3.0}" class="w-16 bg-[#1e222d] border border-[#2a2e39] rounded px-1.5 py-0.5 text-xs text-white text-right font-mono focus:border-[#2962ff] focus:outline-none input-param" data-param="multiplier">

            </div>

          </div>

          ${renderLineStyleRow('Bullish Uptrend (Buy)', 'bullColor', 'bullWidth', cfg.bullColor || '#089981', cfg.bullWidth || 2)}

          ${renderLineStyleRow('Bearish Downtrend (Sell)', 'bearColor', 'bearWidth', cfg.bearColor || '#f23645', cfg.bearWidth || 2)}

        `;

      } else if (ind.id === 'vwap') {

        drawerBody = `

          <div class="flex items-center justify-between py-1.5 border-b border-[#2a2e39]/50 text-xs text-[#9aa0a6]">

            <span>Anchor Session:</span>

            <span class="px-2 py-0.5 font-mono text-[11px] rounded bg-[#131722] text-amber-300 border border-[#2a2e39]">Daily (Session Open)</span>

          </div>

          ${renderLineStyleRow('VWAP Line', 'color', 'lineWidth', cfg.color || '#facc15', cfg.lineWidth || 2)}

        `;

      } else if (ind.id === 'highlow') {

        const currentTf = cfg.tf || chartInstance.highLowTF || '15m';

        drawerBody = `

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 border-b border-[#2a2e39]/50">

            <span class="text-xs text-[#9aa0a6] font-medium">Opening Range Timeframe:</span>

            <div class="flex items-center space-x-1 bg-[#131722] p-1 rounded border border-[#2a2e39] highlow-tf-group">

              ${['5m', '10m', '15m', '30m'].map(tf => `

                <button type="button" data-tf="${tf}" class="px-2.5 py-1 text-xs font-semibold rounded transition ${tf === currentTf ? 'bg-[#2962ff] text-white shadow-sm' : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'}">

                  ${tf}

                </button>

              `).join('')}

            </div>

          </div>

          ${renderLineStyleRow('ORB High Line', 'highColor', 'highWidth', cfg.highColor || '#089981', cfg.highWidth || 2)}

          ${renderLineStyleRow('ORB Low Line', 'lowColor', 'lowWidth', cfg.lowColor || '#f23645', cfg.lowWidth || 2)}

        `;

      } else if (ind.type === 'ma') {

        drawerBody = `

          <div class="flex items-center justify-between py-1.5 border-b border-[#2a2e39]/50">

            <span class="text-xs text-[#9aa0a6] font-medium">Period (Length):</span>

            <div class="flex items-center space-x-1.5">

              <input type="number" min="1" max="500" value="${cfg.period}" class="w-20 bg-[#131722] border border-[#2a2e39] rounded px-2 py-1 text-xs text-white text-right font-mono focus:border-[#2962ff] focus:outline-none input-param" data-param="period">

              <span class="text-[11px] text-[#787b86]">bars</span>

            </div>

          </div>

          ${renderLineStyleRow('MA Line', 'color', 'lineWidth', cfg.color || '#2962ff', cfg.lineWidth || 2)}

        `;

      } else if (ind.id === 'bb') {

        drawerBody = `

          <div class="grid grid-cols-2 gap-3 py-1.5 border-b border-[#2a2e39]/50">

            <div class="flex items-center justify-between bg-[#131722] px-2.5 py-1.5 rounded border border-[#2a2e39]">

              <span class="text-xs text-[#9aa0a6] font-medium">Period:</span>

              <input type="number" min="2" max="200" value="${cfg.period || 20}" class="w-16 bg-[#1e222d] border border-[#2a2e39] rounded px-1.5 py-0.5 text-xs text-white text-right font-mono focus:border-[#2962ff] focus:outline-none input-param" data-param="period">

            </div>

            <div class="flex items-center justify-between bg-[#131722] px-2.5 py-1.5 rounded border border-[#2a2e39]">

              <span class="text-xs text-[#9aa0a6] font-medium">StdDev:</span>

              <input type="number" min="0.5" max="5" step="0.1" value="${cfg.stdDev || 2.0}" class="w-16 bg-[#1e222d] border border-[#2a2e39] rounded px-1.5 py-0.5 text-xs text-white text-right font-mono focus:border-[#2962ff] focus:outline-none input-param" data-param="stdDev">

            </div>

          </div>

          ${renderLineStyleRow('Upper Band', 'upperColor', 'upperWidth', cfg.upperColor || '#26a69a', cfg.upperWidth || 1)}

          ${renderLineStyleRow('Middle Basis Line', 'midColor', 'midWidth', cfg.midColor || '#ff9800', cfg.midWidth || 1)}

          ${renderLineStyleRow('Lower Band', 'lowerColor', 'lowerWidth', cfg.lowerColor || '#ef5350', cfg.lowerWidth || 1)}

        `;

      } else if (ind.id === 'volume') {

        drawerBody = `

          ${renderBarColorRow('Bullish (Up) Bars', 'upColor', cfg.upColor || '#089981')}

          ${renderBarColorRow('Bearish (Down) Bars', 'downColor', cfg.downColor || '#f23645')}

        `;

      }

      card.innerHTML = `

        <div class="p-3 flex items-center justify-between cursor-pointer indicator-row-header hover:bg-[#202531]/60 transition">

          <div class="flex items-center space-x-2.5 flex-1 pr-2">

            <input type="checkbox" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-[#2962ff] focus:ring-0 bg-[#131722] border-[#2a2e39] cursor-pointer ind-checkbox">

            <div>

              <div class="flex items-center space-x-2">

                <span class="font-bold text-sm text-[#d1d4dc]">${ind.name}</span>

                <div class="flex items-center space-x-1">${colorPreviewDot}</div>

              </div>

              <div class="text-xs text-[#787b86] mt-0.5 leading-snug">${ind.desc}</div>

            </div>

          </div>

          <button type="button" class="btn-toggle-settings px-2.5 py-1 text-xs font-semibold rounded bg-[#1e222d] hover:bg-[#2a2e39] text-[#787b86] hover:text-white border border-[#2a2e39] flex items-center space-x-1.5 transition" title="Customize Settings">

            <i data-lucide="settings" class="w-3.5 h-3.5"></i>

            <span>Settings</span>

            <i data-lucide="chevron-down" class="w-3 h-3 transition-transform settings-chevron ${isTarget ? 'rotate-180' : ''}"></i>

          </button>

        </div>

        <!-- Collapsible Settings Tray -->

        <div class="settings-drawer ${isTarget ? '' : 'hidden'} border-t border-[#2a2e39] bg-[#141720] p-3 text-xs space-y-2">

          ${drawerBody}

          <div class="pt-2 border-t border-[#2a2e39]/60 flex items-center justify-between">

            <span class="text-[11px] text-[#787b86]">Updates live on active charts</span>

            <button type="button" class="btn-reset-ind text-[11px] text-[#787b86] hover:text-amber-400 transition flex items-center space-x-1">

              <i data-lucide="rotate-ccw" class="w-3 h-3"></i>

              <span>Reset Defaults</span>

            </button>

          </div>

        </div>

      `;

      const checkbox = card.querySelector('.ind-checkbox');

      const header = card.querySelector('.indicator-row-header');

      const settingsBtn = card.querySelector('.btn-toggle-settings');

      const drawer = card.querySelector('.settings-drawer');

      const chevron = card.querySelector('.settings-chevron');

      // Checkbox click: toggle indicator

      header.addEventListener('click', (e) => {

        if (e.target.closest('.btn-toggle-settings')) return;

        if (e.target !== checkbox) {

          checkbox.checked = !checkbox.checked;

        }

        chartInstance.toggleIndicator(ind.id);

      });

      // Settings toggle click

      const toggleDrawer = () => {

        const isHidden = drawer.classList.contains('hidden');

        if (isHidden) {

          drawer.classList.remove('hidden');

          chevron?.classList.add('rotate-180');

        } else {

          drawer.classList.add('hidden');

          chevron?.classList.remove('rotate-180');

        }

      };

      settingsBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        toggleDrawer();

      });

      // Helper to auto-enable if currently inactive

      const ensureActive = () => {

        if (!chartInstance.activeIndicators.has(ind.id)) {

          chartInstance.toggleIndicator(ind.id);

          checkbox.checked = true;

        }

      };

      // Color pickers input listener

      card.querySelectorAll('.color-picker-input').forEach(input => {

        input.addEventListener('input', () => {

          const colorKey = input.dataset.colorKey;

          const val = input.value;

          const row = input.closest('div.flex');

          const hexLabel = row ? row.querySelector('.color-hex-label') : null;

          if (hexLabel) hexLabel.textContent = val.toUpperCase();

          

          ensureActive();

          chartInstance.updateIndicatorConfig(ind.id, { [colorKey]: val });

          // Update swatches ring

          const parentRow = input.closest('.border-b');

          if (parentRow) {

            parentRow.querySelectorAll('.swatch-btn').forEach(btn => {

              if (btn.dataset.color.toLowerCase() === val.toLowerCase()) {

                btn.classList.add('ring-2', 'ring-white', 'scale-110');

              } else {

                btn.classList.remove('ring-2', 'ring-white', 'scale-110');

              }

            });

          }

        });

      });

      // Swatch buttons click listener

      card.querySelectorAll('.swatch-btn').forEach(btn => {

        btn.addEventListener('click', (e) => {

          e.stopPropagation();

          const colorKey = btn.dataset.colorKey;

          const val = btn.dataset.color;

          const parentRow = btn.closest('.border-b');

          if (parentRow) {

            const input = parentRow.querySelector(`.color-picker-input[data-color-key="${colorKey}"]`);

            if (input) input.value = val;

            const hexLabel = parentRow.querySelector('.color-hex-label');

            if (hexLabel) hexLabel.textContent = val.toUpperCase();

            parentRow.querySelectorAll(`.swatch-btn[data-color-key="${colorKey}"]`).forEach(b => {

              b.classList.remove('ring-2', 'ring-white', 'scale-110');

            });

            btn.classList.add('ring-2', 'ring-white', 'scale-110');

          }

          ensureActive();

          chartInstance.updateIndicatorConfig(ind.id, { [colorKey]: val });

        });

      });

      // Thickness buttons click listener

      card.querySelectorAll('.thickness-group').forEach(grp => {

        const widthKey = grp.dataset.widthKey;

        grp.querySelectorAll('button').forEach(btn => {

          btn.addEventListener('click', (e) => {

            e.stopPropagation();

            const w = parseInt(btn.dataset.width) || 1;

            grp.querySelectorAll('button').forEach(b => {

              if (parseInt(b.dataset.width) === w) {

                b.className = 'px-2 py-0.5 text-[10px] font-bold rounded transition bg-[#2962ff] text-white shadow-sm';

              } else {

                b.className = 'px-2 py-0.5 text-[10px] font-bold rounded transition text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]';

              }

            });

            ensureActive();

            chartInstance.updateIndicatorConfig(ind.id, { [widthKey]: w });

          });

        });

      });

      // Numeric inputs (period, multiplier, stdDev)

      card.querySelectorAll('.input-param').forEach(input => {

        input.addEventListener('change', () => {

          const param = input.dataset.param;

          let val = input.value;

          if (param === 'multiplier' || param === 'stdDev') {

            val = parseFloat(val);

          } else {

            val = parseInt(val);

          }

          if (isNaN(val) || val <= 0) return;

          ensureActive();

          chartInstance.updateIndicatorConfig(ind.id, { [param]: val });

        });

      });

      // ORB Timeframe group buttons

      const tfGroup = card.querySelector('.highlow-tf-group');

      if (tfGroup) {

        tfGroup.querySelectorAll('button').forEach(btn => {

          btn.addEventListener('click', (e) => {

            e.stopPropagation();

            const tf = btn.dataset.tf;

            tfGroup.querySelectorAll('button').forEach(b => {

              if (b.dataset.tf === tf) {

                b.className = 'px-2.5 py-1 text-xs font-semibold rounded transition bg-[#2962ff] text-white shadow-sm';

              } else {

                b.className = 'px-2.5 py-1 text-xs font-semibold rounded transition text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]';

              }

            });

            ensureActive();

            chartInstance.updateIndicatorConfig('highlow', { tf: tf });

          });

        });

      }

      // Reset Defaults button

      card.querySelector('.btn-reset-ind')?.addEventListener('click', (e) => {

        e.stopPropagation();

        chartInstance.resetIndicatorConfig(ind.id);

        this.showIndicatorModal(chartInstance, ind.id);

      });

      container.appendChild(card);

    });

    modal.classList.remove('hidden');

    if (window.lucide) window.lucide.createIcons();

    if (targetIndicatorId) {

      setTimeout(() => {

        const targetCard = container.querySelector(`[data-id="${targetIndicatorId}"]`);

        if (targetCard) {

          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        }

      }, 50);

    }

    document.getElementById('btn-close-indicators-modal')?.addEventListener('click', () => {

      modal.classList.add('hidden');

    }, { once: true });

  }

  showChartTypeDropdown(anchorEl, onSelect) {

    const existing = document.getElementById('floating-chart-type-dropdown');

    if (existing) {

      existing.remove();

      return;

    }

    const rect = anchorEl.getBoundingClientRect();

    const dropdown = document.createElement('div');

    dropdown.id = 'floating-chart-type-dropdown';

    dropdown.className = 'tv-dropdown';

    dropdown.style.top = `${rect.bottom + 4}px`;

    dropdown.style.left = `${rect.left}px`;

    const types = [

      { id: 'candlestick', label: 'Candlestick', icon: 'candlestick-chart' },

      { id: 'heikin_ashi', label: 'Heikin Ashi', icon: 'trending-up' },

      { id: 'area', label: 'Area', icon: 'area-chart' },

      { id: 'line', label: 'Line', icon: 'line-chart' },

      { id: 'bar', label: 'Bars', icon: 'bar-chart-2' }

    ];

    types.forEach(t => {

      const item = document.createElement('div');

      item.className = 'tv-dropdown-item';

      item.innerHTML = `<span>${t.label}</span>`;

      item.addEventListener('click', () => {

        onSelect(t.id);

        dropdown.remove();

      });

      dropdown.appendChild(item);

    });

    document.body.appendChild(dropdown);

    const closeHandler = (e) => {

      if (!dropdown.contains(e.target) && e.target !== anchorEl) {

        dropdown.remove();

        document.removeEventListener('click', closeHandler);

      }

    };

    setTimeout(() => document.addEventListener('click', closeHandler), 10);

  }

  getFavoriteTimeframes() {

    try {

      const saved = localStorage.getItem('tradeview_favorite_timeframes');

      if (saved) {

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {

          return parsed;

        }

      }

    } catch (e) {}

    // Sensible defaults matching common trading practice

    return ['1m', '5m', '15m', '1h', '1d'];

  }

  saveFavoriteTimeframes(favs) {

    try {

      localStorage.setItem('tradeview_favorite_timeframes', JSON.stringify(favs));

    } catch (e) {}

  }

  toggleFavoriteTimeframe(tf) {

    let favs = this.getFavoriteTimeframes();

    if (favs.includes(tf)) {

      favs = favs.filter(t => t !== tf);

    } else {

      favs.push(tf);

    }

    this.saveFavoriteTimeframes(favs);

    this.renderHeaderTimeframePills();

  }

  formatTimeframeDisplay(tf) {
    if (tf === '1M') return '1M';
    const item = this.timeframes.find(t => t.tf === tf);
    if (item) return item.display;
    const lower = (tf || '').toLowerCase();
    if (lower === '1h') return '1H';
    if (lower === '2h') return '2H';
    if (lower === '4h') return '4H';
    if (lower === '1d') return '1D';
    if (lower === '1w') return '1W';
    return lower || '5m';
  }

  renderHeaderTimeframePills() {

    const container = document.getElementById('header-tf-favorites');

    if (!container) return;

    container.innerHTML = '';

    const favs = this.getFavoriteTimeframes();

    const activeChart = window.multiChartGrid?.activeChart;

    const currentTf = activeChart?.interval || '5m';

    // List of pills to show: all favorites in order, plus active TF if not currently in favorites

    const pillsToShow = [...favs];

    if (!pillsToShow.includes(currentTf)) {

      pillsToShow.push(currentTf);

    }

    pillsToShow.forEach(tf => {

      const btn = document.createElement('button');

      btn.className = 'timeframe-pill';

      btn.dataset.tf = tf;

      btn.textContent = this.formatTimeframeDisplay(tf);

      if (tf === currentTf) {

        btn.classList.add('active');

      }

      btn.addEventListener('click', (e) => {

        e.stopPropagation();

        window.multiChartGrid.changeInterval(tf);

        this.renderHeaderTimeframePills();

      });

      container.appendChild(btn);

    });

  }

  initTimeframeControls() {

    this.renderHeaderTimeframePills();

    const dropdownBtn = document.getElementById('btn-timeframe-dropdown');

    if (dropdownBtn) {

      dropdownBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        this.showTimeframeDropdown(dropdownBtn, (selectedTf) => {

          window.multiChartGrid.changeInterval(selectedTf);

          this.renderHeaderTimeframePills();

        });

      });

    }

  }

  showTimeframeDropdown(anchorEl, onSelect) {

    const existing = document.getElementById('floating-tf-dropdown');

    if (existing) {

      existing.remove();

      return;

    }

    const rect = anchorEl.getBoundingClientRect();

    const dropdown = document.createElement('div');

    dropdown.id = 'floating-tf-dropdown';

    dropdown.className = 'tf-dropdown-menu';

    // Position dropdown below anchor with viewport bounding

    const dropdownWidth = 230;

    let left = rect.left;

    if (left + dropdownWidth > window.innerWidth - 12) {

      left = Math.max(12, window.innerWidth - dropdownWidth - 12);

    }

    dropdown.style.top = `${rect.bottom + 4}px`;

    dropdown.style.left = `${left}px`;

    const activeChart = window.multiChartGrid?.activeChart;

    const currentTf = activeChart?.interval || '5m';

    // Group items

    const groups = ['Minutes', 'Hours', 'Days & Periods'];

    groups.forEach((grpName, grpIdx) => {

      const itemsInGroup = this.timeframes.filter(t => t.group === grpName);

      if (itemsInGroup.length === 0) return;

      const grpHeader = document.createElement('div');

      grpHeader.className = 'tf-group-header';

      if (grpIdx > 0) {

        grpHeader.style.borderTop = '1px solid rgba(255, 255, 255, 0.07)';

        grpHeader.style.marginTop = '4px';

        grpHeader.style.paddingTop = '6px';

      }

      grpHeader.textContent = grpName.toUpperCase();

      dropdown.appendChild(grpHeader);

      itemsInGroup.forEach(item => {

        const row = document.createElement('div');

        row.className = 'tf-dropdown-row group';

        if (item.tf === currentTf) {

          row.classList.add('active');

        }

        // Left label & badge

        const leftWrap = document.createElement('div');

        leftWrap.className = 'flex items-center space-x-2 pointer-events-none';

        leftWrap.innerHTML = `

          <span class="w-8 font-bold text-left tracking-tight">${item.display}</span>

          <span class="text-[11px] text-[#787b86] group-hover:text-white">${item.label}</span>

        `;

        // Right star favorite toggle

        const favs = this.getFavoriteTimeframes();

        const isFav = favs.includes(item.tf);

        const starBtn = document.createElement('button');

        starBtn.className = `tf-star-btn ${isFav ? 'is-fav' : ''}`;

        starBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';

        starBtn.innerHTML = isFav

          ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`

          : `<svg class="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

        starBtn.addEventListener('click', (e) => {

          e.stopPropagation();

          this.toggleFavoriteTimeframe(item.tf);

          const nowFav = this.getFavoriteTimeframes().includes(item.tf);

          starBtn.className = `tf-star-btn ${nowFav ? 'is-fav' : ''}`;

          starBtn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';

          starBtn.innerHTML = nowFav

            ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`

            : `<svg class="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

        });

        row.appendChild(leftWrap);

        row.appendChild(starBtn);

        row.addEventListener('click', () => {

          if (onSelect) onSelect(item.tf);

          dropdown.remove();

        });

        dropdown.appendChild(row);

      });

    });

    document.body.appendChild(dropdown);

    const closeHandler = (e) => {

      if (!dropdown.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {

        dropdown.remove();

        document.removeEventListener('click', closeHandler);

      }

    };

    setTimeout(() => document.addEventListener('click', closeHandler), 10);

  }

  bindHotkeys() {

    window.addEventListener('keydown', (e) => {

      // Don't trigger if user is typing in an input

      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {

        e.preventDefault();

        this.handleSaveLayout();

        return;

      }

      if (e.key === 'Escape') {

        // Revert to cursor tool and close modals

        document.querySelectorAll('.tv-modal-backdrop').forEach(m => m.classList.add('hidden'));

        const cursorBtn = document.querySelector('[data-tool="cursor"]');

        if (cursorBtn) cursorBtn.click();

      } else if (e.key === '1') {

        window.multiChartGrid.applyLayout('1');

      } else if (e.key === '2') {

        window.multiChartGrid.applyLayout('2h');

      } else if (e.key === '3') {

        window.multiChartGrid.applyLayout('3c');

      } else if (e.key === '4') {

        window.multiChartGrid.applyLayout('4');

      } else if (e.key === '6') {

        window.multiChartGrid.applyLayout('6');

      }

    });

  }

  handleSaveLayout() {

    if (window.multiChartGrid) {

      window.multiChartGrid.saveLayout();

    }

    const btn = document.getElementById('btn-save-layout');

    if (btn) {

      const origHTML = btn.innerHTML;

      btn.className = 'tv-btn bg-[#089981] hover:bg-[#067a67] text-white text-xs font-semibold px-2.5 py-1 rounded shadow-sm flex items-center space-x-1 transition-all';

      btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Layout Saved!</span>`;

      if (window.lucide) window.lucide.createIcons();

      this.showToast('✓ Layout and chart configurations saved successfully!');

      setTimeout(() => {

        btn.className = 'tv-btn bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-semibold px-2.5 py-1 rounded shadow-sm flex items-center space-x-1 transition-all';

        btn.innerHTML = origHTML;

        if (window.lucide) window.lucide.createIcons();

      }, 2000);

    }

  }

  updateMarketStatusBadge() {

    const dot = document.getElementById('market-status-dot');

    const text = document.getElementById('market-status-text');

    const badge = document.getElementById('header-market-status');

    if (!dot || !text || !badge) return;

    const isOpen = window.dataFeed ? window.dataFeed.isIndianMarketOpen() : false;

    if (isOpen) {

      dot.className = 'w-1.5 h-1.5 rounded-full bg-[#089981] animate-pulse';

      text.className = 'text-[#089981] text-[11px] font-bold';

      text.textContent = 'Open';

      badge.title = 'NSE Indian Market is OPEN (Trading Hours: Mon-Fri 09:15 - 15:30 IST) - Live feeds active';

    } else {

      dot.className = 'w-1.5 h-1.5 rounded-full bg-[#f23645]';

      text.className = 'text-[#f23645] text-[11px] font-bold';

      text.textContent = 'Closed';

      badge.title = 'NSE Indian Market is CLOSED (Trading Hours: Mon-Fri 09:15 - 15:30 IST) - Prices frozen at market close';

    }

  }

  updateISTClock() {

    const el = document.getElementById('ist-clock-text');

    if (!el) return;

    const now = new Date();

    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);

    const istDate = new Date(utcMs + (330 * 60000));

    const hh = String(istDate.getHours()).padStart(2, '0');

    const mm = String(istDate.getMinutes()).padStart(2, '0');

    const ss = String(istDate.getSeconds()).padStart(2, '0');

    el.textContent = `${hh}:${mm}:${ss} IST`;

  }

  showToast(message) {

    let toast = document.getElementById('app-floating-toast');

    if (!toast) {

      toast = document.createElement('div');

      toast.id = 'app-floating-toast';

      toast.className = 'fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#1e222d] border border-[#089981] text-[#d1d4dc] px-4 py-2 rounded shadow-2xl text-xs font-semibold flex items-center space-x-2 transition-all duration-300 opacity-0 pointer-events-none';

      document.body.appendChild(toast);

    }

    toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-[#089981]"></i><span>${message}</span>`;

    if (window.lucide) window.lucide.createIcons();

    toast.classList.remove('opacity-0', 'pointer-events-none');

    toast.classList.add('opacity-100');

    setTimeout(() => {

      toast.classList.remove('opacity-100');

      toast.classList.add('opacity-0', 'pointer-events-none');

    }, 2500);

  }

}

// Instantiate App on DOM ready

document.addEventListener('DOMContentLoaded', () => {

  window.app = new TradeViewApp();

});

