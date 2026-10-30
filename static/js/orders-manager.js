/**
 * TraderView - Fyers API & Unified Orders Management
 * Handles Order Placement (B/S buttons), Order Book, Edit/Modify, Cancel/Remove
 */

class OrdersManager {
  constructor() {
    this.orders = [];
    this.paperOrders = [];
    this.fyersConnected = false;
    this.dhanConnected = false;
    this.activeFilter = 'all'; // all, pending, traded, cancelled
    this.currentModifyOrder = null;
    this.currentPlaceSide = 'BUY';
    this.pollingTimer = null;

    this.init();
  }

  init() {
    // Top right Orders button
    const btnOrders = document.getElementById('btn-top-orders');
    if (btnOrders) {
      btnOrders.addEventListener('click', () => this.openOrdersModal());
    }

    // Modal Close buttons
    document.getElementById('btn-close-orders-modal')?.addEventListener('click', () => this.closeOrdersModal());
    document.getElementById('btn-close-place-modal')?.addEventListener('click', () => this.closePlaceModal());
    document.getElementById('btn-cancel-place-modal')?.addEventListener('click', () => this.closePlaceModal());
    document.getElementById('btn-close-modify-modal')?.addEventListener('click', () => this.closeModifyModal());
    document.getElementById('btn-cancel-modify-modal')?.addEventListener('click', () => this.closeModifyModal());

    // Close on backdrop click
    ['orders-manager-modal', 'order-place-modal', 'order-modify-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          if (e.target === el) {
            el.classList.add('hidden');
          }
        });
      }
    });

    // Orders Modal Action Buttons
    document.getElementById('btn-orders-refresh')?.addEventListener('click', () => this.fetchOrders());
    document.getElementById('btn-orders-new')?.addEventListener('click', () => {
      const activeChart = window.app?.multiChartGrid?.getActiveInstance();
      const sym = activeChart ? activeChart.symbol : 'RELIANCE.NS';
      const price = activeChart?.lastCandle ? activeChart.lastCandle.close : 0;
      this.openPlaceModal({ symbol: sym, side: 'BUY', price });
    });

    // Filter Tabs
    document.querySelectorAll('.orders-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.orders-filter-tab').forEach(t => {
          t.classList.remove('bg-[#2962ff]', 'text-white');
          t.classList.add('text-[#787b86]', 'hover:text-[#d1d4dc]');
        });
        tab.classList.add('bg-[#2962ff]', 'text-white');
        tab.classList.remove('text-[#787b86]', 'hover:text-[#d1d4dc]');
        this.activeFilter = tab.getAttribute('data-filter') || 'all';
        this.renderOrdersTable();
      });
    });

    // Place Order Side Switchers (BUY / SELL)
    const btnSideBuy = document.getElementById('order-side-buy');
    const btnSideSell = document.getElementById('order-side-sell');
    if (btnSideBuy && btnSideSell) {
      btnSideBuy.addEventListener('click', () => this.setPlaceSide('BUY'));
      btnSideSell.addEventListener('click', () => this.setPlaceSide('SELL'));
    }

    // Order Type Tabs (MARKET / LIMIT)
    document.querySelectorAll('.order-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.order-type-btn').forEach(b => {
          b.classList.remove('bg-[#2962ff]', 'text-white');
          b.classList.add('text-[#787b86]', 'bg-[#1e222d]');
        });
        btn.classList.add('bg-[#2962ff]', 'text-white');
        btn.classList.remove('text-[#787b86]', 'bg-[#1e222d]');

        const type = btn.getAttribute('data-type');
        const priceInputWrap = document.getElementById('order-price-wrapper');
        if (priceInputWrap) {
          if (type === 'MARKET') {
            priceInputWrap.classList.add('opacity-50', 'pointer-events-none');
          } else {
            priceInputWrap.classList.remove('opacity-50', 'pointer-events-none');
          }
        }
      });
    });

    // Quantity Presets
    document.querySelectorAll('.qty-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-qty') || '1', 10);
        const input = document.getElementById('order-qty-input');
        if (input) {
          input.value = val;
          this.updateMarginEstimate();
        }
      });
    });

    // Quantity +/- buttons
    document.getElementById('btn-qty-minus')?.addEventListener('click', () => {
      const input = document.getElementById('order-qty-input');
      if (input) {
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
        this.updateMarginEstimate();
      }
    });

    document.getElementById('btn-qty-plus')?.addEventListener('click', () => {
      const input = document.getElementById('order-qty-input');
      if (input) {
        input.value = (parseInt(input.value, 10) || 1) + 1;
        this.updateMarginEstimate();
      }
    });

    // Price / Qty change listener for margin estimate
    document.getElementById('order-qty-input')?.addEventListener('input', () => this.updateMarginEstimate());
    document.getElementById('order-price-input')?.addEventListener('input', () => this.updateMarginEstimate());

    // Submit Order Button
    document.getElementById('btn-submit-order')?.addEventListener('click', () => this.submitPlaceOrder());

    // Submit Modify Order Button
    document.getElementById('btn-submit-modify')?.addEventListener('click', () => this.submitModifyOrder());

    // Initial background fetch
    this.fetchOrders();
    // Poll every 15 seconds
    this.pollingTimer = setInterval(() => this.fetchOrders(), 15000);
  }

  async fetchOrders() {
    try {
      const res = await fetch('/api/fyers/orders');
      if (!res.ok) return;
      const data = await res.json();
      this.fyersConnected = data.fyers_connected ?? data.dhan_connected;
      this.dhanConnected = this.fyersConnected;
      this.orders = data.fyers_orders || data.dhan_orders || [];
      this.paperOrders = data.paper_orders || [];

      // Update badge
      const openFyers = this.orders.filter(o => ['PENDING', 'OPEN', 'TRANSIT'].includes(o.orderStatus?.toUpperCase())).length;
      const openPaper = this.paperOrders.filter(o => o.orderStatus === 'PENDING').length;
      const totalOpen = openFyers + openPaper;

      const badge = document.getElementById('orders-count-badge');
      if (badge) {
        if (totalOpen > 0) {
          badge.textContent = totalOpen;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // Update modal status badge
      const connBadge = document.getElementById('orders-fyers-status-pill') || document.getElementById('orders-dhan-status-pill');
      if (connBadge) {
        if (this.fyersConnected) {
          connBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#089981] animate-pulse"></span><span class="text-[#089981] font-semibold">Fyers Live</span>`;
        } else {
          connBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#787b86]"></span><span class="text-[#787b86]">Paper Trading Mode</span>`;
        }
      }

      this.renderOrdersTable();
    } catch (e) {
      console.warn('Error fetching orders:', e);
    }
  }

  openOrdersModal() {
    const modal = document.getElementById('orders-manager-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    this.fetchOrders();
  }

  closeOrdersModal() {
    const modal = document.getElementById('orders-manager-modal');
    if (modal) modal.classList.add('hidden');
  }

  renderOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    // Combine Fyers and Paper orders
    const allOrders = [
      ...this.orders.map(o => ({
        id: o.orderId || o.id,
        symbol: o.tradingSymbol || o.symbol || '-',
        side: (o.transactionType || 'BUY').toUpperCase(),
        type: (o.orderType || 'MARKET').toUpperCase(),
        product: (o.productType || 'INTRADAY').toUpperCase(),
        qty: o.quantity || 0,
        filled: o.filled_qty || o.filledQty || 0,
        price: o.price || 0,
        status: (o.orderStatus || 'PENDING').toUpperCase(),
        time: o.orderTimestamp || o.createTime || '-',
        source: 'fyers',
        raw: o
      })),
      ...this.paperOrders.map(o => ({
        id: o.orderId,
        symbol: o.tradingSymbol || o.symbol || '-',
        side: (o.transactionType || 'BUY').toUpperCase(),
        type: (o.orderType || 'MARKET').toUpperCase(),
        product: (o.productType || 'INTRADAY').toUpperCase(),
        qty: o.quantity || 0,
        filled: o.filled_qty || 0,
        price: o.price || 0,
        status: (o.orderStatus || 'PENDING').toUpperCase(),
        time: o.orderTimestamp || '-',
        source: 'paper',
        raw: o
      }))
    ];

    let filtered = allOrders;
    if (this.activeFilter === 'pending') {
      filtered = allOrders.filter(o => ['PENDING', 'OPEN', 'TRANSIT'].includes(o.status));
    } else if (this.activeFilter === 'traded') {
      filtered = allOrders.filter(o => ['TRADED', 'EXECUTED', 'COMPLETED', 'FILLED'].includes(o.status));
    } else if (this.activeFilter === 'cancelled') {
      filtered = allOrders.filter(o => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(o.status));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-12 text-center text-[#787b86]">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
            <p class="text-xs">No orders found for the selected filter.</p>
            <button id="btn-empty-place-order" class="mt-3 px-3 py-1.5 rounded text-xs font-semibold bg-[#2962ff] text-white hover:bg-[#1e53e5] transition shadow">
              + Place New Order
            </button>
          </td>
        </tr>
      `;
      document.getElementById('btn-empty-place-order')?.addEventListener('click', () => {
        document.getElementById('btn-orders-new')?.click();
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map(o => {
      const isBuy = o.side === 'BUY';
      const isPending = ['PENDING', 'OPEN', 'TRANSIT'].includes(o.status);

      let statusBadge = '';
      if (['TRADED', 'EXECUTED', 'FILLED'].includes(o.status)) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#089981]/20 text-[#089981] border border-[#089981]/40">TRADED</span>`;
      } else if (isPending) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">PENDING</span>`;
      } else if (o.status === 'CANCELLED') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#787b86]/20 text-[#787b86] border border-[#787b86]/40">CANCELLED</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/40">${o.status}</span>`;
      }

      const isLive = o.source === 'fyers' || o.source === 'dhan';
      const sourceBadge = isLive 
        ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#089981]/15 text-[#089981] border border-[#089981]/30">FYERS</span>`
        : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#787b86]/15 text-[#787b86] border border-[#787b86]/30">PAPER</span>`;

      return `
        <tr class="border-b border-[#2a2e39]/50 hover:bg-[#1e222d]/70 transition font-mono text-xs">
          <td class="py-2.5 px-3 text-[#787b86] text-[11px] whitespace-nowrap">${o.time}</td>
          <td class="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
            <div class="flex items-center space-x-1.5">
              <span>${o.symbol}</span>
              ${sourceBadge}
            </div>
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isBuy ? 'bg-[#089981]/20 text-[#089981] border border-[#089981]/40' : 'bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/40'}">
              ${o.side}
            </span>
          </td>
          <td class="py-2.5 px-3 text-[#d1d4dc] whitespace-nowrap">${o.type}</td>
          <td class="py-2.5 px-3 text-[#787b86] whitespace-nowrap">${o.product}</td>
          <td class="py-2.5 px-3 text-white whitespace-nowrap font-bold">${o.filled} / ${o.qty}</td>
          <td class="py-2.5 px-3 text-[#d1d4dc] whitespace-nowrap">₹${Number(o.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
          <td class="py-2.5 px-3 whitespace-nowrap text-right">
            ${isPending ? `
              <div class="flex items-center justify-end space-x-1.5">
                <button class="btn-modify-order px-2 py-1 rounded bg-[#2a2e39] hover:bg-[#2962ff] text-white text-[11px] font-semibold transition" data-id="${o.id}">
                  Edit
                </button>
                <button class="btn-cancel-order px-2 py-1 rounded bg-[#2a2e39] hover:bg-[#f23645] text-white text-[11px] font-semibold transition" data-id="${o.id}">
                  Cancel
                </button>
              </div>
            ` : `
              <span class="text-[11px] text-[#787b86]">—</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    // Bind modify & cancel buttons
    tbody.querySelectorAll('.btn-modify-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ord = allOrders.find(x => String(x.id) === String(id));
        if (ord) this.openModifyModal(ord);
      });
    });

    tbody.querySelectorAll('.btn-cancel-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.cancelOrder(id);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  openPlaceModal({ symbol, side = 'BUY', price = 0 }) {
    const modal = document.getElementById('order-place-modal');
    if (!modal) return;

    // Clean symbol
    const cleanSym = (symbol || 'RELIANCE').replace('.NS', '').replace('.BO', '');
    document.getElementById('order-symbol-input').value = cleanSym;
    document.getElementById('order-symbol-display').textContent = cleanSym;

    // Set price
    const priceVal = price > 0 ? price : 100;
    document.getElementById('order-price-input').value = Number(priceVal).toFixed(2);
    document.getElementById('order-market-price-tag').textContent = `₹${Number(priceVal).toFixed(2)}`;

    // Quantity default
    document.getElementById('order-qty-input').value = 1;

    // Set routing mode
    const fyersToggle = document.getElementById('order-route-fyers-toggle') || document.getElementById('order-route-dhan-toggle');
    if (fyersToggle) {
      fyersToggle.checked = this.fyersConnected;
    }

    this.setPlaceSide(side);
    this.updateMarginEstimate();

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closePlaceModal() {
    const modal = document.getElementById('order-place-modal');
    if (modal) modal.classList.add('hidden');
  }

  setPlaceSide(side) {
    this.currentPlaceSide = side;
    const btnBuy = document.getElementById('order-side-buy');
    const btnSell = document.getElementById('order-side-sell');
    const submitBtn = document.getElementById('btn-submit-order');

    if (side === 'BUY') {
      btnBuy.classList.add('bg-[#089981]', 'text-white', 'shadow-md');
      btnBuy.classList.remove('text-[#787b86]', 'bg-transparent');
      btnSell.classList.remove('bg-[#f23645]', 'text-white', 'shadow-md');
      btnSell.classList.add('text-[#787b86]', 'bg-transparent');

      submitBtn.className = 'w-full py-2.5 rounded text-xs font-bold bg-[#089981] hover:bg-[#0bb397] text-white transition shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer';
      submitBtn.innerHTML = `<span>Submit BUY Order</span>`;
    } else {
      btnSell.classList.add('bg-[#f23645]', 'text-white', 'shadow-md');
      btnSell.classList.remove('text-[#787b86]', 'bg-transparent');
      btnBuy.classList.remove('bg-[#089981]', 'text-white', 'shadow-md');
      btnBuy.classList.add('text-[#787b86]', 'bg-transparent');

      submitBtn.className = 'w-full py-2.5 rounded text-xs font-bold bg-[#f23645] hover:bg-[#f65360] text-white transition shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer';
      submitBtn.innerHTML = `<span>Submit SELL Order</span>`;
    }
  }

  updateMarginEstimate() {
    const qty = parseInt(document.getElementById('order-qty-input')?.value || '1', 10);
    const price = parseFloat(document.getElementById('order-price-input')?.value || '0');
    const total = qty * price;

    const marginEl = document.getElementById('order-est-margin');
    if (marginEl) {
      marginEl.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  async submitPlaceOrder() {
    const symbol = document.getElementById('order-symbol-input')?.value.trim();
    const qty = parseInt(document.getElementById('order-qty-input')?.value || '1', 10);
    const activeTypeBtn = document.querySelector('.order-type-btn.bg-\\[\\#2962ff\\]');
    const orderType = activeTypeBtn?.getAttribute('data-type') || 'MARKET';
    const activeProdBtn = document.querySelector('input[name="product-type"]:checked');
    const productType = activeProdBtn?.value || 'INTRADAY';
    const price = parseFloat(document.getElementById('order-price-input')?.value || '0');
    const triggerPrice = parseFloat(document.getElementById('order-trigger-price-input')?.value || '0');
    const routeFyers = document.getElementById('order-route-fyers-toggle')?.checked ?? document.getElementById('order-route-dhan-toggle')?.checked;

    const statusMsg = document.getElementById('order-place-status-msg');
    const submitBtn = document.getElementById('btn-submit-order');

    if (!symbol) {
      if (statusMsg) statusMsg.textContent = 'Please enter a valid symbol.';
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50');
      }
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#2962ff] animate-pulse';
        statusMsg.textContent = 'Submitting order...';
      }

      const payload = {
        symbol: symbol,
        transaction_type: this.currentPlaceSide,
        quantity: qty,
        order_type: orderType,
        product_type: productType,
        price: orderType === 'LIMIT' ? price : 0.0,
        trigger_price: triggerPrice,
        validity: 'DAY',
        mode: routeFyers ? 'fyers' : 'paper'
      };

      const res = await fetch('/api/fyers/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to place order');
      }

      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#089981] font-semibold';
        statusMsg.textContent = `✓ ${data.message || 'Order placed successfully!'}`;
      }

      setTimeout(() => {
        this.closePlaceModal();
        this.fetchOrders();
      }, 1000);

    } catch (e) {
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#f23645] font-semibold';
        statusMsg.textContent = `✕ ${e.message}`;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
      }
    }
  }

  openModifyModal(order) {
    this.currentModifyOrder = order;
    const modal = document.getElementById('order-modify-modal');
    if (!modal) return;

    document.getElementById('modify-order-id').textContent = order.id;
    document.getElementById('modify-order-symbol').textContent = order.symbol;
    document.getElementById('modify-order-side').textContent = order.side;
    document.getElementById('modify-qty-input').value = order.qty;
    document.getElementById('modify-price-input').value = order.price;
    document.getElementById('modify-trigger-price-input').value = order.raw?.triggerPrice || 0;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeModifyModal() {
    const modal = document.getElementById('order-modify-modal');
    if (modal) modal.classList.add('hidden');
  }

  async submitModifyOrder() {
    if (!this.currentModifyOrder) return;
    const orderId = this.currentModifyOrder.id;
    const qty = parseInt(document.getElementById('modify-qty-input')?.value || '1', 10);
    const price = parseFloat(document.getElementById('modify-price-input')?.value || '0');
    const triggerPrice = parseFloat(document.getElementById('modify-trigger-price-input')?.value || '0');

    const statusMsg = document.getElementById('modify-status-msg');

    try {
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#2962ff] animate-pulse';
        statusMsg.textContent = 'Modifying order...';
      }

      const res = await fetch(`/api/fyers/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: String(orderId),
          order_type: this.currentModifyOrder.type || 'LIMIT',
          quantity: qty,
          price: price,
          trigger_price: triggerPrice,
          validity: 'DAY',
          mode: this.currentModifyOrder.source || 'auto'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to modify order');
      }

      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#089981] font-semibold';
        statusMsg.textContent = '✓ Order updated successfully!';
      }

      setTimeout(() => {
        this.closeModifyModal();
        this.fetchOrders();
      }, 1000);

    } catch (e) {
      if (statusMsg) {
        statusMsg.className = 'text-xs text-[#f23645] font-semibold';
        statusMsg.textContent = `✕ ${e.message}`;
      }
    }
  }

  async cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel order #${orderId}?`)) return;

    try {
      const res = await fetch(`/api/fyers/orders/${orderId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Failed to cancel: ${data.detail || 'Unknown error'}`);
        return;
      }
      this.fetchOrders();
    } catch (e) {
      alert(`Error cancelling order: ${e.message}`);
    }
  }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.ordersManager = new OrdersManager();
});
