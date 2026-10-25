/**
 * Single Chart Instance Manager for TradeView Multi-Chart
 * Direct Lightweight Charts v5 and v4 dual-engine support
 */

const DEFAULT_INDICATOR_CONFIGS = {
  volume: {
    upColor: '#089981',
    downColor: '#f23645'
  },
  ema20: {
    period: 20,
    color: '#2962ff',
    lineWidth: 2
  },
  ema50: {
    period: 50,
    color: '#ff9800',
    lineWidth: 2
  },
  sma200: {
    period: 200,
    color: '#9c27b0',
    lineWidth: 2
  },
  bb: {
    period: 20,
    stdDev: 2.0,
    upperColor: '#26a69a',
    upperWidth: 1,
    midColor: '#ff9800',
    midWidth: 1,
    lowerColor: '#ef5350',
    lowerWidth: 1
  },
  supertrend: {
    period: 10,
    multiplier: 3.0,
    bullColor: '#089981',
    bullWidth: 2,
    bearColor: '#f23645',
    bearWidth: 2
  },
  vwap: {
    color: '#facc15',
    lineWidth: 2
  },
  highlow: {
    tf: '15m',
    highColor: '#089981',
    highWidth: 2,
    lowColor: '#f23645',
    lowWidth: 2
  }
};

