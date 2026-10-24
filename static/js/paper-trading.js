/**
 * Paper Trading Engine & Bottom Panel Dock for TradeView Multi-Chart
 * Simulated Order Execution, Positions, and PnL Tracking
 */

class PaperTradingPanel {
  constructor(panelElement) {
    this.panel = panelElement;
    this.account = {
      balance: 100000.00,
      equity: 100000.00,
      realized_pnl: 0.0,
      unrealized_pnl: 0.0,
      positions: {},
      orders: []
    };
    this.activeTab = 'positions'; // positions, orders, account
    const savedExpanded = localStorage.getItem('tradeview_paper_dock_expanded');
    this.isExpanded = savedExpanded !== null ? JSON.parse(savedExpanded) : false; // Default minimized!

    this.initDOM();
    this.renderUI();
    this.loadAccountState();
    this.startPnLTicker();

    // Apply initial minimized/expanded state
    this.applyDockState();
  }

  initDOM() {
    this.panel.innerHTML = `
      <!-- Bottom Dock Bar Header -->
      <div id="dock-header-bar" class="flex items-center justify-between px-3 h-8 border-b border-[#2a2e39] bg-[#1e222d] text-xs select-none">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-1.5 font-bold text-[#d1d4dc] cursor-pointer" id="dock-brand-toggle">
            <span class="w-2 h-2 rounded-full bg-[#089981]"></span>
            <span>Paper Trading</span>
          </div>
          <div class="h-3 w-px bg-[#2a2e39]"></div>
          <div class="flex items-center space-x-1">
            <button class="px-2.5 py-0.5 rounded text-[#2962ff] bg-[rgba(41,98,255,0.12)] font-medium dock-tab-btn" data-tab="positions">Positions (<span id="dock-pos-count">0</span>)</button>
            <button class="px-2.5 py-0.5 rounded text-[#787b86] hover:text-[#d1d4dc] font-medium dock-tab-btn" data-tab="orders">Orders History</button>
            <button class="px-2.5 py-0.5 rounded text-[#787b86] hover:text-[#d1d4dc] font-medium dock-tab-btn" data-tab="account">Account Summary</button>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Account Metrics Pills -->
          <div class="flex items-center space-x-3 font-mono text-[11px]">
            <div>Balance: <span class="text-[#d1d4dc] font-semibold" id="dock-balance">$100,000.00</span></div>
            <div>Equity: <span class="text-[#d1d4dc] font-semibold" id="dock-equity">$100,000.00</span></div>
            <div>Unrealized P&L: <span class="text-[#089981] font-semibold" id="dock-pnl">+$0.00 (0.00%)</span></div>
          </div>
          <div class="h-3 w-px bg-[#2a2e39]"></div>
          <!-- Quick Buy/Sell Buttons -->
          <div class="flex items-center space-x-1.5">
            <button id="btn-quick-buy" class="px-3 py-0.5 rounded bg-[#089981] hover:bg-[#07806c] text-white font-bold text-xs flex items-center space-x-1">
              <span>BUY</span>
            </button>
            <button id="btn-quick-sell" class="px-3 py-0.5 rounded bg-[#f23645] hover:bg-[#d62837] text-white font-bold text-xs flex items-center space-x-1">
              <span>SELL</span>
            </button>
          </div>
          <button id="btn-toggle-dock" class="text-[#d1d4dc] hover:text-white bg-[#131722] hover:bg-[#2a2e39] border border-[#2a2e39] rounded px-2 py-0.5 flex items-center space-x-1.5 transition cursor-pointer" title="Pull out / Minimize Paper Trading Panel">
            <span class="text-[11px] font-semibold" id="dock-toggle-label">Pull Out</span>
            <i data-lucide="chevron-up" class="w-3.5 h-3.5" id="dock-toggle-icon"></i>
          </button>
        </div>
      </div>

      <!-- Bottom Panel Content Body -->
      <div id="dock-content-body" class="flex-1 overflow-y-auto p-2">
        <!-- Positions Tab -->
        <div id="dock-pane-positions">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="text-[11px] text-[#787b86] border-b border-[#2a2e39]">
                <th class="pb-1.5 font-medium">Symbol</th>
                <th class="pb-1.5 font-medium">Side</th>
                <th class="pb-1.5 font-medium">Qty</th>
                <th class="pb-1.5 font-medium">Entry Price</th>
                <th class="pb-1.5 font-medium">Mark Price</th>
                <th class="pb-1.5 font-medium">Unrealized PnL</th>
                <th class="pb-1.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody id="positions-table-body" class="divide-y divide-[rgba(42,46,57,0.3)]">
              <tr>
                <td colspan="7" class="py-4 text-center text-[#787b86]">No open positions</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Orders Tab -->
        <div id="dock-pane-orders" class="hidden">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="text-[11px] text-[#787b86] border-b border-[#2a2e39]">
                <th class="pb-1.5 font-medium">Time</th>
                <th class="pb-1.5 font-medium">Symbol</th>
                <th class="pb-1.5 font-medium">Side</th>
                <th class="pb-1.5 font-medium">Type</th>
                <th class="pb-1.5 font-medium">Qty</th>
                <th class="pb-1.5 font-medium">Price</th>
                <th class="pb-1.5 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody id="orders-table-body" class="divide-y divide-[rgba(42,46,57,0.3)]">
              <tr>
                <td colspan="7" class="py-4 text-center text-[#787b86]">No orders executed yet</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Account Tab -->
        <div id="dock-pane-account" class="hidden text-xs">
          <div class="flex items-center justify-between p-3 bg-[#131722] rounded border border-[#2a2e39] max-w-xl">
            <div class="space-y-1">
              <div class="text-[#787b86]">Virtual Portfolio Balance</div>
              <div class="text-xl font-bold text-[#d1d4dc]" id="acc-sum-balance">$100,000.00</div>
            </div>
            <button id="btn-reset-account" class="px-3 py-1.5 bg-[#2a2e39] hover:bg-[#363a45] text-white rounded text-xs transition">
              Reset Account to $100K
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  applyDockState() {
    const toggleLabel = this.panel.querySelector('#dock-toggle-label');
    const toggleIcon = this.panel.querySelector('#dock-toggle-icon');
    const contentBody = this.panel.querySelector('#dock-content-body');

    if (this.isExpanded) {
      this.panel.classList.remove('collapsed');
      this.panel.style.height = '180px';
      if (contentBody) contentBody.style.display = 'block';
      if (toggleLabel) toggleLabel.textContent = 'Minimize';
      if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-down');
    } else {
      this.panel.classList.add('collapsed');
      this.panel.style.height = '32px';
      if (contentBody) contentBody.style.display = 'none';
      if (toggleLabel) toggleLabel.textContent = 'Pull Out';
      if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-up');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  toggleDock(expand = null) {
    if (expand !== null) {
      this.isExpanded = expand;
    } else {
      this.isExpanded = !this.isExpanded;
    }

    try {
      localStorage.setItem('tradeview_paper_dock_expanded', JSON.stringify(this.isExpanded));
    } catch (e) {}

    this.applyDockState();

    setTimeout(() => {
      if (window.multiChartGrid) {
        window.multiChartGrid.charts.forEach(c => c.resize());
      }
    }, 220);
  }

  bindEvents() {
    // Tabs
    const tabs = this.panel.querySelectorAll('.dock-tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isExpanded) {
          this.toggleDock(true);
        }
        tabs.forEach(b => {
          b.className = 'px-2.5 py-0.5 rounded text-[#787b86] hover:text-[#d1d4dc] font-medium dock-tab-btn';
        });
        btn.className = 'px-2.5 py-0.5 rounded text-[#2962ff] bg-[rgba(41,98,255,0.12)] font-medium dock-tab-btn';
        this.switchTab(btn.dataset.tab);
      });
    });

    // Collapse toggle button
    const toggleBtn = this.panel.querySelector('#btn-toggle-dock');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDock();
      });
    }

    // Brand toggle
    const brandToggle = this.panel.querySelector('#dock-brand-toggle');
    if (brandToggle) {
      brandToggle.addEventListener('click', () => this.toggleDock());
    }

    // Quick Buy
    const buyBtn = this.panel.querySelector('#btn-quick-buy');
    if (buyBtn) {
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isExpanded) this.toggleDock(true);
        this.placeQuickOrder('BUY');
      });
    }

    // Quick Sell
    const sellBtn = this.panel.querySelector('#btn-quick-sell');
    if (sellBtn) {
      sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isExpanded) this.toggleDock(true);
        this.placeQuickOrder('SELL');
      });
    }

    // Reset Account
    const resetBtn = this.panel.querySelector('#btn-reset-account');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetAccount());
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    ['positions', 'orders', 'account'].forEach(t => {
      const pane = this.panel.querySelector(`#dock-pane-${t}`);
      if (pane) {
        if (t === tabName) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
    });
  }

  async loadAccountState() {
    try {
      const resp = await fetch('/api/paper/account');
      const acc = await resp.json();
      if (acc) {
        this.account = acc;
        this.renderUI();
      }
    } catch (e) {
      console.warn('Account state load error:', e);
    }
  }

  async placeQuickOrder(side) {
    const activeChart = window.multiChartGrid?.activeChart;
    if (!activeChart) return;

    const symbol = activeChart.symbol;
    const currentPrice = activeChart.candles?.slice(-1)[0]?.close || 82000.0;
    // Default quantity = ~$5,000 notional value
    const notional = 5000.0;
    const qty = parseFloat((notional / currentPrice).toFixed(4));

    try {
      const resp = await fetch('/api/paper/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol,
          side: side,
          order_type: 'MARKET',
          qty: qty,
          price: currentPrice
        })
      });
      const res = await resp.json();
      if (res.account) {
        this.account = res.account;
        this.renderUI();
      }
    } catch (e) {
      console.error('Order placement failed:', e);
    }
  }

  async resetAccount() {
    try {
      const resp = await fetch('/api/paper/reset', { method: 'POST' });
      const res = await resp.json();
      if (res.account) {
        this.account = res.account;
        this.renderUI();
      }
    } catch (e) {}
  }

  renderUI() {
    const balanceEl = this.panel.querySelector('#dock-balance');
    const equityEl = this.panel.querySelector('#dock-equity');
    const pnlEl = this.panel.querySelector('#dock-pnl');
    const posCountEl = this.panel.querySelector('#dock-pos-count');
    const accBalEl = this.panel.querySelector('#acc-sum-balance');

    const positions = Object.values(this.account.positions || {});
    let totalUnrealized = 0;

    // Calculate dynamic PnL
    positions.forEach(p => {
      // Find current price from charts or estimate
      const chart = window.multiChartGrid?.charts.find(c => c.symbol === p.symbol);
      const markPrice = chart?.candles?.slice(-1)[0]?.close || p.avg_price;
      p.current_price = markPrice;
      const diff = p.side === 'LONG' ? (markPrice - p.avg_price) : (p.avg_price - markPrice);
      p.pnl = diff * p.qty;
      p.pnl_pct = (diff / p.avg_price) * 100;
      totalUnrealized += p.pnl;
    });

    const equity = this.account.balance + totalUnrealized;
    if (balanceEl) balanceEl.textContent = `$${this.account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (equityEl) equityEl.textContent = `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (accBalEl) accBalEl.textContent = `$${this.account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (posCountEl) posCountEl.textContent = positions.length;

    if (pnlEl) {
      const isPositive = totalUnrealized >= 0;
      pnlEl.textContent = `${isPositive ? '+' : ''}$${totalUnrealized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      pnlEl.className = `font-semibold ${isPositive ? 'text-[#089981]' : 'text-[#f23645]'}`;
    }

    // Render Positions Table
    const posBody = this.panel.querySelector('#positions-table-body');
    if (posBody) {
      if (positions.length === 0) {
        posBody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-[#787b86]">No open positions</td></tr>`;
      } else {
        posBody.innerHTML = '';
        positions.forEach(p => {
          const row = document.createElement('tr');
          const isProfitable = p.pnl >= 0;
          row.className = 'hover:bg-[rgba(42,46,57,0.4)]';
          row.innerHTML = `
            <td class="py-1.5 font-bold text-[#d1d4dc]">${p.symbol}</td>
            <td class="py-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${p.side === 'LONG' ? 'bg-[rgba(8,153,129,0.2)] text-[#089981]' : 'bg-[rgba(242,54,69,0.2)] text-[#f23645]'}">${p.side}</span></td>
            <td class="py-1.5 text-[#d1d4dc]">${p.qty}</td>
            <td class="py-1.5 text-[#787b86]">$${p.avg_price.toFixed(2)}</td>
            <td class="py-1.5 text-[#d1d4dc]">$${p.current_price.toFixed(2)}</td>
            <td class="py-1.5 font-bold ${isProfitable ? 'text-[#089981]' : 'text-[#f23645]'}">${isProfitable ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnl_pct.toFixed(2)}%)</td>
            <td class="py-1.5 text-right">
              <button class="px-2 py-0.5 rounded bg-[#2a2e39] hover:bg-[#363a45] text-xs text-[#d1d4dc] transition" onclick="window.paperPanel.closePosition('${p.symbol}')">Close</button>
            </td>
          `;
          posBody.appendChild(row);
        });
      }
    }

    // Render Orders Table
    const ordersBody = this.panel.querySelector('#orders-table-body');
    if (ordersBody && this.account.orders) {
      if (this.account.orders.length === 0) {
        ordersBody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-[#787b86]">No orders executed yet</td></tr>`;
      } else {
        ordersBody.innerHTML = '';
        this.account.orders.slice(0, 15).forEach(o => {
          const row = document.createElement('tr');
          row.className = 'hover:bg-[rgba(42,46,57,0.4)]';
          row.innerHTML = `
            <td class="py-1.5 text-[#787b86]">${o.time}</td>
            <td class="py-1.5 font-bold text-[#d1d4dc]">${o.symbol}</td>
            <td class="py-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${o.side === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}">${o.side}</span></td>
            <td class="py-1.5 text-[#787b86]">${o.order_type}</td>
            <td class="py-1.5 text-[#d1d4dc]">${o.qty}</td>
            <td class="py-1.5 text-[#d1d4dc]">$${o.price.toFixed(2)}</td>
            <td class="py-1.5 text-right"><span class="text-[#089981] font-semibold">${o.status}</span></td>
          `;
          ordersBody.appendChild(row);
        });
      }
    }
  }

  async closePosition(symbol) {
    const pos = this.account.positions[symbol];
    if (!pos) return;
    const oppSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
    await this.placeQuickOrder(oppSide);
  }

  startPnLTicker() {
    setInterval(() => {
      this.renderUI();
    }, 2000);
  }
}

window.PaperTradingPanel = PaperTradingPanel;
