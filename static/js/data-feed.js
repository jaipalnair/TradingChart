/**
 * Data Feed Manager for TradeView Multi-Chart
 * Direct Binance WebSockets for real-time crypto streaming
 * REST endpoints with yfinance & procedural fallback
 */

class DataFeedManager {
  constructor() {
    this.symbols = [];
    this.wsConnections = new Map(); // key (symbol@interval) -> WebSocket
    this.subscribers = new Map();   // key -> Set of callbacks
    this.simulatedTimers = new Map();
    this.loadSymbols();
  }

  async loadSymbols() {
    try {
      const resp = await fetch('/api/symbols');
      const data = await resp.json();
      if (data && data.symbols) {
        this.symbols = data.symbols;
      }
    } catch (e) {
      console.warn('Could not load symbols list from backend:', e);
    }
    if (this.symbols.length === 0) {
      // Default fallback symbols: 100% Top Indian Equities & Indices
      this.symbols = [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🇮🇳' },
        { symbol: 'TCS', name: 'Tata Consultancy Services Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🇮🇳' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🏦' },
        { symbol: 'INFY', name: 'Infosys Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🇮🇳' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🏦' },
        { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🚗' },
        { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', category: 'Indian Stocks', icon: '🏦' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '📡' },
        { symbol: 'ITC', name: 'ITC Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '📦' },
        { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🏦' },
        { symbol: 'ZOMATO', name: 'Zomato Ltd.', exchange: 'NSE', category: 'Indian Stocks', icon: '🍽️' },
        { symbol: 'NIFTY50', name: 'NIFTY 50 Index', exchange: 'NSE', category: 'Indian Stocks', icon: '📊' },
        { symbol: 'BANKNIFTY', name: 'NIFTY Bank Index', exchange: 'NSE', category: 'Indian Stocks', icon: '📈' }
      ];
    }
  }

  isIndianMarketOpen() {
    const now = new Date();
    // Convert to Indian Standard Time (IST: UTC + 5:30)
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMins = (utcMins + 330) % 1440;
    const dayShift = Math.floor((utcMins + 330) / 1440);
    const istDay = (now.getUTCDay() + dayShift) % 7;

    // Closed on Saturday (6) or Sunday (0)
    if (istDay === 0 || istDay === 6) return false;

    // Normal Trading Hours: 09:15 AM (555 min) to 03:30 PM (930 min)
    return istMins >= 555 && istMins <= 930;
  }

  /**
   * Fetch historical candles for a symbol & interval
   */
  async getHistory(symbol, interval, limit = 500) {
    try {
      const resp = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
      const result = await resp.json();
      if (result && result.data && result.data.length > 0) {
        return result.data;
      }
    } catch (e) {
      console.warn('History fetch error, using local generator:', e);
    }
    return this.generateFallbackCandles(symbol, interval, limit);
  }

  getDefaultPriceForSymbol(symbol) {
    const sym = (symbol || '').toUpperCase().trim();
    const symClean = sym.replace('.NS', '').replace('.BO', '').replace('.', '');
    
    // Check if in user or preset watchlists
    if (window.watchlistPanel) {
      const allLists = [
        ...(window.watchlistPanel.watchlistData || []),
        ...(window.watchlistPanel.presetWatchlists?.indices || []),
        ...(window.watchlistPanel.presetWatchlists?.nifty50 || []),
        ...(window.watchlistPanel.presetWatchlists?.banknifty || [])
      ];
      const match = allLists.find(w => w.symbol === sym || w.symbol.replace('.NS', '') === symClean);
      if (match && match.price) return match.price;
    }

    const priceMap = {
      'RELIANCE': 1184.50,
      'TCS': 2506.90,
      'HDFCBANK': 1685.20,
      'INFY': 1820.40,
      'ICICIBANK': 1245.80,
      'TATAMOTORS': 982.10,
      'TMCV': 982.10,
      'SBIN': 812.30,
      'BHARTIARTL': 1680.00,
      'ITC': 472.50,
      'LT': 3540.00,
      'BAJFINANCE': 6850.00,
      'MARUTI': 12400.00,
      'TITAN': 3400.00,
      'WIPRO': 540.00,
      'INDUSINDBK': 850.50,
      'KOTAKBANK': 1780.00,
      'AXISBANK': 1180.00,
      'HINDUNILVR': 2450.00,
      'ASIANPAINT': 2580.00,
      'SUNPHARMA': 1890.00,
      'COALINDIA': 485.00,
      'ONGC': 290.00,
      'NTPC': 410.00,
      'TATASTEEL': 155.00,
      'ZOMATO': 265.50,
      'HAL': 4350.00,
      'SUZLON': 72.50,
      'BEL': 290.00,
      'JIOFIN': 325.00,
      'ADANIENT': 2850.00,
      'ADANIPORTS': 1380.00,
      'AUBANK': 625.00,
      'BANKBARODA': 250.00,
      'CANBK': 105.00,
      'FEDERALBNK': 195.00,
      'IDFCFIRSTB': 72.00,
      'PNB': 102.00,
      'UNIONBANK': 118.00,
      'YESBANK': 21.50,
      'APOLLOHOSP': 6780.00,
      'BAJAJ-AUTO': 9450.00,
      'BAJAJFINSV': 1640.00,
      'BSE': 2750.00,
      'CIPLA': 1520.00,
      'DRREDDY': 6620.00,
      'EICHERMOT': 4850.00,
      'ETERNAL': 120.00,
      'GRASIM': 2540.00,
      'HCLTECH': 1780.00,
      'HDFCLIFE': 710.00,
      'HINDALCO': 680.00,
      'JSWSTEEL': 990.00,
      'M&M': 2980.00,
      'MAXHEALTH': 980.00,
      'NESTLEIND': 2280.00,
      'POWERGRID': 325.00,
      'SBILIFE': 1720.00,
      'SHRIRAMFIN': 3150.00,
      'TATACONSUM': 1120.00,
      'TECHM': 1680.00,
      'TRENT': 7650.00,
      'ULTRACEMCO': 11200.00,
      'NIFTY50': 22687.65,
      'NIFTY': 22687.65,
      '^NSEI': 22687.65,
      'BANKNIFTY': 54280.00,
      '^NSEBANK': 54280.00,
      'MIDCPNIFTY': 13033.05,
      'NIFTY_MID_SELECT': 13033.05,
      'FINNIFTY': 24400.00,
      'NIFTYIT': 32000.00,
      'INDIAVIX': 16.85,
      'BTCUSDT': 82000.0,
      'ETHUSDT': 3120.0,
      'SOLUSDT': 182.0,
      'BNBUSDT': 590.0,
      'XRPUSDT': 0.54,
      'DOGEUSDT': 0.14,
      'AAPL': 230.0,
      'NVDA': 136.0,
      'TSLA': 218.0,
      'MSFT': 425.0,
      'AMZN': 186.0,
      'GOOGL': 165.0,
      'META': 585.0,
      'SPY': 582.0,
      'QQQ': 490.0,
      'GC=F': 2735.0,
      'CL=F': 71.50
    };

    for (const [k, v] of Object.entries(priceMap)) {
      if (sym === k || symClean === k || sym.startsWith(k) || k.startsWith(sym)) return v;
    }

    if (sym.endsWith('.NS') || sym.endsWith('.BO')) return 650.0;
    if (sym.includes('USDT') || sym.includes('BTC')) return 82000.0;
    return 850.0;
  }

  generateNSETimestamps(limit = 300, interval = '5m') {
    const intervalMins = {
      '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '4h': 240, '1d': 1440, '1w': 10080
    }[interval] || 5;

    const now = new Date();
    // Convert to Indian Standard Time (UTC + 5:30)
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istMs = utcMs + (330 * 60000);
    let cur = new Date(istMs);

    if (intervalMins >= 1440) {
      const days = [];
      while (days.length < limit) {
        while (cur.getDay() === 0 || cur.getDay() === 6) {
          cur.setDate(cur.getDate() - 1);
        }
        cur.setHours(9, 15, 0, 0);
        const epoch = Math.floor((cur.getTime() - (330 * 60000)) / 1000);
        days.push(epoch);
        cur.setDate(cur.getDate() - 1);
      }
      return days.reverse();
    }

    // Intraday timestamps strictly during NSE trading hours (09:15 - 15:30 IST)
    while (cur.getDay() === 0 || cur.getDay() === 6) {
      cur.setDate(cur.getDate() - 1);
      cur.setHours(15, 30, 0, 0);
    }

    const minsOfDay = cur.getHours() * 60 + cur.getMinutes();
    if (minsOfDay > 930) {
      cur.setHours(15, 30, 0, 0);
    } else if (minsOfDay < 555) {
      cur.setDate(cur.getDate() - 1);
      while (cur.getDay() === 0 || cur.getDay() === 6) {
        cur.setDate(cur.getDate() - 1);
      }
      cur.setHours(15, 30, 0, 0);
    } else {
      const m = Math.floor(cur.getMinutes() / intervalMins) * intervalMins;
      cur.setMinutes(m, 0, 0);
    }

    const timestamps = [];
    while (timestamps.length < limit) {
      const epoch = Math.floor((cur.getTime() - (330 * 60000)) / 1000);
      timestamps.push(epoch);

      cur.setMinutes(cur.getMinutes() - intervalMins);
      const curMins = cur.getHours() * 60 + cur.getMinutes();
      if (curMins < 555) { // Hit market open (09:15)
        cur.setDate(cur.getDate() - 1);
        while (cur.getDay() === 0 || cur.getDay() === 6) {
          cur.setDate(cur.getDate() - 1);
        }
        cur.setHours(15, 30, 0, 0);
      }
    }

    return timestamps.reverse();
  }

  generateFallbackCandles(symbol, interval, limit = 300) {
    const basePrice = this.getDefaultPriceForSymbol(symbol);
    const symUpper = (symbol || '').toUpperCase();
    const isCrypto = symUpper.includes('USDT') || ['BTC', 'ETH', 'SOL', 'BNB'].some(c => symUpper.includes(c));
    const isUS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'SPY', 'QQQ'].some(u => symUpper.includes(u));

    let timestamps = [];
    if (!isCrypto && !isUS) {
      // Indian market assets: Strictly use NSE session timestamps in IST
      timestamps = this.generateNSETimestamps(limit, interval);
    } else {
      const intervalSecs = {
        '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
        '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800
      }[interval] || 300;
      const now = Math.floor(Date.now() / 1000);
      const start = Math.floor((now - (limit * intervalSecs)) / intervalSecs) * intervalSecs;
      timestamps = Array.from({ length: limit }, (_, i) => start + (i * intervalSecs));
    }

    const candles = [];
    let cur = basePrice;
    const vol = basePrice * 0.0022;

    // Walk backwards from basePrice so the latest bar's close ALWAYS matches basePrice
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const t = timestamps[i];
      const cl = cur;
      const drift = (Math.random() - 0.495) * vol;
      const op = parseFloat((cl - drift).toFixed(2));
      const hi = parseFloat((Math.max(op, cl) + Math.random() * vol * 0.75).toFixed(2));
      const lo = parseFloat((Math.min(op, cl) - Math.random() * vol * 0.75).toFixed(2));
      const v = Math.floor(Math.random() * 2000 + 100);

      candles.unshift({ time: t, open: op, high: hi, low: lo, close: cl, volume: v });
      cur = op;
    }
    return candles;
  }

  /**
   * Subscribe to real-time candle tick updates
   * @param {string} symbol
   * @param {string} interval
   * @param {function} onTickCallback
   */
  subscribeBars(symbol, interval, onTickCallback) {
    const key = `${symbol.toUpperCase()}@${interval.toLowerCase()}`;

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(onTickCallback);

    // If crypto, attempt Binance WebSocket stream
    const isCrypto = symbol.toUpperCase().includes('USDT') || ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP', 'ADA'].some(c => symbol.toUpperCase().includes(c));

    if (isCrypto) {
      this.startBinanceStream(symbol, interval, key);
    } else {
      this.startSimulatedStream(symbol, interval, key);
    }

    return () => this.unsubscribeBars(key, onTickCallback);
  }

  unsubscribeBars(key, callback) {
    if (this.subscribers.has(key)) {
      const set = this.subscribers.get(key);
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(key);
        if (this.wsConnections.has(key)) {
          const ws = this.wsConnections.get(key);
          try { ws.close(); } catch (e) {}
          this.wsConnections.delete(key);
        }
        if (this.simulatedTimers.has(key)) {
          clearInterval(this.simulatedTimers.get(key));
          this.simulatedTimers.delete(key);
        }
      }
    }
  }

  startBinanceStream(symbol, interval, key) {
    if (this.wsConnections.has(key)) return;

    let biSymbol = symbol.replace('/', '').replace('-', '').toLowerCase();
    if (!biSymbol.endsWith('usdt')) biSymbol += 'usdt';

    const biInterval = interval.toLowerCase();
    const streamName = `${biSymbol}@kline_${biInterval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.e === 'kline' && msg.k) {
            const k = msg.k;
            const candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isBarClosed: k.x
            };

            const subs = this.subscribers.get(key);
            if (subs) {
              subs.forEach(cb => cb(candle));
            }
          }
        } catch (err) {}
      };

      ws.onerror = () => {
        this.startSimulatedStream(symbol, interval, key);
      };

      ws.onclose = () => {
        this.wsConnections.delete(key);
      };

      this.wsConnections.set(key, ws);
    } catch (e) {
      this.startSimulatedStream(symbol, interval, key);
    }
  }

  startSimulatedStream(symbol, interval, key) {
    if (this.simulatedTimers.has(key)) return;

    const isCrypto = symbol.toUpperCase().includes('USDT') || ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP', 'ADA'].some(c => symbol.toUpperCase().includes(c));

    // If Indian market is closed and this is an Indian equity/index, FREEZE prices!
    if (!isCrypto && !this.isIndianMarketOpen()) {
      console.log(`[DataFeed] Indian market is closed (Hours: Mon-Fri 09:15-15:30 IST). Prices for ${symbol} are frozen at market close.`);
      return;
    }

    // Correctly seed from chart's true candle or scrip's true price
    const chart = window.multiChartGrid?.charts?.find(c => c.symbol === symbol);
    let lastClose = (chart && chart.candles && chart.candles.length > 0)
      ? chart.candles[chart.candles.length - 1].close
      : this.getDefaultPriceForSymbol(symbol);

    const intervalSecs = {
      '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800
    }[interval] || 300;

    let currentBarTime = Math.floor(Date.now() / 1000 / intervalSecs) * intervalSecs;
    let currentBar = {
      time: currentBarTime,
      open: lastClose,
      high: lastClose,
      low: lastClose,
      close: lastClose,
      volume: 100
    };

    const timer = setInterval(() => {
      // If market closed while running, stop timer
      if (!isCrypto && !this.isIndianMarketOpen()) {
        clearInterval(timer);
        this.simulatedTimers.delete(key);
        return;
      }

      // Re-anchor to true chart price if available
      if (chart && chart.candles && chart.candles.length > 0) {
        const trueLast = chart.candles[chart.candles.length - 1];
        if (Math.abs(currentBar.close - trueLast.close) > (trueLast.close * 0.1)) {
          currentBar.close = trueLast.close;
          currentBar.open = trueLast.close;
          currentBar.high = trueLast.close;
          currentBar.low = trueLast.close;
        }
      }

      const nowSecs = Math.floor(Date.now() / 1000);
      const expectedBarTime = Math.floor(nowSecs / intervalSecs) * intervalSecs;

      const delta = (Math.random() - 0.495) * (currentBar.close * 0.0006);
      const newClose = parseFloat((currentBar.close + delta).toFixed(2));

      if (expectedBarTime !== currentBar.time) {
        currentBar = {
          time: expectedBarTime,
          open: currentBar.close,
          high: Math.max(currentBar.close, newClose),
          low: Math.min(currentBar.close, newClose),
          close: newClose,
          volume: Math.floor(Math.random() * 50) + 10,
          isBarClosed: false
        };
      } else {
        currentBar.close = newClose;
        currentBar.high = Math.max(currentBar.high, newClose);
        currentBar.low = Math.min(currentBar.low, newClose);
        currentBar.volume += Math.floor(Math.random() * 5);
        currentBar.isBarClosed = false;
      }

      const subs = this.subscribers.get(key);
      if (subs) {
        subs.forEach(cb => cb({ ...currentBar }));
      }
    }, 1500);

    this.simulatedTimers.set(key, timer);
  }
}

window.dataFeed = new DataFeedManager();