function hexToRgba(hex, alpha = 0.45) {
  if (!hex) return `rgba(8, 153, 129, ${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(8, 153, 129, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

class ChartInstance {
  constructor(containerElement, id, options = {}) {
    this.container = containerElement;
    this.id = id;
    this.symbol = options.symbol || 'RELIANCE';
    this.interval = options.interval ? (options.interval === '1M' ? '1M' : options.interval.toLowerCase()) : '5m';
    this.chartType = options.chartType || 'candlestick'; // candlestick, heikin_ashi, area, line, bar
    
    // New user default: 100% clean charts free from all indicators
    let initialInds = [];
    const savedInds = localStorage.getItem('tradeview_saved_indicators');
    if (savedInds) {
      try {
        const parsed = JSON.parse(savedInds);
        if (Array.isArray(parsed)) {
          initialInds = parsed;
        }
      } catch (e) {}
    }
    this.activeIndicators = new Set(initialInds);
    this.highLowTF = localStorage.getItem('tradeview_highlow_tf') || '15m';
    this.indicatorConfigs = this.loadIndicatorConfigs();

    this.chart = null;
    this.mainSeries = null;
    this.volumeSeries = null;
    this.indicatorSeriesMap = new Map();
    this.candles = [];
    this.isMaximized = false;
    this.unsubscribeLive = null;
    this.drawingOverlay = null;

    this.initDOM();
    this.initChart();
    this.initDrawingOverlay();
    this.loadData();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="chart-tile-header">
        <div class="chart-tile-legend">
          <div class="legend-symbol" title="Click to change symbol">
            <span class="symbol-name">${this.symbol}</span>
          </div>
          <div class="legend-interval cursor-pointer hover:text-[#2962ff] transition select-none" title="Click to Change Timeframe">${this.formatTimeframeDisplay(this.interval)}</div>
          <!-- Quick Buy / Sell Buttons on each chart -->
          <div class="chart-quick-trade-btns flex items-center space-x-1 ml-1.5 mr-1.5 select-none">
            <button type="button" class="btn-chart-quick-buy px-2 py-0.5 rounded text-[11px] font-bold bg-[#089981] hover:bg-[#0bb397] text-white shadow transition cursor-pointer select-none leading-none border border-[#089981]/50" title="Quick BUY ${this.symbol}">B</button>
            <button type="button" class="btn-chart-quick-sell px-2 py-0.5 rounded text-[11px] font-bold bg-[#f23645] hover:bg-[#f65360] text-white shadow transition cursor-pointer select-none leading-none border border-[#f23645]/50" title="Quick SELL ${this.symbol}">S</button>
          </div>
          <div class="legend-ohlc">
            <span>O <span class="legend-val legend-o">-</span></span>
            <span>H <span class="legend-val legend-h">-</span></span>
            <span>L <span class="legend-val legend-l">-</span></span>
            <span>C <span class="legend-val legend-c">-</span></span>
            <span class="legend-val legend-change">0.00%</span>
            <span>Vol <span class="legend-val legend-vol">-</span></span>
          </div>
        </div>
        <div class="chart-tile-actions">
          <button class="tile-action-btn btn-autoscale-tile" title="Auto Scale Price & Fit (Double-click chart)">
            <i data-lucide="maximize" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-refresh-tile" title="Refresh Chart Data & Auto-Fit">
            <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-timeframe" title="Change Timeframe">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-chart-type" title="Chart Type">
            <i data-lucide="candlestick-chart" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-indicators" title="Toggle Indicators">
            <i data-lucide="activity" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-maximize" title="Maximize Chart">
            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tile-action-btn btn-close" title="Remove Chart">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="chart-canvas-wrapper relative">
        <div class="chart-indicators-legend"></div>
        <div class="chart-tv-container" id="tv_chart_${this.id}"></div>
        <canvas class="drawing-overlay-canvas"></canvas>
        <button type="button" class="btn-chart-corner-auto" title="Auto Scale Price Range (Double-click chart to reset)">auto</button>
      </div>
    `;

    // Elements
    this.tvContainer = this.container.querySelector(`#tv_chart_${this.id}`);
    this.overlayCanvas = this.container.querySelector('.drawing-overlay-canvas');
    this.symbolEl = this.container.querySelector('.symbol-name');
    this.intervalEl = this.container.querySelector('.legend-interval');
    this.openEl = this.container.querySelector('.legend-o');
    this.highEl = this.container.querySelector('.legend-h');
    this.lowEl = this.container.querySelector('.legend-l');
    this.closeEl = this.container.querySelector('.legend-c');
    this.changeEl = this.container.querySelector('.legend-change');
    this.volEl = this.container.querySelector('.legend-vol');

    this.bindHeaderEvents();

    // Strict Authentication Guard: If anyone touches the chart tile without login, immediately redirect to login modal
    const enforceAuthTile = (e) => {
      if (window.authManager && !window.authManager.isAuthenticated()) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        window.authManager.openAuthModal('login');
        return false;
      }
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(evt => {
      this.container.addEventListener(evt, enforceAuthTile, true);
    });
  }

  bindHeaderEvents() {
    // Quick Buy & Sell Buttons
    const buyBtn = this.container.querySelector('.btn-chart-quick-buy');
    buyBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid?.setActiveChart(this);
      const lastPrice = this.candles.length ? this.candles[this.candles.length - 1].close : 0;
      if (window.ordersManager) {
        window.ordersManager.openPlaceModal({ symbol: this.symbol, side: 'BUY', price: lastPrice });
      }
    });

    const sellBtn = this.container.querySelector('.btn-chart-quick-sell');
    sellBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid?.setActiveChart(this);
      const lastPrice = this.candles.length ? this.candles[this.candles.length - 1].close : 0;
      if (window.ordersManager) {
        window.ordersManager.openPlaceModal({ symbol: this.symbol, side: 'SELL', price: lastPrice });
      }
    });

    const symBtn = this.container.querySelector('.legend-symbol');
    symBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid.setActiveChart(this);
      window.app.openSymbolSearchModal();
    });

    const autoScaleBtn = this.container.querySelector('.btn-autoscale-tile');
    autoScaleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetPriceScale();
    });

    const cornerAutoBtn = this.container.querySelector('.btn-chart-corner-auto');
    cornerAutoBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetPriceScale();
    });

    const refBtn = this.container.querySelector('.btn-refresh-tile');
    refBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetPriceScale();
      this.loadData();
    });

    // Double-click anywhere on chart canvas or drawing overlay resets price scale to Auto
    this.tvContainer?.addEventListener('dblclick', () => {
      this.resetPriceScale();
    });
    this.overlayCanvas?.addEventListener('dblclick', () => {
      this.resetPriceScale();
    });

    const tfBtn = this.container.querySelector('.btn-timeframe');
    if (tfBtn) {
      tfBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.multiChartGrid.setActiveChart(this);
        window.app.showTimeframeDropdown(tfBtn, (newTf) => this.setInterval(newTf));
      });
    }
    if (this.intervalEl) {
      this.intervalEl.addEventListener('click', (e) => {
        e.stopPropagation();
        window.multiChartGrid.setActiveChart(this);
        window.app.showTimeframeDropdown(this.intervalEl, (newTf) => this.setInterval(newTf));
      });
    }

    const ctBtn = this.container.querySelector('.btn-chart-type');
    ctBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid.setActiveChart(this);
      window.app.showChartTypeDropdown(ctBtn, (newType) => this.setChartType(newType));
    });

    const indBtn = this.container.querySelector('.btn-indicators');
    indBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid.setActiveChart(this);
      window.app.showIndicatorModal(this);
    });

    const maxBtn = this.container.querySelector('.btn-maximize');
    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
    });

    const closeBtn = this.container.querySelector('.btn-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.multiChartGrid.removeChartTile(this);
    });

    this.container.addEventListener('click', () => {
      window.multiChartGrid.setActiveChart(this);
    });
  }

  initChart() {
    const isDark = !document.body.classList.contains('theme-light');
    const width = this.tvContainer.clientWidth || 300;
    const height = this.tvContainer.clientHeight || 200;

    this.chart = LightweightCharts.createChart(this.tvContainer, {
      width: width,
      height: height,
      layout: {
        background: { color: isDark ? '#131722' : '#ffffff' },
        textColor: isDark ? '#d1d4dc' : '#131722',
        fontSize: 11,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif"
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode ? LightweightCharts.CrosshairMode.Normal : 0,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#2962ff'
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#2962ff'
        }
      },
      // Smooth Scroll & Pan
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      // Smooth Scale: Drag price axis up/down or time axis left/right
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true
        },
        mouseWheel: true,
        pinch: true
      },
      timeScale: {
        borderColor: isDark ? '#2a2e39' : '#e0e3eb',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        tickMarkFormatter: (time, tickMarkType, locale) => {
          // Format time explicitly in Indian Standard Time (IST: UTC + 5:30)
          const date = new Date(time * 1000);
          const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + (330 * 60000));
          const hh = String(istDate.getHours()).padStart(2, '0');
          const mm = String(istDate.getMinutes()).padStart(2, '0');
          const dd = String(istDate.getDate()).padStart(2, '0');
          const mmm = istDate.toLocaleString('en-IN', { month: 'short' });

          if (tickMarkType <= 2) {
            return `${dd} ${mmm}`;
          }
          return `${hh}:${mm}`;
        }
      },
      localization: {
        locale: 'en-IN',
        dateFormat: 'dd MMM yyyy',
        timeFormatter: (timestamp) => {
          if (!timestamp) return '';
          const date = new Date(timestamp * 1000);
          const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + (330 * 60000));
          const hh = String(istDate.getHours()).padStart(2, '0');
          const mm = String(istDate.getMinutes()).padStart(2, '0');
          const dd = String(istDate.getDate()).padStart(2, '0');
          const mmm = istDate.toLocaleString('en-IN', { month: 'short' });
          const yy = String(istDate.getFullYear()).slice(-2);
          return `${dd} ${mmm} '${yy} ${hh}:${mm} IST`;
        }
      },
      rightPriceScale: {
        borderColor: isDark ? '#2a2e39' : '#e0e3eb',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2
        }
      }
    });

    // Create Main Series based on chart type
    this.createMainSeries();

    // Create Volume Series using v5 / v4 dual support
    const volOpts = {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: {
        top: 0.82,
        bottom: 0
      }
    };
    if (this.chart.addSeries && window.LightweightCharts.HistogramSeries) {
      this.volumeSeries = this.chart.addSeries(window.LightweightCharts.HistogramSeries, volOpts);
    } else if (this.chart.addHistogramSeries) {
      this.volumeSeries = this.chart.addHistogramSeries(volOpts);
    }

    // Crosshair Sync & Hover Legend Updates
    this.chart.subscribeCrosshairMove((param) => {
      this.handleCrosshairMove(param);
    });

    // Sync Time Range Zoom/Pan if enabled
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (window.multiChartGrid && window.multiChartGrid.syncTime && range) {
        window.multiChartGrid.broadcastTimeRange(this, range);
      }
    });

    // Resize Observer for dynamic tile resizing
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.tvContainer);
  }

  initDrawingOverlay() {
    this.drawingOverlay = new DrawingOverlay(this.overlayCanvas, this);
    this.drawingOverlay.loadDrawings();
  }

  createMainSeries() {
    if (this.mainSeries) {
      try {
        this.chart.removeSeries(this.mainSeries);
      } catch (e) {}
      this.mainSeries = null;
    }

    const LC = window.LightweightCharts;

    if (this.chartType === 'candlestick' || this.chartType === 'heikin_ashi') {
      const opts = {
        upColor: '#089981',
        downColor: '#f23645',
        borderUpColor: '#089981',
        borderDownColor: '#f23645',
        wickUpColor: '#089981',
        wickDownColor: '#f23645'
      };
      this.mainSeries = (this.chart.addSeries && LC.CandlestickSeries)
        ? this.chart.addSeries(LC.CandlestickSeries, opts)
        : this.chart.addCandlestickSeries(opts);
    } else if (this.chartType === 'area') {
      const opts = {
        topColor: 'rgba(41, 98, 255, 0.4)',
        bottomColor: 'rgba(41, 98, 255, 0.02)',
        lineColor: '#2962ff',
        lineWidth: 2
      };
      this.mainSeries = (this.chart.addSeries && LC.AreaSeries)
        ? this.chart.addSeries(LC.AreaSeries, opts)
        : this.chart.addAreaSeries(opts);
    } else if (this.chartType === 'line') {
      const opts = {
        color: '#2962ff',
        lineWidth: 2
      };
      this.mainSeries = (this.chart.addSeries && LC.LineSeries)
        ? this.chart.addSeries(LC.LineSeries, opts)
        : this.chart.addLineSeries(opts);
    } else if (this.chartType === 'bar') {
      const opts = {
        upColor: '#089981',
        downColor: '#f23645'
      };
      this.mainSeries = (this.chart.addSeries && LC.BarSeries)
        ? this.chart.addSeries(LC.BarSeries, opts)
        : this.chart.addBarSeries(opts);
    }

    if (this.drawingOverlay) {
      this.drawingOverlay.series = this.mainSeries;
    }
  }

  resetPriceScale() {
    if (!this.chart) return;
    try {
      this.chart.priceScale('right').applyOptions({
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2
        }
      });
      if (this.mainSeries && typeof this.mainSeries.priceScale === 'function') {
        const ps = this.mainSeries.priceScale();
        if (ps && typeof ps.applyOptions === 'function') {
          ps.applyOptions({ autoScale: true });
        }
      }
      if (this.volumeSeries && typeof this.volumeSeries.priceScale === 'function') {
        try {
          this.volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 }
          });
        } catch (e) {}
      }
      this.chart.timeScale().fitContent();

      // Ensure that once the DOM/canvas repaints, autoScale is re-evaluated
      setTimeout(() => {
        if (!this.chart) return;
        try {
          this.chart.priceScale('right').applyOptions({ autoScale: true });
          this.chart.timeScale().fitContent();
        } catch (e) {}
      }, 60);
    } catch (e) {
      console.warn('Error resetting price scale:', e);
    }
  }

  async loadData() {
    if (this.unsubscribeLive) {
      this.unsubscribeLive();
      this.unsubscribeLive = null;
    }

    this.symbolEl.textContent = this.symbol;
    if (this.intervalEl) this.intervalEl.textContent = this.formatTimeframeDisplay(this.interval);

    // Instantly reset price scale so chart is NEVER stuck off-screen or in manual pan range
    this.resetPriceScale();

    // 1. Render initial fallback candles so chart NEVER blanks out
    this.candles = window.dataFeed.generateFallbackCandles(this.symbol, this.interval, 200);
    this.renderData(true);

    // 2. Fetch live history in background from Backend (Yahoo Finance / Binance)
    try {
      const rawCandles = await window.dataFeed.getHistory(this.symbol, this.interval, 300);
      if (rawCandles && rawCandles.length > 0) {
        this.candles = rawCandles;
        this.renderData(true);
      }
    } catch (e) {
      console.warn('History fetch fallback:', e);
    }

    // 3. Subscribe to real-time tick updates
    this.unsubscribeLive = window.dataFeed.subscribeBars(this.symbol, this.interval, (candle) => {
      this.onLiveCandleTick(candle);
    });
  }

  renderData(shouldFitContent = false) {
    if (!this.candles || this.candles.length === 0 || !this.mainSeries) return;

    // Filter, validate, deduplicate and sort chronologically (strictly positive prices)
    let cleanCandles = this.candles
      .filter(c => c && c.time && typeof c.close === 'number' && !isNaN(c.close) && c.close > 0 && c.high > 0 && c.low > 0 && c.open > 0)
      .sort((a, b) => a.time - b.time);

    const deduped = [];
    let prevTime = null;
    for (const c of cleanCandles) {
      if (c.time !== prevTime) {
        deduped.push(c);
        prevTime = c.time;
      }
    }
    // Purge any rogue candles that are outside this scrip's price range
    if (deduped.length > 5) {
      const lastClose = deduped[deduped.length - 1].close;
      this.candles = deduped.filter(c => Math.abs(c.close - lastClose) < (lastClose * 0.5));
    } else {
      this.candles = deduped;
    }
    let chartData = this.candles;

    if (this.chartType === 'heikin_ashi') {
      chartData = IndicatorsEngine.convertToHeikinAshi(this.candles);
    }

    if (this.chartType === 'area' || this.chartType === 'line') {
      const lineData = chartData.map(c => ({ time: c.time, value: c.close }));
      this.mainSeries.setData(lineData);
    } else {
      this.mainSeries.setData(chartData);
    }

    // Volume Series
    if (this.volumeSeries && this.activeIndicators.has('volume')) {
      const cfg = this.getIndicatorConfig('volume');
      const upColor = hexToRgba(cfg.upColor || '#089981', 0.45);
      const downColor = hexToRgba(cfg.downColor || '#f23645', 0.45);
      const volData = this.candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? upColor : downColor
      }));
      this.volumeSeries.setData(volData);
    } else if (this.volumeSeries) {
      this.volumeSeries.setData([]);
    }

    // Render Active Indicators (EMA, SMA, BB, etc.)
    this.renderIndicators();

    // Auto-fit content to center newly loaded timeframe/candles
    if (shouldFitContent && this.chart) {
      this.resetPriceScale();
    }

    // Update legend with latest candle values
    const last = this.candles[this.candles.length - 1];
    this.updateLegend(last);

    // Synchronize price with Watchlist
    if (last && window.watchlistPanel && typeof window.watchlistPanel.updatePrice === 'function') {
      const chg = last.close - last.open;
      const chgPct = last.open ? ((chg / last.open) * 100) : 0;
      window.watchlistPanel.updatePrice(this.symbol, last.close, chgPct);
    }

    // Redraw any drawings
    if (this.drawingOverlay) {
      this.drawingOverlay.render();
    }
  }

  addLineSeriesHelper(opts) {
    const LC = window.LightweightCharts;
    if (this.chart.addSeries && LC.LineSeries) {
      return this.chart.addSeries(LC.LineSeries, opts);
    } else if (this.chart.addLineSeries) {
      return this.chart.addLineSeries(opts);
    }
    return null;
  }

  loadIndicatorConfigs() {
    const merged = JSON.parse(JSON.stringify(DEFAULT_INDICATOR_CONFIGS));
    try {
      const saved = JSON.parse(localStorage.getItem('tradeview_indicator_settings') || '{}');
      for (const key in saved) {
        if (merged[key] && typeof saved[key] === 'object') {
          merged[key] = { ...merged[key], ...saved[key] };
        }
      }
      const oldTf = localStorage.getItem('tradeview_highlow_tf');
      if (oldTf && merged.highlow) {
        merged.highlow.tf = oldTf;
      }
    } catch (e) {}
    return merged;
  }

  getIndicatorConfig(id) {
    if (!this.indicatorConfigs) this.indicatorConfigs = this.loadIndicatorConfigs();
    return this.indicatorConfigs[id] || DEFAULT_INDICATOR_CONFIGS[id] || {};
  }

  updateIndicatorConfig(id, changes) {
    if (!this.indicatorConfigs) this.indicatorConfigs = this.loadIndicatorConfigs();
    this.indicatorConfigs[id] = { ...this.indicatorConfigs[id], ...changes };

    if (id === 'highlow' && changes.tf) {
      this.highLowTF = changes.tf;
      try { localStorage.setItem('tradeview_highlow_tf', changes.tf); } catch (e) {}
    }

    try {
      localStorage.setItem('tradeview_indicator_settings', JSON.stringify(this.indicatorConfigs));
    } catch (e) {}

    // Auto-enable if currently inactive so user immediately sees effect
    if (!this.activeIndicators.has(id)) {
      this.activeIndicators.add(id);
      try {
        localStorage.setItem('tradeview_saved_indicators', JSON.stringify([...this.activeIndicators]));
      } catch (e) {}
    }

    // Synchronize to other charts in multi-chart grid
    if (window.multiChartGrid && Array.isArray(window.multiChartGrid.charts)) {
      window.multiChartGrid.charts.forEach(c => {
        if (c && c !== this) {
          c.indicatorConfigs = JSON.parse(JSON.stringify(this.indicatorConfigs));
          if (id === 'highlow' && changes.tf) c.highLowTF = changes.tf;
          c.activeIndicators.add(id);
          if (id === 'volume') {
            c.updateVolumeColors();
          } else {
            c.renderIndicators();
          }
          c.updateIndicatorsLegend();
        }
      });
    }

    // Re-render this chart
    if (id === 'volume') {
      this.updateVolumeColors();
    } else {
      this.renderIndicators();
    }
    this.updateIndicatorsLegend();
  }

  resetIndicatorConfig(id) {
    if (DEFAULT_INDICATOR_CONFIGS[id]) {
      this.updateIndicatorConfig(id, { ...DEFAULT_INDICATOR_CONFIGS[id] });
    }
  }

  updateVolumeColors() {
    if (!this.volumeSeries || !this.candles || !this.activeIndicators.has('volume')) return;
    const cfg = this.getIndicatorConfig('volume');
    const upColor = hexToRgba(cfg.upColor || '#089981', 0.45);
    const downColor = hexToRgba(cfg.downColor || '#f23645', 0.45);
    const volData = this.candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? upColor : downColor
    }));
    this.volumeSeries.setData(volData);
  }

  updateIndicatorsLegend() {
    const legend = this.container.querySelector('.chart-indicators-legend');
    if (!legend) return;

    legend.innerHTML = '';
    const indicatorOrder = ['supertrend', 'vwap', 'highlow', 'bb', 'ema20', 'ema50', 'sma200', 'volume'];

    indicatorOrder.forEach(id => {
      if (!this.activeIndicators.has(id)) return;
      const cfg = this.getIndicatorConfig(id);

      let name = id.toUpperCase();
      let dotColor = '#2962ff';

      if (id === 'ema20') {
        name = `EMA ${cfg.period || 20}`;
        dotColor = cfg.color || '#2962ff';
      } else if (id === 'ema50') {
        name = `EMA ${cfg.period || 50}`;
        dotColor = cfg.color || '#ff9800';
      } else if (id === 'sma200') {
        name = `SMA ${cfg.period || 200}`;
        dotColor = cfg.color || '#9c27b0';
      } else if (id === 'bb') {
        name = `BB (${cfg.period || 20}, ${cfg.stdDev || 2})`;
        dotColor = cfg.midColor || '#ff9800';
      } else if (id === 'supertrend') {
        name = `ST (${cfg.period || 10}, ${cfg.multiplier || 3})`;
        dotColor = cfg.bullColor || '#089981';
      } else if (id === 'vwap') {
        name = 'VWAP';
        dotColor = cfg.color || '#facc15';
      } else if (id === 'highlow') {
        name = `ORB (${(cfg.tf || this.highLowTF || '15m').toUpperCase()})`;
        dotColor = cfg.highColor || '#089981';
      } else if (id === 'volume') {
        name = 'VOL';
        dotColor = cfg.upColor || '#089981';
      }

      const pill = document.createElement('div');
      pill.className = 'chart-ind-pill';
      pill.innerHTML = `
        <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${dotColor};"></span>
        <span class="font-mono text-[10px] font-semibold">${name}</span>
        <div class="pill-actions">
          <button type="button" class="btn-pill-gear" title="${name} Settings">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          <button type="button" class="btn-pill-remove" title="Remove ${name}">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>
      `;

      pill.querySelector('.btn-pill-gear')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.app) {
          window.app.showIndicatorModal(this, id);
        }
      });

      pill.querySelector('.btn-pill-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleIndicator(id);
      });

      legend.appendChild(pill);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderIndicators() {
    // Clean up old indicator series
    this.indicatorSeriesMap.forEach(s => {
      try { this.chart.removeSeries(s); } catch (e) {}
    });
    this.indicatorSeriesMap.clear();

    if (!this.candles || this.candles.length === 0) return;

    // EMA 20
    if (this.activeIndicators.has('ema20')) {
      const cfg = this.getIndicatorConfig('ema20');
      const period = parseInt(cfg.period) || 20;
      const ema20 = IndicatorsEngine.calculateEMA(this.candles, period);
      const s = this.addLineSeriesHelper({
        color: cfg.color || '#2962ff',
        lineWidth: parseInt(cfg.lineWidth) || 2,
        title: `EMA ${period}`
      });
      if (s) {
        s.setData(ema20);
        this.indicatorSeriesMap.set('ema20', s);
      }
    }

    // EMA 50
    if (this.activeIndicators.has('ema50')) {
      const cfg = this.getIndicatorConfig('ema50');
      const period = parseInt(cfg.period) || 50;
      const ema50 = IndicatorsEngine.calculateEMA(this.candles, period);
      const s = this.addLineSeriesHelper({
        color: cfg.color || '#ff9800',
        lineWidth: parseInt(cfg.lineWidth) || 2,
        title: `EMA ${period}`
      });
      if (s) {
        s.setData(ema50);
        this.indicatorSeriesMap.set('ema50', s);
      }
    }

    // SMA 200
    if (this.activeIndicators.has('sma200')) {
      const cfg = this.getIndicatorConfig('sma200');
      const period = parseInt(cfg.period) || 200;
      const sma200 = IndicatorsEngine.calculateSMA(this.candles, period);
      const s = this.addLineSeriesHelper({
        color: cfg.color || '#9c27b0',
        lineWidth: parseInt(cfg.lineWidth) || 2,
        title: `SMA ${period}`
      });
      if (s) {
        s.setData(sma200);
        this.indicatorSeriesMap.set('sma200', s);
      }
    }

    // Bollinger Bands (period, stdDev)
    if (this.activeIndicators.has('bb')) {
      const cfg = this.getIndicatorConfig('bb');
      const period = parseInt(cfg.period) || 20;
      const stdDev = parseFloat(cfg.stdDev) || 2.0;
      const bb = IndicatorsEngine.calculateBollingerBands(this.candles, period, stdDev);
      const upper = this.addLineSeriesHelper({
        color: cfg.upperColor || '#26a69a',
        lineWidth: parseInt(cfg.upperWidth) || 1,
        lineStyle: 2,
        title: `BB Upper (${period}, ${stdDev})`
      });
      const mid = this.addLineSeriesHelper({
        color: cfg.midColor || '#ff9800',
        lineWidth: parseInt(cfg.midWidth) || 1,
        title: 'BB Basis'
      });
      const lower = this.addLineSeriesHelper({
        color: cfg.lowerColor || '#ef5350',
        lineWidth: parseInt(cfg.lowerWidth) || 1,
        lineStyle: 2,
        title: 'BB Lower'
      });

      if (upper && mid && lower) {
        upper.setData(bb.upper);
        mid.setData(bb.middle);
        lower.setData(bb.lower);

        this.indicatorSeriesMap.set('bb_upper', upper);
        this.indicatorSeriesMap.set('bb_mid', mid);
        this.indicatorSeriesMap.set('bb_lower', lower);
      }
    }

    // Supertrend (period, multiplier)
    if (this.activeIndicators.has('supertrend')) {
      const cfg = this.getIndicatorConfig('supertrend');
      const period = parseInt(cfg.period) || 10;
      const multiplier = parseFloat(cfg.multiplier) || 3.0;
      const st = IndicatorsEngine.calculateSupertrend(this.candles, period, multiplier);
      const sUp = this.addLineSeriesHelper({
        color: cfg.bullColor || '#089981',
        lineWidth: parseInt(cfg.bullWidth) || 2,
        title: `Supertrend Bull (${period}, ${multiplier})`
      });
      const sDown = this.addLineSeriesHelper({
        color: cfg.bearColor || '#f23645',
        lineWidth: parseInt(cfg.bearWidth) || 2,
        title: 'Supertrend Bear'
      });

      if (sUp && sDown) {
        sUp.setData(st.up);
        sDown.setData(st.down);
        this.indicatorSeriesMap.set('supertrend_up', sUp);
        this.indicatorSeriesMap.set('supertrend_down', sDown);
      }

      if (this.mainSeries && typeof this.mainSeries.setMarkers === 'function') {
        this.mainSeries.setMarkers(st.signals || []);
      }
    } else {
      if (this.mainSeries) {
        if (typeof this.mainSeries.clearMarkers === 'function') {
          this.mainSeries.clearMarkers();
        } else if (typeof this.mainSeries.setMarkers === 'function') {
          this.mainSeries.setMarkers([]);
        }
      }
    }

    // VWAP
    if (this.activeIndicators.has('vwap')) {
      const cfg = this.getIndicatorConfig('vwap');
      const vwap = IndicatorsEngine.calculateVWAP(this.candles);
      const sVwap = this.addLineSeriesHelper({
        color: cfg.color || '#facc15',
        lineWidth: parseInt(cfg.lineWidth) || 2,
        title: 'VWAP'
      });
      if (sVwap) {
        sVwap.setData(vwap);
        this.indicatorSeriesMap.set('vwap', sVwap);
      }
    }

    // High & Low Indicator with internal timeframe settings (5m, 10m, 15m, 30m) - Static solid line from today's candle till end of session
    if (this.activeIndicators.has('highlow')) {
      const cfg = this.getIndicatorConfig('highlow');
      const tf = cfg.tf || this.highLowTF || '15m';
      const hl = IndicatorsEngine.calculateHighLow(this.candles, tf);
      const sHigh = this.addLineSeriesHelper({
        color: cfg.highColor || '#089981',
        lineWidth: parseInt(cfg.highWidth) || 2,
        lineStyle: 0, // solid line
        priceLineVisible: false, // Prevents infinite line stretching back into history
        lastValueVisible: true,  // Displays price tag badge on right axis
        title: `ORB High (${tf.toUpperCase()})`
      });
      const sLow = this.addLineSeriesHelper({
        color: cfg.lowColor || '#f23645',
        lineWidth: parseInt(cfg.lowWidth) || 2,
        lineStyle: 0, // solid line
        priceLineVisible: false, // Prevents infinite line stretching back into history
        lastValueVisible: true,  // Displays price tag badge on right axis
        title: `ORB Low (${tf.toUpperCase()})`
      });

      if (sHigh && sLow) {
        sHigh.setData(hl.high);
        sLow.setData(hl.low);
        this.indicatorSeriesMap.set('highlow_high', sHigh);
        this.indicatorSeriesMap.set('highlow_low', sLow);
      }
    }

    this.updateIndicatorsLegend();
  }

  onLiveCandleTick(candle) {
    if (!this.candles || this.candles.length === 0 || !this.mainSeries || !candle || !candle.close) return;

    const last = this.candles[this.candles.length - 1];

    // Out-of-range protection: Reject any candle tick that does not match this scrip's true price range
    if (last && last.close > 0) {
      const diffRatio = Math.abs(candle.close - last.close) / last.close;
      if (diffRatio > 0.40) {
        // Erroneous tick (e.g. 82,000 on a 1,200 rupee stock) - reject it!
        return;
      }
    }

    if (candle.time === last.time) {
      this.candles[this.candles.length - 1] = candle;
    } else if (candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > 1000) this.candles.shift();
    }

    if (this.chartType === 'area' || this.chartType === 'line') {
      this.mainSeries.update({ time: candle.time, value: candle.close });
    } else if (this.chartType === 'heikin_ashi') {
      const ha = IndicatorsEngine.convertToHeikinAshi(this.candles.slice(-2));
      if (ha.length > 0) this.mainSeries.update(ha[ha.length - 1]);
    } else {
      this.mainSeries.update(candle);
    }

    if (this.volumeSeries && this.activeIndicators.has('volume')) {
      const cfg = this.getIndicatorConfig('volume');
      const upColor = hexToRgba(cfg.upColor || '#089981', 0.45);
      const downColor = hexToRgba(cfg.downColor || '#f23645', 0.45);
      this.volumeSeries.update({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? upColor : downColor
      });
    }

    this.updateLegend(candle);

    // Synchronize real-time tick price to Watchlist
    if (window.watchlistPanel && typeof window.watchlistPanel.updatePrice === 'function') {
      const chg = candle.close - candle.open;
      const chgPct = candle.open ? ((chg / candle.open) * 100) : 0;
      window.watchlistPanel.updatePrice(this.symbol, candle.close, chgPct);
    }
  }

  handleCrosshairMove(param) {
    if (!param || !param.time || !param.seriesData || !this.mainSeries) return;

    let priceData = param.seriesData.get(this.mainSeries);
    if (priceData) {
      if (priceData.value !== undefined && priceData.close === undefined) {
        priceData = {
          open: priceData.value,
          high: priceData.value,
          low: priceData.value,
          close: priceData.value,
          volume: 0
        };
      }
      this.updateLegend(priceData);
    }

    if (window.multiChartGrid && window.multiChartGrid.syncCrosshair) {
      window.multiChartGrid.broadcastCrosshair(this, param.time, param.point);
    }
  }

  syncCrosshairTime(time) {
    if (!this.candles) return;
    const c = this.candles.find(item => item.time === time);
    if (c) {
      this.updateLegend(c);
    }
  }

  updateLegend(candle) {
    if (!candle) return;
    const isBull = candle.close >= candle.open;

    this.openEl.textContent = (candle.open || 0).toFixed(2);
    this.highEl.textContent = (candle.high || 0).toFixed(2);
    this.lowEl.textContent = (candle.low || 0).toFixed(2);
    this.closeEl.textContent = (candle.close || 0).toFixed(2);

    const chg = candle.close - candle.open;
    const chgPct = candle.open ? ((chg / candle.open) * 100).toFixed(2) : 0;
    this.changeEl.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${chgPct}%)`;
    this.changeEl.className = `legend-val legend-change ${isBull ? 'bull' : 'bear'}`;

    if (candle.volume !== undefined) {
      this.volEl.textContent = candle.volume > 1000000
        ? (candle.volume / 1000000).toFixed(2) + 'M'
        : candle.volume > 1000
        ? (candle.volume / 1000).toFixed(2) + 'K'
        : candle.volume.toFixed(0);
    }
  }

  setSymbol(newSymbol) {
    if (!newSymbol) return;
    const cleanSym = newSymbol.toUpperCase().trim();
    this.symbol = cleanSym;
    if (this.symbolEl) this.symbolEl.textContent = cleanSym;

    // Immediately clear manual scaling and auto-center the new scrip's price level
    this.resetPriceScale();
    this.loadData();

    if (this.drawingOverlay) {
      this.drawingOverlay.loadDrawings();
    }
    // Update Depth panel if active
    if (window.watchlistPanel) {
      window.watchlistPanel.renderDepth();
    }
    window.multiChartGrid?.saveState();
    if (window.app && window.multiChartGrid?.activeChart === this) {
      window.app.updateHeaderForActiveChart(this);
    }
  }

  formatTimeframeDisplay(tf) {
    if (!tf) return '5m';
    if (tf === '1M') return '1M';
    const lower = tf.toLowerCase();
    if (lower === '1h') return '1H';
    if (lower === '2h') return '2H';
    if (lower === '4h') return '4H';
    if (lower === '1d') return '1D';
    if (lower === '1w') return '1W';
    return lower;
  }

  setInterval(newInterval) {
    if (!newInterval) return;
    this.interval = newInterval === '1M' ? '1M' : newInterval.toLowerCase();
    if (this.intervalEl) this.intervalEl.textContent = this.formatTimeframeDisplay(this.interval);

    // Immediately clear manual scaling and re-fit timeframe
    this.resetPriceScale();
    this.loadData();

    window.multiChartGrid?.saveState();
    if (window.app && window.multiChartGrid?.activeChart === this) {
      window.app.updateHeaderForActiveChart(this);
    }
  }

  setChartType(newType) {
    if (this.chartType === newType) return;
    this.chartType = newType;
    this.createMainSeries();
    this.resetPriceScale();
    this.renderData(true);
    window.multiChartGrid?.saveState();
  }

  applyTheme(isDark) {
    if (!this.chart) return;
    this.chart.applyOptions({
      layout: {
        background: { color: isDark ? '#131722' : '#ffffff' },
        textColor: isDark ? '#d1d4dc' : '#131722'
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false }
      },
      crosshair: {
        vertLine: { color: isDark ? '#758696' : '#9598a1' },
        horzLine: { color: isDark ? '#758696' : '#9598a1' }
      },
      timeScale: {
        borderColor: isDark ? '#2a2e39' : '#e0e3eb'
      },
      rightPriceScale: {
        borderColor: isDark ? '#2a2e39' : '#e0e3eb'
      }
    });
    this.updateIndicatorsLegend();
    if (this.drawingOverlay) {
      this.drawingOverlay.render();
    }
  }

  toggleIndicator(indicatorName) {
    if (this.activeIndicators.has(indicatorName)) {
      this.activeIndicators.delete(indicatorName);
    } else {
      this.activeIndicators.add(indicatorName);
    }
    // Remember indicator choices in localStorage
    try {
      localStorage.setItem('tradeview_saved_indicators', JSON.stringify([...this.activeIndicators]));
    } catch (e) {}

    this.renderData();
    this.updateIndicatorsLegend();

    // Synchronize indicator preference across all charts in the grid
    if (window.multiChartGrid && window.multiChartGrid.charts) {
      window.multiChartGrid.charts.forEach(c => {
        if (c !== this) {
          c.activeIndicators = new Set(this.activeIndicators);
          c.renderData();
          c.updateIndicatorsLegend();
        }
      });
    }
  }

  setHighLowTimeframe(tf) {
    this.updateIndicatorConfig('highlow', { tf: tf });
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    if (this.isMaximized) {
      this.container.classList.add('maximized');
    } else {
      this.container.classList.remove('maximized');
    }
    this.resize();
  }

  resize() {
    if (!this.tvContainer || !this.chart) return;
    const rect = this.tvContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.chart.applyOptions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      });
      if (this.drawingOverlay) {
        this.drawingOverlay.resize();
      }
    }
  }

  destroy() {
    if (this.unsubscribeLive) {
      this.unsubscribeLive();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.chart) {
      try {
        this.chart.remove();
      } catch (e) {}
    }
  }
}

window.ChartInstance = ChartInstance;
