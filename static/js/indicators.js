/**
 * Technical Indicators Engine for TradeView Multi-Chart
 * Standard mathematical calculations for SMA, EMA, Bollinger Bands, RSI, MACD, and Heikin-Ashi.
 */

window.IndicatorsEngine = {
  /**
   * Calculate Simple Moving Average (SMA)
   * @param {Array} candles - Array of candle objects with {time, close}
   * @param {number} period - Window size, e.g. 20, 50, 200
   * @returns {Array} Array of {time, value}
   */
  calculateSMA(candles, period = 20) {
    if (!candles || candles.length < period) return [];
    const results = [];
    let sum = 0;

    for (let i = 0; i < candles.length; i++) {
      sum += candles[i].close;
      if (i >= period) {
        sum -= candles[i - period].close;
      }
      if (i >= period - 1) {
        results.push({
          time: candles[i].time,
          value: parseFloat((sum / period).toFixed(4))
        });
      }
    }
    return results;
  },

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {Array} candles - Array of candle objects with {time, close}
   * @param {number} period - Window size, e.g. 9, 20, 50, 200
   * @returns {Array} Array of {time, value}
   */
  calculateEMA(candles, period = 20) {
    if (!candles || candles.length < period) return [];
    const results = [];
    const k = 2 / (period + 1);

    // Initial SMA for first EMA seed
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += candles[i].close;
    }
    let prevEma = sum / period;
    results.push({
      time: candles[period - 1].time,
      value: parseFloat(prevEma.toFixed(4))
    });

    for (let i = period; i < candles.length; i++) {
      const currentEma = (candles[i].close * k) + (prevEma * (1 - k));
      results.push({
        time: candles[i].time,
        value: parseFloat(currentEma.toFixed(4))
      });
      prevEma = currentEma;
    }
    return results;
  },

  /**
   * Calculate Bollinger Bands (BB)
   * @param {Array} candles - Array of candle objects
   * @param {number} period - Window size (default 20)
   * @param {number} stdDevMult - Standard deviation multiplier (default 2.0)
   * @returns {Object} { upper: [], middle: [], lower: [] }
   */
  calculateBollingerBands(candles, period = 20, stdDevMult = 2.0) {
    if (!candles || candles.length < period) {
      return { upper: [], middle: [], lower: [] };
    }

    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, c) => acc + c.close, 0);
      const sma = sum / period;

      const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - sma, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      const time = candles[i].time;
      middle.push({ time, value: parseFloat(sma.toFixed(4)) });
      upper.push({ time, value: parseFloat((sma + (stdDev * stdDevMult)).toFixed(4)) });
      const lowerVal = sma - (stdDev * stdDevMult);
      if (lowerVal > 0) {
        lower.push({ time, value: parseFloat(lowerVal.toFixed(4)) });
      } else {
        lower.push({ time });
      }
    }

    return { upper, middle, lower };
  },

  /**
   * Calculate Relative Strength Index (RSI) using Wilder's smoothing
   * @param {Array} candles - Array of candle objects
   * @param {number} period - Period (default 14)
   * @returns {Array} Array of {time, value}
   */
  calculateRSI(candles, period = 14) {
    if (!candles || candles.length <= period) return [];
    const results = [];

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) {
        gains += diff;
      } else {
        losses += Math.abs(diff);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = 100 - (100 / (1 + rs));

    results.push({
      time: candles[period].time,
      value: parseFloat(rsi.toFixed(2))
    });

    for (let i = period + 1; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));

      results.push({
        time: candles[i].time,
        value: parseFloat(rsi.toFixed(2))
      });
    }

    return results;
  },

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param {Array} candles
   * @param {number} fastPeriod - Default 12
   * @param {number} slowPeriod - Default 26
   * @param {number} signalPeriod - Default 9
   * @returns {Object} { macd: [], signal: [], histogram: [] }
   */
  calculateMACD(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!candles || candles.length < slowPeriod + signalPeriod) {
      return { macd: [], signal: [], histogram: [] };
    }

    const fastEMA = this.calculateEMA(candles, fastPeriod);
    const slowEMA = this.calculateEMA(candles, slowPeriod);

    // Fast EMA starts earlier than slow EMA; align them by timestamp
    const slowEMAMap = new Map(slowEMA.map(item => [item.time, item.value]));
    const macdLine = [];

    for (const fast of fastEMA) {
      if (slowEMAMap.has(fast.time)) {
        const val = fast.value - slowEMAMap.get(fast.time);
        macdLine.push({ time: fast.time, close: val }); // use 'close' so we can reuse calculateEMA
      }
    }

    const signalEMA = this.calculateEMA(macdLine, signalPeriod);
    const signalMap = new Map(signalEMA.map(item => [item.time, item.value]));

    const macdResult = [];
    const signalResult = [];
    const histogramResult = [];

    for (const m of macdLine) {
      if (signalMap.has(m.time)) {
        const sigVal = signalMap.get(m.time);
        const histVal = m.close - sigVal;
        const time = m.time;

        macdResult.push({ time, value: parseFloat(m.close.toFixed(4)) });
        signalResult.push({ time, value: parseFloat(sigVal.toFixed(4)) });
        histogramResult.push({
          time,
          value: parseFloat(histVal.toFixed(4)),
          color: histVal >= 0 ? '#089981' : '#f23645'
        });
      }
    }

    return {
      macd: macdResult,
      signal: signalResult,
      histogram: histogramResult
    };
  },

  /**
   * Convert regular candles to Heikin-Ashi candles
   * @param {Array} candles - standard OHLCV candles
   * @returns {Array} Heikin-Ashi transformed candles
   */
  convertToHeikinAshi(candles) {
    if (!candles || candles.length === 0) return [];
    const haCandles = [];

    // First bar
    let prevOpen = candles[0].open;
    let prevClose = candles[0].close;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);

      haCandles.push({
        time: c.time,
        open: parseFloat(haOpen.toFixed(4)),
        high: parseFloat(haHigh.toFixed(4)),
        low: parseFloat(haLow.toFixed(4)),
        close: parseFloat(haClose.toFixed(4)),
        volume: c.volume
      });

      prevOpen = haOpen;
      prevClose = haClose;
    }

    return haCandles;
  },

  /**
   * Calculate Supertrend Indicator
   * Period: 10, Multiplier: 3
   * @param {Array} candles - Array of candle objects {time, open, high, low, close}
   * @param {number} period - ATR window (default 10)
   * @param {number} multiplier - ATR multiplier (default 3)
   * @returns {Object} { up: Array, down: Array, signals: Array }
   */
  calculateSupertrend(candles, period = 10, multiplier = 3) {
    if (!candles || candles.length < period) {
      return { up: [], down: [], signals: [] };
    }

    const n = candles.length;
    // 1. True Range calculation
    const tr = new Array(n);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < n; i++) {
      const hl = candles[i].high - candles[i].low;
      const hpc = Math.abs(candles[i].high - candles[i - 1].close);
      const lpc = Math.abs(candles[i].low - candles[i - 1].close);
      tr[i] = Math.max(hl, hpc, lpc);
    }

    // 2. Wilder's RMA for ATR
    const atr = new Array(n);
    let trSum = 0;
    for (let i = 0; i < period; i++) {
      trSum += tr[i];
    }
    atr[period - 1] = trSum / period;
    for (let i = period; i < n; i++) {
      atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
    }

    // 3. Supertrend Bands & Direction
    const basicUpper = new Array(n);
    const basicLower = new Array(n);
    const finalUpper = new Array(n);
    const finalLower = new Array(n);
    const supertrend = new Array(n);
    const direction = new Array(n);

    const up = [];
    const down = [];
    const signals = [];

    // Prior to period - 1, fill with whitespace
    for (let i = 0; i < period - 1; i++) {
      up.push({ time: candles[i].time });
      down.push({ time: candles[i].time });
    }

    // Initialize first bar at period - 1
    const p1 = period - 1;
    const hl2_init = (candles[p1].high + candles[p1].low) / 2;
    basicUpper[p1] = hl2_init + (multiplier * atr[p1]);
    basicLower[p1] = hl2_init - (multiplier * atr[p1]);
    finalUpper[p1] = basicUpper[p1];
    finalLower[p1] = basicLower[p1];
    direction[p1] = candles[p1].close >= hl2_init ? 1 : -1;
    supertrend[p1] = direction[p1] === 1 ? finalLower[p1] : finalUpper[p1];

    if (direction[p1] === 1) {
      up.push({ time: candles[p1].time, value: parseFloat(supertrend[p1].toFixed(2)) });
      down.push({ time: candles[p1].time });
    } else {
      down.push({ time: candles[p1].time, value: parseFloat(supertrend[p1].toFixed(2)) });
      up.push({ time: candles[p1].time });
    }

    for (let i = period; i < n; i++) {
      const hl2 = (candles[i].high + candles[i].low) / 2;
      basicUpper[i] = hl2 + (multiplier * atr[i]);
      basicLower[i] = hl2 - (multiplier * atr[i]);

      // Final Upper
      if (basicUpper[i] < finalUpper[i - 1] || candles[i - 1].close > finalUpper[i - 1]) {
        finalUpper[i] = basicUpper[i];
      } else {
        finalUpper[i] = finalUpper[i - 1];
      }

      // Final Lower
      if (basicLower[i] > finalLower[i - 1] || candles[i - 1].close < finalLower[i - 1]) {
        finalLower[i] = basicLower[i];
      } else {
        finalLower[i] = finalLower[i - 1];
      }

      // Trend check
      if (direction[i - 1] === 1) {
        if (candles[i].close < finalLower[i]) {
          direction[i] = -1;
          supertrend[i] = finalUpper[i];
          signals.push({
            time: candles[i].time,
            position: 'aboveBar',
            color: '#f23645',
            shape: 'arrowDown',
            text: 'SELL'
          });
        } else {
          direction[i] = 1;
          supertrend[i] = finalLower[i];
        }
      } else {
        if (candles[i].close > finalUpper[i]) {
          direction[i] = 1;
          supertrend[i] = finalLower[i];
          signals.push({
            time: candles[i].time,
            position: 'belowBar',
            color: '#089981',
            shape: 'arrowUp',
            text: 'BUY'
          });
        } else {
          direction[i] = -1;
          supertrend[i] = finalUpper[i];
        }
      }

      const stVal = parseFloat(supertrend[i].toFixed(2));
      const t = candles[i].time;

      if (direction[i] === 1) {
        if (stVal > 0) {
          up.push({ time: t, value: stVal });
        } else {
          up.push({ time: t });
        }
        down.push({ time: t });
      } else {
        if (stVal > 0) {
          down.push({ time: t, value: stVal });
        } else {
          down.push({ time: t });
        }
        up.push({ time: t });
      }
    }

    return { up, down, signals };
  },

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   * Resets daily at session start (IST calendar day)
   * @param {Array} candles - Array of candle objects
   * @returns {Array} Array of {time, value}
   */
  calculateVWAP(candles) {
    if (!candles || candles.length === 0) return [];
    const results = [];
    let cumTPV = 0;
    let cumVol = 0;
    let prevDayKey = null;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      // Convert UTC timestamp to IST date string for day grouping (UTC + 5:30)
      const istMs = (c.time * 1000) + (330 * 60 * 1000);
      const istDate = new Date(istMs);
      const dayKey = `${istDate.getUTCFullYear()}-${istDate.getUTCMonth()}-${istDate.getUTCDate()}`;

      if (dayKey !== prevDayKey) {
        cumTPV = 0;
        cumVol = 0;
        prevDayKey = dayKey;
      }

      const tp = (c.high + c.low + c.close) / 3;
      const vol = (c.volume && c.volume > 0) ? c.volume : 1;

      cumTPV += tp * vol;
      cumVol += vol;

      const vwapVal = cumTPV / cumVol;
      results.push({
        time: c.time,
        value: parseFloat(vwapVal.toFixed(2))
      });
    }

    return results;
  },

  /**
   * Calculate Session Opening Range Breakout (ORB) High and Low
   * Static horizontal line starting from today's first candle till end of today's session (15:30 IST)
   * Settings: 5m, 10m, 15m, 30m
   * @param {Array} candles - Array of candle objects
   * @param {string} tf - Timeframe window: '5m', '10m', '15m', or '30m'
   * @returns {Object} { high: Array, low: Array, rangeHigh: number, rangeLow: number }
   */
  calculateHighLow(candles, tf = '15m') {
    if (!candles || candles.length === 0) {
      return { high: [], low: [], rangeHigh: 0, rangeLow: 0 };
    }

    const durationMap = {
      '5m': 5 * 60,
      '10m': 10 * 60,
      '15m': 15 * 60,
      '30m': 30 * 60
    };
    const durationSec = durationMap[tf] || (15 * 60);

    // Identify the current (most recent) trading day using IST calendar day
    const lastCandle = candles[candles.length - 1];
    const lastIstMs = (lastCandle.time * 1000) + (330 * 60 * 1000);
    const lastIstDate = new Date(lastIstMs);
    const currentDayKey = `${lastIstDate.getUTCFullYear()}-${lastIstDate.getUTCMonth()}-${lastIstDate.getUTCDate()}`;

    // Filter candles strictly belonging to the current trading day
    const currentDayCandles = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const istMs = (c.time * 1000) + (330 * 60 * 1000);
      const istDate = new Date(istMs);
      const dayKey = `${istDate.getUTCFullYear()}-${istDate.getUTCMonth()}-${istDate.getUTCDate()}`;
      if (dayKey === currentDayKey) {
        currentDayCandles.push(c);
      }
    }

    if (currentDayCandles.length === 0) {
      currentDayCandles.push(lastCandle);
    }

    // Determine the Opening Range High and Low
    const sessionStartCandle = currentDayCandles[0];
    const sessionStartTime = sessionStartCandle.time;
    const cutoffTime = sessionStartTime + durationSec;

    // Opening range window bars
    const initialWindowBars = currentDayCandles.filter(c => c.time < cutoffTime);
    const windowBars = initialWindowBars.length > 0 ? initialWindowBars : [sessionStartCandle];

    const orbHigh = Math.max(...windowBars.map(c => c.high));
    const orbLow = Math.min(...windowBars.map(c => c.low));

    const hVal = parseFloat(orbHigh.toFixed(2));
    const lVal = parseFloat(orbLow.toFixed(2));

    // Calculate end of today's session (15:30 IST = 10:00 UTC)
    const startIstMs = (sessionStartTime * 1000) + (330 * 60 * 1000);
    const startIstDate = new Date(startIstMs);
    const year = startIstDate.getUTCFullYear();
    const month = startIstDate.getUTCMonth();
    const date = startIstDate.getUTCDate();

    // 15:30 IST in UTC timestamp (15:30 - 5:30 = 10:00 UTC)
    const sessionEndUtcMs = Date.UTC(year, month, date, 10, 0, 0);
    let sessionEndTime = Math.floor(sessionEndUtcMs / 1000);

    // If session started at or after 15:30 (e.g. 24h crypto or odd session), project 6h 15m ahead
    if (sessionEndTime <= sessionStartTime) {
      sessionEndTime = sessionStartTime + (6 * 3600 + 15 * 60);
    }

    // Detect bar interval in seconds
    let stepSec = 300; // default 5m
    if (currentDayCandles.length >= 2) {
      const diff = currentDayCandles[1].time - currentDayCandles[0].time;
      if (diff > 0 && diff <= 3600) stepSec = diff;
    } else if (candles.length >= 2) {
      const diff = candles[candles.length - 1].time - candles[candles.length - 2].time;
      if (diff > 0 && diff <= 3600) stepSec = diff;
    }

    // Populate all timestamps starting from today's first candle till end of today's session
    const times = currentDayCandles.map(c => c.time);
    let lastTime = times[times.length - 1];
    while (lastTime + stepSec <= sessionEndTime) {
      lastTime += stepSec;
      times.push(lastTime);
    }

    // Ensure sessionEndTime is explicitly included if not already
    if (times[times.length - 1] < sessionEndTime) {
      times.push(sessionEndTime);
    }

    // Plot static horizontal line strictly from today's first candle till end of session
    const highData = [];
    const lowData = [];

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      highData.push({ time: t, value: hVal });
      lowData.push({ time: t, value: lVal });
    }

    return {
      high: highData,
      low: lowData,
      rangeHigh: hVal,
      rangeLow: lVal
    };
  }
};
