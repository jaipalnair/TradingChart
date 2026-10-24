# TradeView Multi - Professional Multi-Chart Trading Platform

An authentic, high-performance, real-time multi-chart trading workstation inspired by TradingView Pro/Premium. Built with TradingView's official **Lightweight Charts™ v4.2.1**, **FastAPI**, **Binance WebSockets**, and **Yahoo Finance**.

![Platform Preview](https://raw.githubusercontent.com/tradingview/lightweight-charts/master/.github/preview.png)

---

## 🚀 Quick Start

### 1-Click Launch (Windows)
Double-click `start.bat` in the project root:
```bat
start.bat
```
This automatically boots the FastAPI backend and opens the TradingView workstation in your browser at `http://localhost:8000`.

### Manual Launch via Terminal
```bash
python backend.py
```
Then navigate to: **[http://localhost:8000](http://localhost:8000)**

---

## 🌟 Key Capabilities & Features

### 1. Multi-Chart Grid Engine
Switch seamlessly between multi-pane configurations via the top layout selector or keyboard shortcuts:
- **1 Chart**: Fullscreen single focused chart.
- **2 Charts Horizontal (2H)**: Side-by-side split view.
- **2 Charts Vertical (2V)**: Top & bottom stacked view.
- **3 Charts (3L)**: 1 large master chart on the left, 2 stacked on the right.
- **3 Charts (3T)**: 1 wide chart on top, 2 side-by-side on the bottom.
- **3 Columns (3C)**: 3 side-by-side vertical columns.
- **4 Charts (4 Grid - 2x2)**: The classic 4-quadrant multi-timeframe analysis layout.
- **6 Charts (6 Grid - 2x3)**: 6 synchronized market panels.
- **8 Charts (8 Grid - 2x4)**: High-density 8-market surveillance grid.
- **Individual Maximize**: Click the `Maximize` button on any tile header to expand that tile fullscreen inside the workspace, then click again to restore the grid!

---

### 2. TradingView Pro-Grade Synchronization Engine
Configure synchronization across all grid charts with independent toggles in the **Sync** menu:
- 🟢 **Crosshair Sync**: Moving the cursor across any chart synchronously tracks the matching timestamp and highlights corresponding candle data across all other charts.
- 🟢 **Symbol Sync**: Toggle ON to synchronize all charts to the same asset (ideal for multi-timeframe analysis: 1m, 15m, 1H, 1D on the same symbol!). Toggle OFF to analyze different assets on each chart.
- 🟢 **Interval Sync**: Synchronize timeframe switching across all charts or maintain independent chart timeframes.
- 🟢 **Date Range & Scroll Sync**: Panning or zooming on one chart synchronously adjusts the visible logical time range of the other charts.

---

### 3. Real-Time Streaming & Asset Universe
- **Crypto (Zero-Latency Binance Public WebSockets)**:
  - Real-time live candle ticking for `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `XRPUSDT`, `DOGEUSDT`, `ADAUSDT`, `AVAXUSDT`, `NEARUSDT`, `SUIUSDT`.
  - Sub-second tick updates, updating current candle high/low/close and volume dynamically.
- **Stocks & Indices (Yahoo Finance Integration)**:
  - `AAPL`, `TSLA`, `NVDA`, `MSFT`, `AMZN`, `GOOGL`, `META`, `SPY`, `QQQ`.
- **Forex & Commodities**:
  - `GOLD (GC=F)`, `CRUDE OIL (CL=F)`, `EUR/USD`, `GBP/USD`.
- **Procedural Geometric Brownian Motion Fallback**:
  - Ensures the workstation is 100% operational offline without internet access.

---

### 4. Interactive Drawing Tools (Left Toolbar)
Full vector overlays mapped to chart price/time coordinates with `localStorage` persistence:
- **Crosshair / Cursor**: Default chart interaction mode.
- **Trend Line**: Multi-point trend line with snap handles.
- **Horizontal Support / Resistance Line**: Full horizontal line with real-time price badge.
- **Vertical Line**: Timestamp / event marker.
- **Order Block / Rectangle Box**: Demand and supply zone boxes with fill shading.
- **Fibonacci Retracement**: Automatic standard Fib levels (`0.0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1.0`).
- **Measure Ruler**: Measures price delta (\$), percent change (%), and bar distance.
- **Eraser Mode & Trash All**: Click individual drawings to remove, or purge all drawings across charts.

---

### 5. Technical Indicators Engine
- **Volume**: Color-coded volume bars pinned to the bottom 18% of the price pane.
- **EMA 20**: Fast trend exponential moving average (Blue `#2962ff`).
- **EMA 50**: Medium trend exponential moving average (Orange `#ff9800`).
- **SMA 200**: Institutional long-term moving average (Purple `#9c27b0`).
- **Bollinger Bands**: 20-period Basis SMA with $\pm 2.0$ standard deviation Upper/Lower bands.
- **Heikin-Ashi Candles**: Transform regular OHLC into smoothed trend-following candles with one click.
- **RSI (14)** & **MACD (12, 26, 9)**.

---

### 6. Collapsible Right Sidebar
- **Live Watchlist**: Dynamic ticker list with price badges flashing green/red on real-time price changes. Click any symbol to load it into the active chart.
- **Depth of Market (DOM / Order Book)**: Live bids and asks depth ladder with volume fill bars and spread counter.
- **Technical Analysis Gauge**: Comprehensive oscillator & moving average summary (`STRONG BUY`, `BUY`, `NEUTRAL`, `SELL`, `STRONG SELL`).
- **Price Alerts**: Set target price alerts with immediate visual tracking.

---

### 7. Virtual Paper Trading Dock (Bottom Panel)
- **Virtual Balance**: Pre-funded with **\$100,000 USD** virtual capital.
- **One-Click Execution**: Quick **BUY** and **SELL** market execution buttons.
- **Positions Table**: Real-time position tracking with Entry Price, Mark Price, Unrealized PnL, and One-Click Position Close.
- **Orders History**: Full audit trail of executed paper trades.
- **Account Reset**: Reset balance back to \$100,000 at any time.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `1` | Switch to 1 Single Chart |
| `2` | Switch to 2 Charts Horizontal |
| `3` | Switch to 3 Columns Layout |
| `4` | Switch to 4 Charts Grid (2x2) |
| `6` | Switch to 6 Charts Grid (3x2) |
| `Esc` | Reset to Cursor tool / Close modal dialogs |
| `Click on Tile` | Set active focused chart |

---

## 📁 Project Structure

```
d:\AntiGravity\TradingChart\
├── static\
│   ├── css\
│   │   └── style.css                                # Authentic TradingView theme & layout styles
│   ├── js\
│   │   ├── indicators.js                           # Technical indicators mathematical algorithms
│   │   ├── drawings.js                             # Vector drawing overlays (Trend line, Fib, Rect, Ruler)
│   │   ├── data-feed.js                            # Binance WebSockets, REST & simulation engine
│   │   ├── chart-instance.js                       # Single Lightweight Chart instance wrapper
│   │   ├── multi-chart-grid.js                     # Multi-chart coordinator & synchronization engine
│   │   ├── watchlist.js                            # Watchlist, DOM depth, and technical gauge
│   │   ├── paper-trading.js                        # Virtual paper trading terminal & order ticket
│   │   └── app.js                                  # Application controller & UI bindings
│   ├── index.html                                  # Master TradingView layout & viewport
│   ├── lightweight-charts.standalone.production.js # TradingView official charting core (v4.2.1)
│   ├── lucide.min.js                               # High-DPI SVG iconography
│   └── tailwind.min.js                             # Standalone responsive UI styling
├── backend.py                                      # FastAPI REST API & live data proxy
├── test_server.py                                  # Automated integration test suite
├── start.bat                                       # 1-click Windows launcher
└── README.md                                       # Documentation & usage guide
```

---

## 🛡️ Standalone & Offline Ready
All client-side libraries (`lightweight-charts`, `lucide`, `tailwind`) are saved locally in the `static/` directory. Even without an active internet connection, the application launches immediately with full procedural market simulation.
