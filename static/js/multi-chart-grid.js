/**
 * Multi-Chart Grid Coordinator & Synchronization Engine
 * Handles layout changes (1, 2H, 2V, 3L, 3T, 3C, 4, 6, 8)
 * Manages Crosshair Sync, Symbol Sync, Timeframe Sync, and Time Range Sync
 */

class MultiChartGrid {
  constructor(gridElement) {
    this.gridEl = gridElement;
    this.charts = [];
    this.activeChart = null;
    this.currentLayout = '4'; // Default 2x2 grid
    
    // Sync Settings (TradingView Pro Synchronization)
    this.syncCrosshair = true;
    this.syncSymbol = false;
    this.syncInterval = false;
    this.syncTime = false;

    // Default 100% Indian equities & indices rotation for multi-chart view
    this.defaultSymbols = ['RELIANCE', 'NIFTY50', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'TATAMOTORS', 'SBIN'];
    this.defaultIntervals = ['5m', '5m', '5m', '5m', '5m', '5m', '5m', '5m'];

    this.init();
  }

  init() {
    this.loadState();
    this.applyLayout(this.currentLayout);

    // Strict Authentication Guard: If an unauthenticated user touches anywhere on the chart grid, immediately show login/registration
    const enforceAuthGrid = (e) => {
      if (window.authManager && !window.authManager.isAuthenticated()) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        window.authManager.openAuthModal('login');
        return false;
      }
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(evt => {
      this.gridEl.addEventListener(evt, enforceAuthGrid, true);
    });
  }

  getTileCountForLayout(layout) {
    switch (layout) {
      case '1': return 1;
      case '2h':
      case '2v': return 2;
      case '3l':
      case '3t':
      case '3c': return 3;
      case '4': return 4;
      case '6': return 6;
      case '8': return 8;
      default: return 1;
    }
  }

  applyLayout(layoutName) {
    this.currentLayout = layoutName;
    const targetCount = this.getTileCountForLayout(layoutName);

    // Update CSS classes
    this.gridEl.className = `layout-${layoutName}`;

    // Adjust chart instances
    while (this.charts.length > targetCount) {
      const removed = this.charts.pop();
      removed.destroy();
      removed.container.remove();
    }

    while (this.charts.length < targetCount) {
      const index = this.charts.length;
      const tileDiv = document.createElement('div');
      tileDiv.className = 'chart-tile';
      tileDiv.id = `tile_${index}`;
      this.gridEl.appendChild(tileDiv);

      let symbol = this.defaultSymbols[index % this.defaultSymbols.length];
      let interval = '5m';
      let chartType = 'candlestick';
      let indicators = [];

      // Restore per-tile state if available
      if (this.savedChartsState && this.savedChartsState[index]) {
        const savedTile = this.savedChartsState[index];
        if (savedTile.symbol && !savedTile.symbol.includes('BTC') && !savedTile.symbol.includes('USDT')) {
          symbol = savedTile.symbol;
        }
        if (savedTile.interval) interval = savedTile.interval;
        if (savedTile.chartType) chartType = savedTile.chartType;
        if (savedTile.indicators) indicators = savedTile.indicators;
      }

      const chartInstance = new ChartInstance(tileDiv, index, {
        symbol: symbol,
        interval: interval,
        chartType: chartType,
        indicators: indicators
      });

      this.charts.push(chartInstance);
    }

    // Set first chart as active if none is active
    if (!this.activeChart || !this.charts.includes(this.activeChart)) {
      this.setActiveChart(this.charts[0]);
    } else {
      this.setActiveChart(this.activeChart);
    }

    // Trigger re-render of Lucide icons on newly created elements
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Resize all charts to fit their new tile dimensions
    setTimeout(() => {
      this.charts.forEach(c => c.resize());
    }, 50);

    this.saveState();
  }

  setActiveChart(chartInstance) {
    if (!chartInstance) return;
    this.charts.forEach(c => c.container.classList.remove('active'));
    this.activeChart = chartInstance;
    chartInstance.container.classList.add('active');

    // Notify top bar to reflect active chart's symbol & timeframe
    if (window.app) {
      window.app.updateHeaderForActiveChart(chartInstance);
    }
    // Synchronize Depth of Market & Watchlist selection
    if (window.watchlistPanel) {
      window.watchlistPanel.renderDepth();
      window.watchlistPanel.renderWatchlist();
    }
  }

  refreshAllCharts() {
    this.charts.forEach(c => c.loadData());
  }

