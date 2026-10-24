/**
 * Watchlist, Order Book Depth & Technical Analysis Panel
 * Powers the right sidebar in TraderView Multi-Chart
 * Ready-made Watchlists: Custom Watchlist (Default), Indices, Nifty 50, Bank Nifty
 */

class WatchlistPanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentTab = 'watchlist'; // watchlist, depth, technicals, alerts

    // Ready-Made Catalog
    this.presetWatchlists = {
      'indices': [
      {
            "symbol": "NIFTY50",
            "name": "Nifty 50",
            "icon": "\ud83d\udcca",
            "price": 22600.0,
            "changePercent": 0.65,
            "precision": 2,
            "currency": "\u20b9"
      },
      {
            "symbol": "BANKNIFTY",
            "name": "Bank Nifty",
            "icon": "\ud83c\udfe6",
            "price": 54280.0,
            "changePercent": 0.85,
            "precision": 2,
            "currency": "\u20b9"
      },
      {
            "symbol": "NIFTY_MID_SELECT",
            "name": "Nifty Midcap Select",
            "icon": "\ud83d\udcc8",
            "price": 13033.05,
            "changePercent": 0.85,
            "precision": 2,
            "currency": "\u20b9"
      },
      {
            "symbol": "FINNIFTY",
            "name": "FinNifty",
            "icon": "\ud83d\udcb3",
            "price": 24400.0,
            "changePercent": 0.45,
            "precision": 2,
            "currency": "\u20b9"
      },
      {
            "symbol": "NIFTYIT",
            "name": "Nifty IT",
            "icon": "\ud83d\udcbb",
            "price": 32000.0,
            "changePercent": -0.3,
            "precision": 2,
            "currency": "\u20b9"
      },
      {
            "symbol": "INDIAVIX",
            "name": "India VIX",
            "icon": "\u26a1",
            "price": 16.85,
            "changePercent": -2.15,
            "precision": 2,
            "currency": ""
      }
],
      'nifty50': [
      {
            "symbol": "ADANIENT.NS",
            "name": "Adani Enterprises Ltd.",
            "icon": "🇮🇳",
            "price": 2850.0,
            "changePercent": -0.53,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ADANIPORTS.NS",
            "name": "Adani Ports and Special Economic Zone Ltd.",
            "icon": "🇮🇳",
            "price": 1380.0,
            "changePercent": 0.21,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "APOLLOHOSP.NS",
            "name": "Apollo Hospitals Enterprise Ltd.",
            "icon": "🇮🇳",
            "price": 6780.0,
            "changePercent": -0.78,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ASIANPAINT.NS",
            "name": "Asian Paints Ltd.",
            "icon": "🇮🇳",
            "price": 2580.0,
            "changePercent": -0.43,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "AXISBANK.NS",
            "name": "Axis Bank Ltd.",
            "icon": "🇮🇳",
            "price": 1180.0,
            "changePercent": -0.31,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BAJAJ-AUTO.NS",
            "name": "Bajaj Auto Ltd.",
            "icon": "🇮🇳",
            "price": 9450.0,
            "changePercent": -0.5,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BAJFINANCE.NS",
            "name": "Bajaj Finance Ltd.",
            "icon": "🇮🇳",
            "price": 6850.0,
            "changePercent": -0.26,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BAJAJFINSV.NS",
            "name": "Bajaj Finserv Ltd.",
            "icon": "🇮🇳",
            "price": 1640.0,
            "changePercent": -0.6,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BEL.NS",
            "name": "Bharat Electronics Ltd.",
            "icon": "🇮🇳",
            "price": 290.0,
            "changePercent": 0.13,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BHARTIARTL.NS",
            "name": "Bharti Airtel Ltd.",
            "icon": "🇮🇳",
            "price": 1680.0,
            "changePercent": 0.72,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BSE.NS",
            "name": "BSE Ltd.",
            "icon": "🇮🇳",
            "price": 2750.0,
            "changePercent": 1.15,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "CIPLA.NS",
            "name": "Cipla Ltd.",
            "icon": "🇮🇳",
            "price": 1520.0,
            "changePercent": -0.35,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "COALINDIA.NS",
            "name": "Coal India Ltd.",
            "icon": "🇮🇳",
            "price": 485.0,
            "changePercent": 0.42,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "DRREDDY.NS",
            "name": "Dr. Reddy's Laboratories Ltd.",
            "icon": "🇮🇳",
            "price": 6620.0,
            "changePercent": -0.18,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "EICHERMOT.NS",
            "name": "Eicher Motors Ltd.",
            "icon": "🇮🇳",
            "price": 4850.0,
            "changePercent": 0.65,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ETERNAL.NS",
            "name": "Eternal Ltd.",
            "icon": "🇮🇳",
            "price": 120.0,
            "changePercent": -0.2,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "GRASIM.NS",
            "name": "Grasim Industries Ltd.",
            "icon": "🇮🇳",
            "price": 2540.0,
            "changePercent": 0.38,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HCLTECH.NS",
            "name": "HCL Technologies Ltd.",
            "icon": "🇮🇳",
            "price": 1780.0,
            "changePercent": -0.45,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HDFCBANK.NS",
            "name": "HDFC Bank Ltd.",
            "icon": "🇮🇳",
            "price": 1685.2,
            "changePercent": 0.28,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HDFCLIFE.NS",
            "name": "HDFC Life Insurance Company Ltd.",
            "icon": "🇮🇳",
            "price": 710.0,
            "changePercent": -0.15,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HINDALCO.NS",
            "name": "Hindalco Industries Ltd.",
            "icon": "🇮🇳",
            "price": 680.0,
            "changePercent": 0.85,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HINDUNILVR.NS",
            "name": "Hindustan Unilever Ltd.",
            "icon": "🇮🇳",
            "price": 2450.0,
            "changePercent": -0.32,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ICICIBANK.NS",
            "name": "ICICI Bank Ltd.",
            "icon": "🇮🇳",
            "price": 1245.8,
            "changePercent": 0.45,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "INDUSINDBK.NS",
            "name": "IndusInd Bank Ltd.",
            "icon": "🇮🇳",
            "price": 850.5,
            "changePercent": -0.8,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "INFY.NS",
            "name": "Infosys Ltd.",
            "icon": "🇮🇳",
            "price": 1820.4,
            "changePercent": -0.22,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ITC.NS",
            "name": "ITC Ltd.",
            "icon": "🇮🇳",
            "price": 472.5,
            "changePercent": 0.15,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "JIOFIN.NS",
            "name": "Jio Financial Services Ltd.",
            "icon": "🇮🇳",
            "price": 325.0,
            "changePercent": 0.55,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "JSWSTEEL.NS",
            "name": "JSW Steel Ltd.",
            "icon": "🇮🇳",
            "price": 990.0,
            "changePercent": 0.4,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "KOTAKBANK.NS",
            "name": "Kotak Mahindra Bank Ltd.",
            "icon": "🇮🇳",
            "price": 1780.0,
            "changePercent": -0.12,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "LT.NS",
            "name": "Larsen & Toubro Ltd.",
            "icon": "🇮🇳",
            "price": 3540.0,
            "changePercent": 0.6,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "M&M.NS",
            "name": "Mahindra & Mahindra Ltd.",
            "icon": "🇮🇳",
            "price": 2980.0,
            "changePercent": 1.1,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "MARUTI.NS",
            "name": "Maruti Suzuki India Ltd.",
            "icon": "🇮🇳",
            "price": 12400.0,
            "changePercent": 0.35,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "MAXHEALTH.NS",
            "name": "Max Healthcare Institute Ltd.",
            "icon": "🇮🇳",
            "price": 980.0,
            "changePercent": 0.75,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "NESTLEIND.NS",
            "name": "Nestlé India Ltd.",
            "icon": "🇮🇳",
            "price": 2280.0,
            "changePercent": -0.25,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "NTPC.NS",
            "name": "NTPC Ltd.",
            "icon": "🇮🇳",
            "price": 410.0,
            "changePercent": 0.5,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ONGC.NS",
            "name": "Oil & Natural Gas Corporation Ltd.",
            "icon": "🇮🇳",
            "price": 290.0,
            "changePercent": 0.3,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "POWERGRID.NS",
            "name": "Power Grid Corporation of India Ltd.",
            "icon": "🇮🇳",
            "price": 325.0,
            "changePercent": 0.2,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "RELIANCE.NS",
            "name": "Reliance Industries Ltd.",
            "icon": "🇮🇳",
            "price": 1184.5,
            "changePercent": 0.42,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "SBILIFE.NS",
            "name": "SBI Life Insurance Company Ltd.",
            "icon": "🇮🇳",
            "price": 1720.0,
            "changePercent": 0.18,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "SHRIRAMFIN.NS",
            "name": "Shriram Finance Ltd.",
            "icon": "🇮🇳",
            "price": 3150.0,
            "changePercent": 0.9,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "SBIN.NS",
            "name": "State Bank of India",
            "icon": "🇮🇳",
            "price": 812.3,
            "changePercent": 0.35,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "SUNPHARMA.NS",
            "name": "Sun Pharmaceutical Industries Ltd.",
            "icon": "🇮🇳",
            "price": 1890.0,
            "changePercent": -0.15,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TATACONSUM.NS",
            "name": "Tata Consumer Products Ltd.",
            "icon": "🇮🇳",
            "price": 1120.0,
            "changePercent": 0.25,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TMCV.NS",
            "name": "Tata Motors Ltd.",
            "icon": "🇮🇳",
            "price": 982.1,
            "changePercent": 0.8,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TCS.NS",
            "name": "Tata Consultancy Services Ltd.",
            "icon": "🇮🇳",
            "price": 2506.9,
            "changePercent": 0.45,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TATASTEEL.NS",
            "name": "Tata Steel Ltd.",
            "icon": "🇮🇳",
            "price": 155.0,
            "changePercent": 0.6,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TECHM.NS",
            "name": "Tech Mahindra Ltd.",
            "icon": "🇮🇳",
            "price": 1680.0,
            "changePercent": -0.3,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TITAN.NS",
            "name": "Titan Company Ltd.",
            "icon": "🇮🇳",
            "price": 3400.0,
            "changePercent": 0.4,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "TRENT.NS",
            "name": "Trent Ltd.",
            "icon": "🇮🇳",
            "price": 7650.0,
            "changePercent": 1.25,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ULTRACEMCO.NS",
            "name": "UltraTech Cement Ltd.",
            "icon": "🇮🇳",
            "price": 11200.0,
            "changePercent": 0.7,
            "precision": 2,
            "currency": "₹"
      }
],
      'banknifty': [
      {
            "symbol": "AUBANK.NS",
            "name": "AU Small Finance Bank Ltd.",
            "icon": "🏦",
            "price": 625.0,
            "changePercent": -0.53,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "AXISBANK.NS",
            "name": "Axis Bank Ltd.",
            "icon": "🏦",
            "price": 1180.0,
            "changePercent": -0.31,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "BANKBARODA.NS",
            "name": "Bank of Baroda",
            "icon": "🏦",
            "price": 250.0,
            "changePercent": 0.45,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "CANBK.NS",
            "name": "Canara Bank",
            "icon": "🏦",
            "price": 105.0,
            "changePercent": 0.3,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "FEDERALBNK.NS",
            "name": "Federal Bank Ltd.",
            "icon": "🏦",
            "price": 195.0,
            "changePercent": 0.6,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "HDFCBANK.NS",
            "name": "HDFC Bank Ltd.",
            "icon": "🏦",
            "price": 1685.2,
            "changePercent": 0.28,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "ICICIBANK.NS",
            "name": "ICICI Bank Ltd.",
            "icon": "🏦",
            "price": 1245.8,
            "changePercent": 0.45,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "IDFCFIRSTB.NS",
            "name": "IDFC First Bank Ltd.",
            "icon": "🏦",
            "price": 72.0,
            "changePercent": 0.15,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "INDUSINDBK.NS",
            "name": "IndusInd Bank Ltd.",
            "icon": "🏦",
            "price": 850.5,
            "changePercent": -0.8,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "KOTAKBANK.NS",
            "name": "Kotak Mahindra Bank Ltd.",
            "icon": "🏦",
            "price": 1780.0,
            "changePercent": -0.12,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "PNB.NS",
            "name": "Punjab National Bank",
            "icon": "🏦",
            "price": 102.0,
            "changePercent": 0.4,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "SBIN.NS",
            "name": "State Bank of India",
            "icon": "🏦",
            "price": 812.3,
            "changePercent": 0.35,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "UNIONBANK.NS",
            "name": "Union Bank of India",
            "icon": "🏦",
            "price": 118.0,
            "changePercent": -0.12,
            "precision": 2,
            "currency": "₹"
      },
      {
            "symbol": "YESBANK.NS",
            "name": "Yes Bank Ltd.",
            "icon": "🏦",
            "price": 21.5,
            "changePercent": 0.27,
            "precision": 2,
            "currency": "₹"
      }
]
    };

    // Active Watchlist Selection (Custom Watchlist is default first)
    this.activeWatchlistKey = localStorage.getItem('tradeview_active_watchlist') || 'custom';

    // Default Custom Watchlist (Top Indian Market Equities & Indices)
    const defaultCustomWatchlist = [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', icon: '🇮🇳', price: 1184.50, changePercent: 0.85, precision: 2, currency: '₹' },
      { symbol: 'TCS', name: 'Tata Consultancy Services', icon: '🇮🇳', price: 2506.90, changePercent: 1.25, precision: 2, currency: '₹' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', icon: '🏦', price: 1685.20, changePercent: 0.35, precision: 2, currency: '₹' },
      { symbol: 'INFY', name: 'Infosys Ltd.', icon: '🇮🇳', price: 1820.40, changePercent: -0.40, precision: 2, currency: '₹' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', icon: '🏦', price: 1245.80, changePercent: 0.70, precision: 2, currency: '₹' },
      { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', icon: '🚗', price: 982.10, changePercent: 1.45, precision: 2, currency: '₹' },
      { symbol: 'SBIN', name: 'State Bank of India', icon: '🏦', price: 812.30, changePercent: -0.20, precision: 2, currency: '₹' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', icon: '📡', price: 1680.00, changePercent: 0.90, precision: 2, currency: '₹' },
      { symbol: 'ITC', name: 'ITC Ltd.', icon: '📦', price: 472.50, changePercent: 0.15, precision: 2, currency: '₹' },
      { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', icon: '🏦', price: 850.50, changePercent: -1.20, precision: 2, currency: '₹' },
      { symbol: 'ZOMATO', name: 'Zomato Ltd.', icon: '🍽️', price: 265.50, changePercent: 2.10, precision: 2, currency: '₹' },
      { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', icon: '✈️', price: 4350.00, changePercent: 1.10, precision: 2, currency: '₹' },
      { symbol: 'NIFTY50', name: 'NIFTY 50 Index', icon: '📊', price: 22687.65, changePercent: 0.65, precision: 2, currency: '₹' },
      { symbol: 'BANKNIFTY', name: 'NIFTY Bank Index', icon: '📈', price: 48520.10, changePercent: 0.80, precision: 2, currency: '₹' }
    ];

    // Load custom saved watchlist from localStorage if present
    const saved = localStorage.getItem('tradeview_user_watchlist');
    this.watchlistData = saved ? JSON.parse(saved) : defaultCustomWatchlist;

    // Sanitize any previous erroneous price values in stored watchlist
    const accurateFixes = {
      'INDUSINDBK': 850.50,
      'ZOMATO': 265.50,
      'HAL': 4350.00,
      'RELIANCE': 1184.50,
      'TCS': 2506.90,
      'HDFCBANK': 1685.20,
      'INFY': 1820.40,
      'ICICIBANK': 1245.80,
      'TATAMOTORS': 982.10,
      'SBIN': 812.30
    };
    this.watchlistData.forEach(item => {
      if (accurateFixes[item.symbol] && Math.abs(item.price - accurateFixes[item.symbol]) > accurateFixes[item.symbol] * 0.5) {
        item.price = accurateFixes[item.symbol];
      }
    });

    this.alerts = [];
    this.prevPrices = new Map();

    // Technicals Scanner Universe & Signal Categories
    this.selectedTechSignal = 'BUY'; // Default filter
    this.technicalStocks = {
      'BUY': [
        { symbol: 'RELIANCE', name: 'Reliance Industries', price: 1184.50, change: 1.85, rsi: 64.2, signalText: 'EMA20 Bullish Cross • Heavy Volume', icon: '🇮🇳' },
        { symbol: 'TCS', name: 'Tata Consultancy Services', price: 2506.90, change: 1.25, rsi: 61.5, signalText: 'Golden Cross (50/200 EMA) • Trend Buy', icon: '🇮🇳' },
        { symbol: 'INFY', name: 'Infosys Ltd.', price: 1820.40, change: 0.85, rsi: 59.8, signalText: 'Breakout above 200 SMA • MACD Bullish', icon: '🇮🇳' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', price: 1685.20, change: 0.95, rsi: 58.0, signalText: 'Bullish Engulfing • Support Confirmed', icon: '🏦' },
        { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', price: 982.10, change: 2.10, rsi: 68.4, signalText: 'Supertrend Green • Multi-Month Highs', icon: '🚗' },
        { symbol: 'HAL', name: 'Hindustan Aeronautics', price: 4350.00, change: 1.65, rsi: 65.0, signalText: 'Momentum Breakout • All-Time High', icon: '✈️' },
        { symbol: 'BEL', name: 'Bharat Electronics Ltd.', price: 290.00, change: 1.40, rsi: 63.1, signalText: 'Defense Momentum • Higher Highs & Lows', icon: '🛡️' },
        { symbol: 'ZOMATO', name: 'Zomato Ltd.', price: 265.50, change: 2.45, rsi: 67.2, signalText: 'Growth Breakout • Heavy Delivery Volume', icon: '🍽️' },
        { symbol: 'NIFTY50', name: 'NIFTY 50 Index', price: 22687.65, change: 0.75, rsi: 60.5, signalText: 'Index Pullback Support • Trend Continues', icon: '📊' },
        { symbol: 'BANKNIFTY', name: 'NIFTY Bank Index', price: 48520.10, change: 0.90, rsi: 59.2, signalText: 'Sector Rotation Buy • Banking Index', icon: '📈' }
      ],
      'SELL': [
        { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', price: 850.50, change: -2.35, rsi: 34.1, signalText: 'Death Cross (50/200) • Support Breakdown', icon: '🏦' },
        { symbol: 'PAYTM', name: 'One97 Communications', price: 720.00, change: -1.80, rsi: 38.5, signalText: 'Head & Shoulders Breakdown • Bearish Volume', icon: '📱' },
        { symbol: 'WIPRO', name: 'Wipro Ltd.', price: 540.00, change: -1.15, rsi: 41.2, signalText: 'Below 200 SMA • Weak Sector Relative Strength', icon: '🇮🇳' },
        { symbol: 'UPL', name: 'UPL Ltd.', price: 560.00, change: -2.10, rsi: 32.8, signalText: 'Descending Channel • MACD Bearish Crossover', icon: '🧪' },
        { symbol: 'BANDHANBNK', name: 'Bandhan Bank Ltd.', price: 185.00, change: -1.90, rsi: 36.4, signalText: 'Key Support Broken • Bearish Continuation', icon: '🏦' },
        { symbol: 'ZEEL', name: 'Zee Entertainment', price: 125.00, change: -3.20, rsi: 29.5, signalText: 'Distribution Pattern • Multi-Year Lows', icon: '📺' }
      ],
      'NEUTRAL': [
        { symbol: 'ITC', name: 'ITC Ltd.', price: 472.50, change: 0.15, rsi: 50.8, signalText: 'Sideways Range ₹465-₹480 • Flat Bollinger Bands', icon: '📦' },
        { symbol: 'SBIN', name: 'State Bank of India', price: 812.30, change: -0.20, rsi: 48.6, signalText: 'Consolidation at Moving Average Support', icon: '🏦' },
        { symbol: 'MARUTI', name: 'Maruti Suzuki India', price: 12400.00, change: 0.30, rsi: 52.1, signalText: 'Symmetrical Triangle • Awaiting Breakout', icon: '🚘' },
        { symbol: 'LT', name: 'Larsen & Toubro Ltd.', price: 3540.00, change: -0.10, rsi: 51.4, signalText: 'Rangebound Accumulation • Neutral RSI', icon: '🏗️' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', price: 1680.00, change: 0.40, rsi: 53.0, signalText: 'Doji Star Pattern • Neutral Session', icon: '📡' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', price: 1245.80, change: 0.25, rsi: 51.9, signalText: 'Narrow Price Band • Consolidation Phase', icon: '🏦' }
      ]
    };

    this.initDOM();
    this.setWatchlist(this.activeWatchlistKey);
    this.renderTechnicalsStockList();
    this.startLivePolling();
  }

  saveWatchlist() {
    try {
      localStorage.setItem('tradeview_user_watchlist', JSON.stringify(this.watchlistData));
    } catch (e) {}
  }

  getActiveWatchlist() {
    if (this.activeWatchlistKey === 'indices') {
      return this.presetWatchlists.indices;
    } else if (this.activeWatchlistKey === 'nifty50') {
      return this.presetWatchlists.nifty50;
    } else if (this.activeWatchlistKey === 'banknifty') {
      return this.presetWatchlists.banknifty;
    }
    return this.watchlistData; // Custom Watchlist (default)
  }

  initDOM() {
    this.container.innerHTML = `
      <!-- Sidebar Header Tabs -->
      <div class="flex items-center justify-between border-b border-[#2a2e39] bg-[#1e222d] px-2 h-9">
        <div class="flex items-center space-x-1 text-xs">
          <!-- Watchlist Tab with Dropdown Trigger -->
          <div class="relative" id="watchlist-dropdown-wrapper">
            <button id="btn-watchlist-tab" class="px-2 py-1 rounded font-medium text-[#2962ff] bg-[rgba(41,98,255,0.12)] tab-btn flex items-center space-x-1" data-tab="watchlist" title="Click to view Watchlists">
              <span id="watchlist-tab-label">Watchlist</span>
              <i data-lucide="chevron-down" class="w-3 h-3 text-[#2962ff] transition-transform" id="watchlist-tab-chevron"></i>
            </button>

            <!-- Watchlist Preset Dropdown Menu -->
            <div id="watchlist-preset-menu" class="hidden absolute left-0 top-full mt-1.5 w-52 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-2xl py-1 z-50 divide-y divide-[#2a2e39]/60">
              <div class="px-3 py-1 text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Select Watchlist</div>
              <div class="py-1">
                <!-- 1. Custom Watchlist (Default on list first) -->
                <button class="watchlist-menu-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#2a2e39] text-[#d1d4dc] transition" data-watchlist="custom">
                  <div class="flex items-center space-x-2">
                    <span class="text-amber-400">⭐</span>
                    <span class="font-bold">Custom Watchlist</span>
                  </div>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-[#131722] text-[#787b86] font-mono border border-[#2a2e39]">Default</span>
                </button>

                <!-- 2. Indices -->
                <button class="watchlist-menu-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#2a2e39] text-[#d1d4dc] transition" data-watchlist="indices">
                  <div class="flex items-center space-x-2">
                    <span class="text-[#2962ff]">📊</span>
                    <span class="font-bold">Indices</span>
                  </div>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-[#131722] text-[#787b86] font-mono border border-[#2a2e39]">6</span>
                </button>

                <!-- 3. Nifty 50 -->
                <button class="watchlist-menu-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#2a2e39] text-[#d1d4dc] transition" data-watchlist="nifty50">
                  <div class="flex items-center space-x-2">
                    <span class="text-emerald-400">🇮🇳</span>
                    <span class="font-bold">Nifty 50</span>
                  </div>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-[#131722] text-[#787b86] font-mono border border-[#2a2e39]">50</span>
                </button>

                <!-- 4. Bank Nifty -->
                <button class="watchlist-menu-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#2a2e39] text-[#d1d4dc] transition" data-watchlist="banknifty">
                  <div class="flex items-center space-x-2">
                    <span class="text-cyan-400">🏦</span>
                    <span class="font-bold">Bank Nifty</span>
                  </div>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-[#131722] text-[#787b86] font-mono border border-[#2a2e39]">14</span>
                </button>
              </div>
            </div>
          </div>

          <button class="px-2.5 py-1 rounded font-medium text-[#787b86] hover:text-[#d1d4dc] tab-btn" data-tab="depth">Depth (DOM)</button>
          <button class="px-2.5 py-1 rounded font-medium text-[#787b86] hover:text-[#d1d4dc] tab-btn" data-tab="technicals">Technicals</button>
          <button class="px-2.5 py-1 rounded font-medium text-[#787b86] hover:text-[#d1d4dc] tab-btn" data-tab="alerts">Alerts</button>
        </div>
        <button id="btn-toggle-sidebar" class="text-[#787b86] hover:text-[#d1d4dc] p-1 rounded" title="Collapse Sidebar">
          <i data-lucide="chevrons-right" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="sidebar-tab-content" class="flex-1 overflow-y-auto">
        <!-- Watchlist Tab -->
        <div id="tab-pane-watchlist" class="p-1 space-y-1">
          <!-- Active Watchlist Banner & Quick Selector -->
          <div class="flex items-center justify-between px-2 py-1.5 bg-[#181b24] rounded border border-[#2a2e39]">
            <div class="flex items-center space-x-1.5 overflow-hidden">
              <span id="active-watchlist-icon" class="text-xs">⭐</span>
              <span id="active-watchlist-name" class="font-bold text-xs text-white truncate">Custom Watchlist</span>
              <span id="active-watchlist-count" class="text-[10px] text-[#787b86] font-mono"></span>
            </div>
            <select id="select-watchlist-inline" class="bg-[#131722] text-[11px] font-semibold text-[#2962ff] px-1.5 py-0.5 rounded border border-[#2a2e39] focus:outline-none cursor-pointer shrink-0 ml-1">
              <option value="custom">⭐ Custom</option>
              <option value="indices">📊 Indices</option>
              <option value="nifty50">🇮🇳 Nifty 50</option>
              <option value="banknifty">🏦 Bank Nifty</option>
            </select>
          </div>

          <!-- Add Stock Input Bar (Active on Custom Watchlist) -->
          <div id="watchlist-add-bar" class="p-1.5 bg-[#131722] rounded border border-[#2a2e39] flex items-center space-x-1.5">
            <input id="input-add-watchlist" type="text" placeholder="+ Add Indian stock (e.g. ZOMATO, HAL)..." class="flex-1 bg-transparent text-xs text-[#d1d4dc] focus:outline-none placeholder-[#787b86] uppercase font-semibold px-1">
            <button id="btn-add-watchlist" class="px-2.5 py-0.5 bg-[#2962ff] hover:bg-[#1e53e5] text-white rounded text-xs font-semibold">Add</button>
          </div>

          <div class="px-2 py-1 flex items-center justify-between text-[10px] text-[#787b86] font-semibold uppercase tracking-wider border-b border-[#2a2e39]">
            <span>Symbol / Company</span>
            <div class="flex space-x-6">
              <span>Price (₹)</span>
              <span>Chg%</span>
            </div>
          </div>
          <div id="watchlist-items-list" class="divide-y divide-[rgba(42,46,57,0.3)]"></div>
        </div>

        <!-- Order Book Depth Tab (Dynamically bound to Active Chart Symbol) -->
        <div id="tab-pane-depth" class="hidden p-2 text-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-semibold text-[#787b86] uppercase" id="depth-symbol-title">Order Book - RELIANCE</span>
            <span class="text-[10px] bg-[#2962ff] text-white px-1.5 py-0.2 rounded font-semibold">LIVE</span>
          </div>
          <div class="flex justify-between px-2.5 py-1 text-[10px] font-bold text-[#787b86] uppercase border-b border-[#2a2e39] mb-1">
            <span>Price</span>
            <span>Size (Orders)</span>
          </div>
          <div class="space-y-1 mb-2 font-mono" id="depth-asks-list"></div>
          <div class="py-1 px-2 my-1.5 text-center font-bold bg-[#131722] rounded flex justify-between items-center border border-[#2a2e39]" id="depth-spread-bar">
            <span class="text-[11px] text-[#787b86]" id="depth-spread-text">Spread: ₹0.50</span>
            <span class="text-sm font-semibold text-[#00e676]" id="depth-mid-price">₹1,184.50</span>
          </div>
          <div class="space-y-1 font-mono" id="depth-bids-list"></div>
          
          <!-- Buyer / Seller Power Ratio Bar -->
          <div class="mt-3 pt-2 border-t border-[#2a2e39]" id="depth-ratio-container">
            <div class="flex justify-between text-[10px] font-bold mb-1">
              <span class="text-[#00e676]" id="depth-total-bids-label">Total Bids: 52%</span>
              <span class="text-[#ff5252]" id="depth-total-asks-label">Total Asks: 48%</span>
            </div>
            <div class="w-full h-2 rounded bg-[#131722] overflow-hidden flex border border-[#2a2e39]">
              <div id="depth-bid-ratio-fill" class="h-full bg-[#00e676] transition-all duration-300" style="width: 52%"></div>
              <div id="depth-ask-ratio-fill" class="h-full bg-[#ff5252] transition-all duration-300" style="width: 48%"></div>
            </div>
          </div>
        </div>

        <!-- Technicals Scanner & Signals Tab -->
        <div id="tab-pane-technicals" class="hidden p-3 text-xs space-y-3">
          <div class="text-center">
            <div class="text-[11px] text-[#787b86] uppercase font-bold tracking-wider">Indian Stocks Technical Scanner</div>
            <div class="text-xs text-[#787b86] mt-0.5">Click <span class="text-[#f23645] font-bold">SELL</span>, <span class="text-[#787b86] font-bold">NEUTRAL</span>, or <span class="text-[#089981] font-bold">BUY</span> to view & add stocks to Watchlist</div>
          </div>

          <!-- Interactive Signal Filter Cards (Sell, Neutral, Buy) -->
          <div class="grid grid-cols-3 gap-1.5 text-center pt-1">
            <div id="card-signal-sell" class="tech-signal-card" data-signal="SELL" title="Click to filter Bearish SELL stocks">
              <div class="text-[#f23645] font-extrabold text-base" id="tech-count-sell">6</div>
              <div class="text-[10px] font-bold text-[#f23645] mt-0.5">SELL</div>
            </div>
            <div id="card-signal-neutral" class="tech-signal-card" data-signal="NEUTRAL" title="Click to filter NEUTRAL consolidation stocks">
              <div class="text-[#d1d4dc] font-extrabold text-base" id="tech-count-neutral">6</div>
              <div class="text-[10px] font-bold text-[#787b86] mt-0.5">NEUTRAL</div>
            </div>
            <div id="card-signal-buy" class="tech-signal-card active-buy" data-signal="BUY" title="Click to filter Bullish BUY stocks">
              <div class="text-[#089981] font-extrabold text-base" id="tech-count-buy">10</div>
              <div class="text-[10px] font-bold text-[#089981] mt-0.5">BUY</div>
            </div>
          </div>

          <!-- Stock List Filtered by Signal -->
          <div class="pt-1">
            <div class="flex items-center justify-between text-[10px] text-[#787b86] font-semibold uppercase tracking-wider border-b border-[#2a2e39] pb-1 mb-1">
              <span id="tech-filter-title">BUY Stocks (10)</span>
              <span>1-Click Add & Highlight</span>
            </div>
            <div id="tech-stocks-container" class="space-y-1 max-h-56 overflow-y-auto divide-y divide-[rgba(42,46,57,0.3)] pr-0.5"></div>
          </div>

          <!-- Technical Indicators Reference Breakdown -->
          <div class="space-y-1.5 pt-2 border-t border-[#2a2e39] text-[11px]">
            <div class="text-[10px] text-[#787b86] font-semibold uppercase">Active Chart Indicators</div>
            <div class="flex justify-between">
              <span class="text-[#787b86]">RSI (14)</span>
              <span class="font-medium text-[#d1d4dc]" id="tech-val-rsi">58.4 (Neutral)</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#787b86]">MACD (12, 26)</span>
              <span class="font-medium text-[#089981]" id="tech-val-macd">Bullish Crossover</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#787b86]">EMA (20 / 50)</span>
              <span class="font-medium text-[#089981]" id="tech-val-ema">Above 20 EMA</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[#787b86]">SMA (200)</span>
              <span class="font-medium text-[#089981]" id="tech-val-sma">Long-Term Uptrend</span>
            </div>
          </div>
        </div>

        <!-- Price Alerts Tab -->
        <div id="tab-pane-alerts" class="hidden p-3 text-xs space-y-3">
          <div class="text-[11px] font-semibold text-[#787b86] uppercase">Create Price Alert</div>
          <div class="space-y-2">
            <input id="alert-price-input" type="number" step="any" placeholder="Target Price (₹)" class="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1.5 text-xs text-[#d1d4dc] focus:outline-none focus:border-[#2962ff]">
            <button id="btn-create-alert" class="w-full bg-[#2962ff] hover:bg-[#1e53e5] text-white py-1.5 rounded font-medium transition text-xs">Set Alert</button>
          </div>
          <div class="border-t border-[#2a2e39] pt-2">
            <div class="text-[11px] text-[#787b86] mb-2 font-medium">Active Alerts</div>
            <div id="alerts-list" class="space-y-1.5 text-xs">
              <div class="text-[#787b86] text-center py-2">No active alerts</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    if (window.lucide) window.lucide.createIcons();
  }

  setWatchlist(key) {
    this.activeWatchlistKey = key;
    try {
      localStorage.setItem('tradeview_active_watchlist', key);
    } catch (e) {}

    const titleMap = {
      'custom': { name: 'Custom Watchlist', icon: '⭐', label: 'Watchlist' },
      'indices': { name: 'Indices', icon: '📊', label: 'Indices' },
      'nifty50': { name: 'Nifty 50', icon: '🇮🇳', label: 'Nifty 50' },
      'banknifty': { name: 'Bank Nifty', icon: '🏦', label: 'Bank Nifty' }
    };
    const info = titleMap[key] || titleMap['custom'];

    const tabLabel = this.container.querySelector('#watchlist-tab-label');
    if (tabLabel) tabLabel.textContent = info.label;

    const activeTitle = this.container.querySelector('#active-watchlist-name');
    if (activeTitle) activeTitle.textContent = info.name;

    const activeIcon = this.container.querySelector('#active-watchlist-icon');
    if (activeIcon) activeIcon.textContent = info.icon;

    const inlineSelect = this.container.querySelector('#select-watchlist-inline');
    if (inlineSelect) inlineSelect.value = key;

    const addBar = this.container.querySelector('#watchlist-add-bar');
    if (addBar) {
      if (key === 'custom') {
        addBar.classList.remove('hidden');
      } else {
        addBar.classList.add('hidden');
      }
    }

    this.renderWatchlist();
  }

  addToCustomWatchlist(item) {
    if (!item || !item.symbol) return;
    const exists = this.watchlistData.some(s => s.symbol === item.symbol);
    if (!exists) {
      this.watchlistData.unshift({
        symbol: item.symbol,
        name: item.name || item.symbol,
        icon: item.icon || '🇮🇳',
        price: item.price || 500.0,
        changePercent: item.changePercent || 0.0,
        precision: 2,
        currency: item.currency || '₹'
      });
      this.saveWatchlist();
      if (window.app) {
        window.app.showToast(`⭐ Added ${item.symbol} to Custom Watchlist!`);
      }
    } else {
      if (window.app) {
        window.app.showToast(`${item.symbol} already in Custom Watchlist`);
      }
    }
  }

  updatePrice(symbol, price, changePercent = null) {
    if (!symbol || typeof price !== 'number' || isNaN(price)) return;
    const cleanSym = symbol.toUpperCase().trim();
    const baseSym = cleanSym.replace('.NS', '').replace('.BO', '');

    const updateInList = (list) => {
      if (!Array.isArray(list)) return false;
      let found = false;
      for (const item of list) {
        if (!item || !item.symbol) continue;
        const s = item.symbol.toUpperCase();
        if (s === cleanSym || s === baseSym || s.replace('.NS', '') === baseSym) {
          item.price = parseFloat(price.toFixed(item.precision || 2));
          if (changePercent !== null && typeof changePercent === 'number' && !isNaN(changePercent)) {
            item.changePercent = parseFloat(changePercent.toFixed(2));
          }
          found = true;
        }
      }
      return found;
    };

    updateInList(this.watchlistData);
    if (this.presetWatchlists) {
      updateInList(this.presetWatchlists.indices);
      updateInList(this.presetWatchlists.nifty50);
      updateInList(this.presetWatchlists.banknifty);
    }

    // Direct DOM update for visible rows matching this symbol (instant, no flicker, no scroll reset)
    const listEl = this.container.querySelector('#watchlist-items-list');
    if (listEl) {
      const rows = listEl.querySelectorAll('.watchlist-row');
      rows.forEach(row => {
        const rowSym = (row.dataset.symbol || '').toUpperCase();
        if (rowSym === cleanSym || rowSym === baseSym || rowSym.replace('.NS', '') === baseSym) {
          const priceEl = row.querySelector('.font-mono');
          const chgEl = priceEl ? priceEl.nextElementSibling : null;
          const curr = '₹';
          
          if (priceEl) {
            const prev = this.prevPrices.get(rowSym);
            let flashClass = '';
            if (prev !== undefined && price !== prev) {
              flashClass = price > prev ? 'flash-up' : 'flash-down';
              priceEl.classList.remove('flash-up', 'flash-down');
              void priceEl.offsetWidth;
              priceEl.classList.add(flashClass);
            }
            this.prevPrices.set(rowSym, price);
            priceEl.textContent = curr + price.toFixed(2);
          }

          if (chgEl && changePercent !== null && typeof changePercent === 'number' && !isNaN(changePercent)) {
            const isBull = changePercent >= 0;
            chgEl.className = 'text-[10px] font-semibold ' + (isBull ? 'text-[#089981]' : 'text-[#f23645]');
            chgEl.textContent = (isBull ? '+' : '') + changePercent.toFixed(2) + '%';
          }
        }
      });
    }
  }

  syncPricesWithActiveCharts() {
    if (!window.multiChartGrid || !Array.isArray(window.multiChartGrid.charts)) return;
    window.multiChartGrid.charts.forEach(chart => {
      if (chart && chart.symbol && chart.candles && chart.candles.length > 0) {
        const last = chart.candles[chart.candles.length - 1];
        if (last && typeof last.close === 'number') {
          const chg = last.close - last.open;
          const chgPct = last.open ? ((chg / last.open) * 100) : 0;
          this.updatePrice(chart.symbol, last.close, chgPct);
        }
      }
    });
  }

  bindEvents() {
    const menuDropdown = this.container.querySelector('#watchlist-preset-menu');
    const tabBtn = this.container.querySelector('#btn-watchlist-tab');
    const chevron = this.container.querySelector('#watchlist-tab-chevron');

    // Watchlist Tab button click: Switch tab & Toggle dropdown
    tabBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentTab !== 'watchlist') {
        this.switchTab('watchlist');
      } else {
        menuDropdown?.classList.toggle('hidden');
      }
    });

    // Preset dropdown options click
    this.container.querySelectorAll('.watchlist-menu-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.watchlist;
        this.setWatchlist(key);
        menuDropdown?.classList.add('hidden');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.querySelector('#watchlist-dropdown-wrapper')?.contains(e.target)) {
        menuDropdown?.classList.add('hidden');
      }
    });

    // Inline select change
    const inlineSelect = this.container.querySelector('#select-watchlist-inline');
    inlineSelect?.addEventListener('change', (e) => {
      this.setWatchlist(e.target.value);
    });

    // Tab switching for other tabs
    const otherTabs = this.container.querySelectorAll('.tab-btn:not(#btn-watchlist-tab)');
    otherTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        menuDropdown?.classList.add('hidden');
        this.switchTab(btn.dataset.tab);
      });
    });

    // Add Stock input
    const addInput = this.container.querySelector('#input-add-watchlist');
    const addBtn = this.container.querySelector('#btn-add-watchlist');

    const handleAdd = async () => {
      const sym = addInput.value.trim().toUpperCase();
      if (!sym) return;
      if (this.watchlistData.some(item => item.symbol === sym)) {
        addInput.value = '';
        return;
      }

      // Add with estimated or fetched quote
      let price = 500.0;
      try {
        const qResp = await fetch(`/api/quote?symbol=${encodeURIComponent(sym)}`);
        const qData = await qResp.json();
        if (qData && qData.price) price = qData.price;
      } catch (e) {}

      this.watchlistData.unshift({
        symbol: sym,
        name: sym,
        icon: '🇮🇳',
        price: price,
        changePercent: 0.00,
        precision: 2,
        currency: '₹'
      });

      this.saveWatchlist();
      this.renderWatchlist();
      addInput.value = '';
    };

    addBtn?.addEventListener('click', handleAdd);
    addInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    });

    // Collapse Sidebar
    const toggleBtn = this.container.querySelector('#btn-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.collapseSidebar());
    }

    // Bind Technical Signal Cards (Sell, Neutral, Buy)
    ['sell', 'neutral', 'buy'].forEach(sig => {
      const card = this.container.querySelector(`#card-signal-${sig}`);
      if (card) {
        card.addEventListener('click', () => {
          this.container.querySelectorAll('.tech-signal-card').forEach(c => {
            c.classList.remove('active-sell', 'active-neutral', 'active-buy');
          });
          card.classList.add(`active-${sig}`);
          this.selectedTechSignal = sig.toUpperCase();
          this.renderTechnicalsStockList();
        });
      }
    });
  }

  collapseSidebar() {
    this.container.classList.add('collapsed');
    const restoreTab = document.getElementById('sidebar-restore-tab');
    if (restoreTab) restoreTab.classList.remove('hidden');

    setTimeout(() => {
      if (window.multiChartGrid) {
        window.multiChartGrid.charts.forEach(c => c.resize());
      }
    }, 220);
  }

  restoreSidebar() {
    this.container.classList.remove('collapsed');
    const restoreTab = document.getElementById('sidebar-restore-tab');
    if (restoreTab) restoreTab.classList.add('hidden');

    setTimeout(() => {
      if (window.multiChartGrid) {
        window.multiChartGrid.charts.forEach(c => c.resize());
      }
    }, 220);
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    ['watchlist', 'depth', 'technicals', 'alerts'].forEach(t => {
      const pane = this.container.querySelector(`#tab-pane-${t}`);
      if (pane) {
        if (t === tabName) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
    });

    // Update tab button active states
    this.container.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.tab === tabName) {
        b.className = 'px-2.5 py-1 rounded font-medium text-[#2962ff] bg-[rgba(41,98,255,0.12)] tab-btn';
      } else {
        b.className = 'px-2.5 py-1 rounded font-medium text-[#787b86] hover:text-[#d1d4dc] tab-btn';
      }
    });

    if (tabName === 'depth') {
      this.renderDepth();
    } else if (tabName === 'technicals') {
      this.renderTechnicalsStockList();
    }
  }

  renderWatchlist() {
    const listEl = this.container.querySelector('#watchlist-items-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const activeSymbol = window.multiChartGrid?.activeChart?.symbol || '';
    const currentList = this.getActiveWatchlist();

    const countEl = this.container.querySelector('#active-watchlist-count');
    if (countEl) {
      countEl.textContent = `(${currentList.length} items)`;
    }

    const isCustom = this.activeWatchlistKey === 'custom';

    currentList.forEach((item, index) => {
      const row = document.createElement('div');
      const isSelected = item.symbol === activeSymbol;

      // Highlight according to technical signal
      let highlightClass = '';
      let signalBadge = '';
      if (item.signal === 'BUY') {
        highlightClass = 'highlight-buy';
        signalBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[rgba(8,153,129,0.2)] text-[#089981] border border-[#089981] ml-1">BUY</span>`;
      } else if (item.signal === 'SELL') {
        highlightClass = 'highlight-sell';
        signalBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[rgba(242,54,69,0.2)] text-[#f23645] border border-[#f23645] ml-1">SELL</span>`;
      } else if (item.signal === 'NEUTRAL') {
        highlightClass = 'highlight-neutral';
        signalBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[rgba(120,123,134,0.2)] text-[#787b86] border border-[#787b86] ml-1">NEUTRAL</span>`;
      }

      row.className = `watchlist-row group ${isSelected ? 'selected' : ''} ${highlightClass}`;
      row.dataset.symbol = item.symbol;

      const isBull = item.changePercent >= 0;
      const prev = this.prevPrices.get(item.symbol);
      let flashClass = '';
      if (prev !== undefined && item.price !== prev) {
        flashClass = item.price > prev ? 'flash-up' : 'flash-down';
      }
      this.prevPrices.set(item.symbol, item.price);

      const curr = item.currency || '₹';

      row.innerHTML = `
        <div class="flex items-center space-x-2 flex-1 overflow-hidden">
          <span class="text-xs shrink-0">${item.icon || '🇮🇳'}</span>
          <div class="overflow-hidden">
            <div class="flex items-center space-x-1">
              <span class="font-bold text-xs text-[#d1d4dc] truncate">${item.symbol}</span>
              ${signalBadge}
            </div>
            <div class="text-[10px] text-[#787b86] truncate max-w-[125px]">${item.name || item.symbol}</div>
          </div>
        </div>
        <div class="flex items-center space-x-1.5">
          <div class="text-right">
            <div class="font-mono text-xs font-semibold ${flashClass} px-1 rounded">${curr}${item.price.toFixed(item.precision || 2)}</div>
            <div class="text-[10px] font-semibold ${isBull ? 'text-[#089981]' : 'text-[#f23645]'}">
              ${isBull ? '+' : ''}${item.changePercent.toFixed(2)}%
            </div>
          </div>
          ${isCustom ? `
            <button class="delete-stock-btn text-[#787b86] hover:text-[#f23645] p-1 text-sm opacity-0 group-hover:opacity-100 transition" title="Remove from Custom Watchlist">
              &times;
            </button>
          ` : `
            <button class="add-to-custom-btn text-[#787b86] hover:text-amber-400 p-1 text-xs opacity-0 group-hover:opacity-100 transition" title="Save to Custom Watchlist">
              ⭐
            </button>
          `}
        </div>
      `;

      // Click row to load symbol into active chart
      row.addEventListener('click', (e) => {
        if (e.target.closest('.delete-stock-btn') || e.target.closest('.add-to-custom-btn')) return;
        if (window.multiChartGrid) {
          window.multiChartGrid.changeSymbol(item.symbol);
          this.renderWatchlist();
          this.renderDepth();
        }
      });

      if (isCustom) {
        row.querySelector('.delete-stock-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.watchlistData.splice(index, 1);
          this.saveWatchlist();
          this.renderWatchlist();
          this.renderTechnicalsStockList();
        });
      } else {
        row.querySelector('.add-to-custom-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.addToCustomWatchlist(item);
        });
      }

      listEl.appendChild(row);
    });

    this.syncPricesWithActiveCharts();
  }

  renderTechnicalsStockList() {
    const container = this.container.querySelector('#tech-stocks-container');
    const titleEl = this.container.querySelector('#tech-filter-title');
    if (!container) return;

    const signal = this.selectedTechSignal || 'BUY';
    const stocks = this.technicalStocks[signal] || [];

    if (titleEl) {
      const colorWord = signal === 'BUY' ? 'Bullish BUY' : (signal === 'SELL' ? 'Bearish SELL' : 'Neutral');
      titleEl.textContent = `${colorWord} Stocks (${stocks.length})`;
    }

    container.innerHTML = '';
    stocks.forEach(stock => {
      const row = document.createElement('div');
      row.className = 'py-2 px-1.5 hover:bg-[#202531] rounded cursor-pointer transition flex items-center justify-between group';

      const isBull = stock.change >= 0;
      row.innerHTML = `
        <div class="flex items-center space-x-2 flex-1 overflow-hidden pr-2">
          <span class="text-sm shrink-0">${stock.icon || '🇮🇳'}</span>
          <div class="overflow-hidden">
            <div class="flex items-center space-x-1">
              <span class="font-bold text-xs text-white">${stock.symbol}</span>
              <span class="text-[9px] font-bold px-1 rounded ${signal === 'BUY' ? 'bg-[#089981]/20 text-[#089981]' : (signal === 'SELL' ? 'bg-[#f23645]/20 text-[#f23645]' : 'bg-[#787b86]/20 text-[#787b86]')}">${signal}</span>
            </div>
            <div class="text-[10px] text-[#787b86] truncate">${stock.signalText}</div>
          </div>
        </div>
        <div class="text-right shrink-0 flex items-center space-x-2">
          <div>
            <div class="font-mono text-xs font-semibold text-white">₹${stock.price.toFixed(2)}</div>
            <div class="text-[10px] font-semibold ${isBull ? 'text-[#089981]' : 'text-[#f23645]'}">${isBull ? '+' : ''}${stock.change.toFixed(2)}%</div>
          </div>
          <button class="btn-add-tech-stock px-1.5 py-0.5 rounded text-[10px] font-bold ${signal === 'BUY' ? 'bg-[#089981] hover:bg-[#067a68] text-white' : (signal === 'SELL' ? 'bg-[#f23645] hover:bg-[#c22b37] text-white' : 'bg-[#2962ff] hover:bg-[#1e53e5] text-white')} opacity-0 group-hover:opacity-100 transition shadow-sm" title="Click to load into chart & add to watchlist">
            + Add
          </button>
        </div>
      `;

      row.addEventListener('click', () => {
        this.addTechnicalStockToWatchlist(stock, signal);
      });

      container.appendChild(row);
    });
  }

  addTechnicalStockToWatchlist(stock, signal) {
    const exists = this.watchlistData.find(item => item.symbol === stock.symbol);
    if (!exists) {
      this.watchlistData.unshift({
        symbol: stock.symbol,
        name: stock.name,
        icon: stock.icon || '🇮🇳',
        price: stock.price,
        changePercent: stock.change,
        precision: 2,
        currency: '₹',
        signal: signal
      });
    } else {
      exists.signal = signal;
      this.watchlistData = [exists, ...this.watchlistData.filter(i => i.symbol !== stock.symbol)];
    }

    this.saveWatchlist();
    this.renderWatchlist();

    if (window.multiChartGrid) {
      window.multiChartGrid.changeSymbol(stock.symbol);
    }

    if (window.app) {
      const colorWord = signal === 'BUY' ? 'Green' : (signal === 'SELL' ? 'Red' : 'Neutral');
      window.app.showToast(`✓ Added ${stock.symbol} (${signal}) with ${colorWord} highlight to Watchlist!`);
    }

    this.renderTechnicalsStockList();
  }

  renderDepth() {
    const asksList = this.container.querySelector('#depth-asks-list');
    const bidsList = this.container.querySelector('#depth-bids-list');
    const midEl = this.container.querySelector('#depth-mid-price');
    const titleEl = this.container.querySelector('#depth-symbol-title');
    const spreadEl = this.container.querySelector('#depth-spread-text');
    if (!asksList || !bidsList) return;

    // Track active chart's symbol and latest candle price
    const activeChart = window.multiChartGrid?.activeChart;
    const activeSymbol = activeChart?.symbol || 'RELIANCE';
    const lastCandle = activeChart?.candles?.slice(-1)[0];
    const basePrice = lastCandle ? lastCandle.close : 1184.50;

    const isCrypto = activeSymbol.includes('USDT') || activeSymbol.includes('BTC');
    const curr = isCrypto ? '$' : '₹';

    if (titleEl) titleEl.textContent = `Order Book - ${activeSymbol}`;
    if (midEl) midEl.textContent = `${curr}${basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const tickSpread = basePrice > 10000 ? 5.0 : basePrice > 1000 ? 0.50 : 0.05;
    if (spreadEl) spreadEl.textContent = `Spread: ${curr}${tickSpread.toFixed(2)}`;

    asksList.innerHTML = '';
    bidsList.innerHTML = '';

    let totalAskQty = 0;
    let totalBidQty = 0;

    // Asks (Bright High-Visibility Red / Coral Histogram)
    for (let i = 5; i >= 1; i--) {
      const askP = (basePrice + (i * tickSpread)).toFixed(2);
      const qty = Math.floor(Math.random() * 850 + 50);
      totalAskQty += qty;
      const pct = Math.floor(Math.random() * 65 + 30);
      const el = document.createElement('div');
      el.className = 'relative flex justify-between px-2.5 py-1 text-[11px] rounded overflow-hidden my-0.5 bg-[#181b24]/50 border border-transparent hover:border-[#ff5252]/40 transition';
      el.innerHTML = `
        <div class="absolute inset-y-0 right-0 rounded" style="width: ${pct}%; background: linear-gradient(90deg, rgba(255, 82, 82, 0.22), rgba(255, 82, 82, 0.60)); border-left: 2.5px solid #ff5252; box-shadow: inset 0 0 8px rgba(255, 82, 82, 0.35);"></div>
        <span class="text-[#ff5252] z-10 font-bold tracking-tight">${curr}${askP}</span>
        <span class="text-[#f0f3fa] z-10 font-semibold">${qty.toLocaleString()}</span>
      `;
      asksList.appendChild(el);
    }

    // Bids (Bright High-Visibility Emerald / Mint Green Histogram)
    for (let i = 1; i <= 5; i++) {
      const bidP = (basePrice - (i * tickSpread)).toFixed(2);
      const qty = Math.floor(Math.random() * 850 + 50);
      totalBidQty += qty;
      const pct = Math.floor(Math.random() * 65 + 30);
      const el = document.createElement('div');
      el.className = 'relative flex justify-between px-2.5 py-1 text-[11px] rounded overflow-hidden my-0.5 bg-[#181b24]/50 border border-transparent hover:border-[#00e676]/40 transition';
      el.innerHTML = `
        <div class="absolute inset-y-0 right-0 rounded" style="width: ${pct}%; background: linear-gradient(90deg, rgba(0, 230, 118, 0.22), rgba(0, 230, 118, 0.60)); border-left: 2.5px solid #00e676; box-shadow: inset 0 0 8px rgba(0, 230, 118, 0.35);"></div>
        <span class="text-[#00e676] z-10 font-bold tracking-tight">${curr}${bidP}</span>
        <span class="text-[#f0f3fa] z-10 font-semibold">${qty.toLocaleString()}</span>
      `;
      bidsList.appendChild(el);
    }

    // Update Buyer vs Seller power ratio bar in DOM
    const totalQty = totalAskQty + totalBidQty;
    if (totalQty > 0) {
      const bidPct = Math.round((totalBidQty / totalQty) * 100);
      const askPct = 100 - bidPct;
      const bidLbl = this.container.querySelector('#depth-total-bids-label');
      const askLbl = this.container.querySelector('#depth-total-asks-label');
      const bidFill = this.container.querySelector('#depth-bid-ratio-fill');
      const askFill = this.container.querySelector('#depth-ask-ratio-fill');
      if (bidLbl) bidLbl.textContent = `Total Bids: ${bidPct}% (${totalBidQty.toLocaleString()})`;
      if (askLbl) askLbl.textContent = `Total Asks: ${askPct}% (${totalAskQty.toLocaleString()})`;
      if (bidFill) bidFill.style.width = `${bidPct}%`;
      if (askFill) askFill.style.width = `${askPct}%`;
    }
  }

  startLivePolling() {
    setInterval(() => {
      // Check if Indian market is open
      const isMarketOpen = window.dataFeed ? window.dataFeed.isIndianMarketOpen() : false;

      // Only fluctuate prices if the market is open
      if (isMarketOpen) {
        const activeList = this.getActiveWatchlist();
        activeList.forEach(item => {
          const isCrypto = (item.symbol || '').includes('USDT') || (item.symbol || '').includes('BTC');
          if (!isMarketOpen && !isCrypto) return;
          const drift = (Math.random() - 0.495) * (item.price * 0.0006);
          item.price = parseFloat((item.price + drift).toFixed(item.precision || 2));
        });

        if (this.currentTab === 'watchlist') {
          this.renderWatchlist();
        } else if (this.currentTab === 'depth') {
          this.renderDepth();
        }
      }
    }, 2500);
  }
}

window.WatchlistPanel = WatchlistPanel;