  removeChartTile(chartInstance) {
    if (this.charts.length <= 1) return; // Don't remove last chart
    const index = this.charts.indexOf(chartInstance);
    if (index !== -1) {
      this.charts.splice(index, 1);
      chartInstance.destroy();
      chartInstance.container.remove();

      // Automatically downgrade to appropriate layout
      if (this.charts.length === 1) this.applyLayout('1');
      else if (this.charts.length === 2) this.applyLayout('2h');
      else if (this.charts.length === 3) this.applyLayout('3c');
      else if (this.charts.length <= 4) this.applyLayout('4');
      else if (this.charts.length <= 6) this.applyLayout('6');

      if (this.charts.length > 0) {
        this.setActiveChart(this.charts[0]);
      }
    }
  }

  // Crosshair Sync
  broadcastCrosshair(sourceChart, time, point) {
    if (!this.syncCrosshair) return;
    for (const c of this.charts) {
      if (c !== sourceChart) {
        c.syncCrosshairTime(time);
      }
    }
  }

  // Symbol Sync
  changeSymbol(newSymbol) {
    if (this.syncSymbol) {
      // Sync all charts to this symbol (great for multi-timeframe analysis)
      this.charts.forEach(c => c.setSymbol(newSymbol));
    } else if (this.activeChart) {
      this.activeChart.setSymbol(newSymbol);
    }
    this.saveState();
  }

  // Interval Sync
  changeInterval(newInterval) {
    if (!newInterval) return;
    const norm = newInterval === '1M' ? '1M' : newInterval.toLowerCase();
    if (this.syncInterval) {
      this.charts.forEach(c => c.setInterval(norm));
    } else if (this.activeChart) {
      this.activeChart.setInterval(norm);
    }
    this.saveState();
  }

  // Chart Type change
  changeChartType(newType) {
    if (this.activeChart) {
      this.activeChart.setChartType(newType);
    }
  }

  // Time Range / Scroll Sync
  broadcastTimeRange(sourceChart, logicalRange) {
    if (!this.syncTime || !logicalRange) return;
    for (const c of this.charts) {
      if (c !== sourceChart && c.chart) {
        try {
          c.chart.timeScale().setVisibleLogicalRange(logicalRange);
        } catch (e) {}
      }
    }
  }

  // Drawing tool propagation
  setDrawingTool(tool) {
    this.charts.forEach(c => {
      if (c.drawingOverlay) {
        c.drawingOverlay.setTool(tool);
      }
    });
  }

  clearAllDrawings() {
    this.charts.forEach(c => {
      if (c.drawingOverlay) {
        c.drawingOverlay.clearAllDrawings();
      }
    });
  }

  saveState() {
    try {
      const state = {
        layout: this.currentLayout,
        syncCrosshair: this.syncCrosshair,
        syncSymbol: this.syncSymbol,
        syncInterval: this.syncInterval,
        syncTime: this.syncTime,
        charts: this.charts.map(c => ({
          symbol: c.symbol,
          interval: c.interval,
          chartType: c.chartType,
          indicators: [...c.activeIndicators]
        }))
      };
      localStorage.setItem('tradeview_multichart_state', JSON.stringify(state));
    } catch (e) {}
  }

  saveLayout() {
    this.saveState();
    if (window.watchlistPanel) {
      window.watchlistPanel.saveWatchlist();
    }
    return true;
  }

  loadState() {
    try {
      const saved = localStorage.getItem('tradeview_multichart_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.layout) this.currentLayout = s.layout;
        if (s.syncCrosshair !== undefined) this.syncCrosshair = s.syncCrosshair;
        if (s.syncSymbol !== undefined) this.syncSymbol = s.syncSymbol;
        if (s.syncInterval !== undefined) this.syncInterval = s.syncInterval;
        if (s.syncTime !== undefined) this.syncTime = s.syncTime;
        if (s.charts && Array.isArray(s.charts)) {
          this.savedChartsState = s.charts.map((c, i) => {
            let sym = c.symbol;
            // Purge any legacy BTCUSDT from default layout
            if (!sym || sym.includes('BTC') || sym.includes('USDT')) {
              sym = this.defaultSymbols[i % this.defaultSymbols.length];
            }
            return {
              symbol: sym,
              interval: c.interval || '5m',
              chartType: c.chartType || 'candlestick',
              indicators: c.indicators || []
            };
          });
        }
      }
    } catch (e) {}
  }
}

window.MultiChartGrid = MultiChartGrid;
