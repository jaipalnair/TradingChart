import tempfile
"""
TradingView Multi-Chart Web Platform Backend
Powered by FastAPI, Uvicorn, yfinance, and Binance Public APIs
"""

import os
import sys
import json
import time
import math
import random
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, Query, HTTPException, WebSocket, WebSocketDisconnect, Request, Header, Depends
import database
import fyers_auth
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import yfinance as yf

# Base directory
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="TradeView Multi-Chart Platform", version="1.0.0")

# Enable CORS for local cross-origin development if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database (Users, Profiles, Settings, Traffic)
database.init_db()

@app.middleware("http")
async def traffic_logger_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    # Ignore static files and noisy favicon to keep traffic logs meaningful
    if not (path.startswith("/static/") or any(path.endswith(ext) for ext in [".ico", ".svg", ".png", ".jpg", ".css", ".js"])):
        auth_header = request.headers.get("Authorization")
        user = None
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                user = database.get_user_by_token(parts[1])

        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        user_agent = request.headers.get("user-agent", "")[:150]
        user_id = user["id"] if user else None
        username = user["username"] if user else "guest"

        try:
            database.log_traffic(
                user_id=user_id,
                username=username,
                endpoint=path,
                method=request.method,
                ip_address=client_ip,
                user_agent=user_agent,
                status_code=response.status_code
            )
        except Exception as e:
            pass
    return response

# In-memory Paper Trading Account State
PAPER_ACCOUNT = {
    "balance": 100000.00,  # $100,000 USD virtual capital
    "equity": 100000.00,
    "realized_pnl": 0.0,
    "unrealized_pnl": 0.0,
    "positions": {},       # symbol -> { "symbol": ..., "side": "BUY"|"SELL", "qty": ..., "avg_price": ..., "current_price": ..., "pnl": ... }
    "orders": [],          # list of filled or pending orders
    "created_at": datetime.now(timezone.utc).isoformat()
}

# Supported Asset Universe
SUPPORTED_SYMBOLS = [
    # Top Indian Stocks & Indices (NSE)
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "RELIANCE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TCS", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HDFCBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "INFY", "name": "Infosys Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "INFY", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ICICIBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TATAMOTORS", "quote": "INR", "precision": 2, "icon": "🚗"},
    {"symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "category": "Indian Stocks", "base": "SBIN", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BHARTIARTL", "quote": "INR", "precision": 2, "icon": "📡"},
    {"symbol": "ITC", "name": "ITC Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ITC", "quote": "INR", "precision": 2, "icon": "📦"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "LT", "quote": "INR", "precision": 2, "icon": "🏗️"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BAJFINANCE", "quote": "INR", "precision": 2, "icon": "💳"},
    {"symbol": "WIPRO", "name": "Wipro Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "WIPRO", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "MARUTI", "quote": "INR", "precision": 2, "icon": "🚘"},
    {"symbol": "TITAN", "name": "Titan Company Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TITAN", "quote": "INR", "precision": 2, "icon": "⌚"},
    {"symbol": "INDUSINDBK", "name": "IndusInd Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "INDUSINDBK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "KOTAKBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "AXISBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "ZOMATO", "name": "Zomato Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ZOMATO", "quote": "INR", "precision": 2, "icon": "🍽️"},
    {"symbol": "HAL", "name": "Hindustan Aeronautics Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HAL", "quote": "INR", "precision": 2, "icon": "✈️"},
    {"symbol": "SUZLON", "name": "Suzlon Energy Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "SUZLON", "quote": "INR", "precision": 2, "icon": "⚡"},
    {"symbol": "BEL", "name": "Bharat Electronics Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BEL", "quote": "INR", "precision": 2, "icon": "🛡️"},
    {"symbol": "JIOFIN", "name": "Jio Financial Services Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "JIOFIN", "quote": "INR", "precision": 2, "icon": "📱"},
    {"symbol": "NIFTY50", "name": "NIFTY 50 Index", "exchange": "NSE", "category": "Indices", "base": "NIFTY", "quote": "INR", "precision": 2, "icon": "📊"},
    {"symbol": "BANKNIFTY", "name": "Bank Nifty Index", "exchange": "NSE", "category": "Indices", "base": "BANKNIFTY", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "NIFTY_MID_SELECT", "name": "Nifty Midcap Select", "exchange": "NSE", "category": "Indices", "base": "NIFTY_MID_SELECT", "quote": "INR", "precision": 2, "icon": "📈"},
    {"symbol": "FINNIFTY", "name": "Nifty Financial Services", "exchange": "NSE", "category": "Indices", "base": "FINNIFTY", "quote": "INR", "precision": 2, "icon": "💳"},
    {"symbol": "NIFTYIT", "name": "Nifty IT Index", "exchange": "NSE", "category": "Indices", "base": "NIFTYIT", "quote": "INR", "precision": 2, "icon": "💻"},
    {"symbol": "INDIAVIX", "name": "India Volatility Index", "exchange": "NSE", "category": "Indices", "base": "INDIAVIX", "quote": "INR", "precision": 2, "icon": "⚡"},

    {"symbol": "ADANIENT.NS", "name": "Adani Enterprises Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ADANIENT", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ADANIPORTS.NS", "name": "Adani Ports and Special Economic Zone Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ADANIPORTS", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "APOLLOHOSP.NS", "name": "Apollo Hospitals Enterprise Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "APOLLOHOSP", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ASIANPAINT.NS", "name": "Asian Paints Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ASIANPAINT", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "AXISBANK", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BAJAJ-AUTO.NS", "name": "Bajaj Auto Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BAJAJ-AUTO", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BAJFINANCE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BAJAJFINSV.NS", "name": "Bajaj Finserv Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BAJAJFINSV", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BEL.NS", "name": "Bharat Electronics Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BEL", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BHARTIARTL", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "BSE.NS", "name": "BSE Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "BSE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "CIPLA.NS", "name": "Cipla Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "CIPLA", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "COALINDIA.NS", "name": "Coal India Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "COALINDIA", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "DRREDDY.NS", "name": "Dr. Reddy's Laboratories Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "DRREDDY", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "EICHERMOT.NS", "name": "Eicher Motors Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "EICHERMOT", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ETERNAL.NS", "name": "Eternal Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ETERNAL", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "GRASIM.NS", "name": "Grasim Industries Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "GRASIM", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HCLTECH", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HDFCBANK", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HDFCLIFE.NS", "name": "HDFC Life Insurance Company Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HDFCLIFE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HINDALCO.NS", "name": "Hindalco Industries Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HINDALCO", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "HINDUNILVR", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ICICIBANK", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "INDUSINDBK", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "INFY.NS", "name": "Infosys Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "INFY", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ITC.NS", "name": "ITC Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ITC", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "JIOFIN.NS", "name": "Jio Financial Services Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "JIOFIN", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "JSWSTEEL", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "KOTAKBANK", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "LT.NS", "name": "Larsen & Toubro Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "LT", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "M&M", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki India Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "MARUTI", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "MAXHEALTH.NS", "name": "Max Healthcare Institute Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "MAXHEALTH", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "NESTLEIND.NS", "name": "Nestlé India Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "NESTLEIND", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "NTPC.NS", "name": "NTPC Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "NTPC", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ONGC.NS", "name": "Oil & Natural Gas Corporation Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ONGC", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corporation of India Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "POWERGRID", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "RELIANCE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "SBILIFE.NS", "name": "SBI Life Insurance Company Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "SBILIFE", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "SHRIRAMFIN.NS", "name": "Shriram Finance Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "SHRIRAMFIN", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "category": "Indian Stocks", "base": "SBIN", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "SUNPHARMA", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TATACONSUM.NS", "name": "Tata Consumer Products Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TATACONSUM", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TMCV.NS", "name": "Tata Motors Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TMCV", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TCS", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TATASTEEL", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TECHM", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TITAN.NS", "name": "Titan Company Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TITAN", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "TRENT.NS", "name": "Trent Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "TRENT", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "ULTRACEMCO.NS", "name": "UltraTech Cement Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "ULTRACEMCO", "quote": "INR", "precision": 2, "icon": "🇮🇳"},
    {"symbol": "AUBANK.NS", "name": "AU Small Finance Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "AUBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "BANKBARODA.NS", "name": "Bank of Baroda", "exchange": "NSE", "category": "Indian Stocks", "base": "BANKBARODA", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "CANBK.NS", "name": "Canara Bank", "exchange": "NSE", "category": "Indian Stocks", "base": "CANBK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "FEDERALBNK.NS", "name": "Federal Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "FEDERALBNK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "IDFCFIRSTB.NS", "name": "IDFC First Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "IDFCFIRSTB", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "PNB.NS", "name": "Punjab National Bank", "exchange": "NSE", "category": "Indian Stocks", "base": "PNB", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "UNIONBANK.NS", "name": "Union Bank of India", "exchange": "NSE", "category": "Indian Stocks", "base": "UNIONBANK", "quote": "INR", "precision": 2, "icon": "🏦"},
    {"symbol": "YESBANK.NS", "name": "Yes Bank Ltd.", "exchange": "NSE", "category": "Indian Stocks", "base": "YESBANK", "quote": "INR", "precision": 2, "icon": "🏦"},

    # Top Cryptocurrencies
    {"symbol": "BTCUSDT", "name": "Bitcoin / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "BTC", "quote": "USDT", "precision": 2, "icon": "₿"},
    {"symbol": "ETHUSDT", "name": "Ethereum / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "ETH", "quote": "USDT", "precision": 2, "icon": "Ξ"},
    {"symbol": "SOLUSDT", "name": "Solana / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "SOL", "quote": "USDT", "precision": 2, "icon": "◎"},
    {"symbol": "BNBUSDT", "name": "BNB / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "BNB", "quote": "USDT", "precision": 2, "icon": "🔶"},
    {"symbol": "XRPUSDT", "name": "Ripple / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "XRP", "quote": "USDT", "precision": 4, "icon": "✕"},
    {"symbol": "DOGEUSDT", "name": "Dogecoin / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "DOGE", "quote": "USDT", "precision": 5, "icon": "Ð"},
    {"symbol": "ADAUSDT", "name": "Cardano / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "ADA", "quote": "USDT", "precision": 4, "icon": "₳"},
    {"symbol": "AVAXUSDT", "name": "Avalanche / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "AVAX", "quote": "USDT", "precision": 2, "icon": "🔺"},
    {"symbol": "NEARUSDT", "name": "NEAR Protocol / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "NEAR", "quote": "USDT", "precision": 3, "icon": "Ⓝ"},
    {"symbol": "SUIUSDT", "name": "Sui / TetherUS", "exchange": "BINANCE", "category": "Crypto", "base": "SUI", "quote": "USDT", "precision": 4, "icon": "💧"},

    # Major Tech & US Stocks
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "category": "Stocks", "base": "AAPL", "quote": "USD", "precision": 2, "icon": "🍎"},
    {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange": "NASDAQ", "category": "Stocks", "base": "TSLA", "quote": "USD", "precision": 2, "icon": "⚡"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "category": "Stocks", "base": "NVDA", "quote": "USD", "precision": 2, "icon": "🟢"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "category": "Stocks", "base": "MSFT", "quote": "USD", "precision": 2, "icon": "🪟"},
    {"symbol": "AMZN", "name": "Amazon.com, Inc.", "exchange": "NASDAQ", "category": "Stocks", "base": "AMZN", "quote": "USD", "precision": 2, "icon": "📦"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ", "category": "Stocks", "base": "GOOGL", "quote": "USD", "precision": 2, "icon": "🔍"},
    {"symbol": "META", "name": "Meta Platforms, Inc.", "exchange": "NASDAQ", "category": "Stocks", "base": "META", "quote": "USD", "precision": 2, "icon": "♾️"},

    # Global Indices & Commodities & Forex
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange": "AMEX", "category": "Indices", "base": "SPY", "quote": "USD", "precision": 2, "icon": "📈"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust (Nasdaq 100)", "exchange": "NASDAQ", "category": "Indices", "base": "QQQ", "quote": "USD", "precision": 2, "icon": "📊"},
    {"symbol": "GC=F", "name": "Gold Futures", "exchange": "COMEX", "category": "Commodities", "base": "GOLD", "quote": "USD", "precision": 2, "icon": "🪙"},
    {"symbol": "CL=F", "name": "Crude Oil Futures", "exchange": "NYMEX", "category": "Commodities", "base": "OIL", "quote": "USD", "precision": 2, "icon": "🛢️"},
    {"symbol": "EURUSD=X", "name": "EUR / USD", "exchange": "FX", "category": "Forex", "base": "EUR", "quote": "USD", "precision": 5, "icon": "💶"},
    {"symbol": "GBPUSD=X", "name": "GBP / USD", "exchange": "FX", "category": "Forex", "base": "GBP", "quote": "USD", "precision": 5, "icon": "💷"}
]

def normalize_interval(interval: str) -> str:
    if not interval:
        return "5m"
    s = str(interval).strip()
    if s == "1M" or s.lower() in ["1mo", "1month", "month"]:
        return "1M"
    return s.lower()

# Timeframe translation
BINANCE_TIMEFRAMES = {
    "1s": "1s", "1m": "1m", "2m": "1m", "3m": "3m", "5m": "5m", "10m": "5m", "15m": "15m",
    "30m": "30m", "1h": "1h", "2h": "2h", "4h": "4h", "1d": "1d", "1w": "1w", "1M": "1M"
}

YFINANCE_INTERVALS = {
    "1m": ("1m", "7d"),
    "2m": ("2m", "60d"),
    "3m": ("1m", "7d"),
    "5m": ("5m", "60d"),
    "10m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "30m": ("30m", "60d"),
    "1h": ("60m", "730d"),
    "2h": ("60m", "730d"),
    "4h": ("60m", "730d"),
    "1d": ("1d", "5y"),
    "1w": ("1wk", "10y"),
    "1M": ("1mo", "10y")
}

def get_base_price_for_symbol(symbol: str) -> float:
    """Accurate reference price mapping for procedural simulation."""
    s = symbol.upper().strip().rstrip('.')
    s_clean = s.replace('.NS', '').replace('.BO', '')
    price_map = {
        "RELIANCE": 1184.50, "TCS": 2506.90, "HDFCBANK": 1685.20, "INFY": 1820.40,
        "ICICIBANK": 1245.80, "TATAMOTORS": 982.10, "TMCV": 982.10, "SBIN": 812.30, "BHARTIARTL": 1680.00,
        "ITC": 472.50, "LT": 3540.00, "BAJFINANCE": 6850.00, "MARUTI": 12400.00,
        "TITAN": 3400.00, "WIPRO": 540.00, "INDUSINDBK": 850.50, "KOTAKBANK": 1780.00,
        "AXISBANK": 1180.00, "HINDUNILVR": 2450.00, "ASIANPAINT": 2580.00, "SUNPHARMA": 1890.00,
        "COALINDIA": 485.00, "ONGC": 290.00, "NTPC": 410.00, "TATASTEEL": 155.00,
        "NIFTY50": 22687.65, "NIFTY": 22687.65,
        "^NSEI": 22687.65, "BANKNIFTY": 54280.00, "^NSEBANK": 54280.00,
        "MIDCPNIFTY": 13033.05, "NIFTY_MID_SELECT": 13033.05, "FINNIFTY": 24400.00, "NIFTYIT": 32000.00, "^CNXIT": 32000.00,
        "INDIAVIX": 16.85, "^INDIAVIX": 16.85,
        "ZOMATO": 265.50, "HAL": 4350.00, "SUZLON": 72.50, "BEL": 290.00,
        "PAYTM": 720.00, "JIOFIN": 325.00, "ADANIENT": 2850.00, "ADANIPORTS": 1380.00,
        "AUBANK": 625.00, "BANKBARODA": 250.00, "CANBK": 105.00, "FEDERALBNK": 195.00,
        "IDFCFIRSTB": 72.00, "PNB": 102.00, "UNIONBANK": 118.00, "YESBANK": 21.50,
        "APOLLOHOSP": 6780.00, "BAJAJ-AUTO": 9450.00, "BAJAJFINSV": 1640.00,
        "BSE": 2750.00, "CIPLA": 1520.00, "DRREDDY": 6620.00, "EICHERMOT": 4850.00,
        "ETERNAL": 120.00, "GRASIM": 2540.00, "HCLTECH": 1780.00, "HDFCLIFE": 710.00,
        "HINDALCO": 680.00, "JSWSTEEL": 990.00, "M&M": 2980.00, "MAXHEALTH": 980.00,
        "NESTLEIND": 2280.00, "POWERGRID": 325.00, "SBILIFE": 1720.00, "SHRIRAMFIN": 3150.00,
        "TATACONSUM": 1120.00, "TECHM": 1680.00, "TRENT": 7650.00, "ULTRACEMCO": 11200.00,
        "BTCUSDT": 82000.0, "ETHUSDT": 3120.0, "SOLUSDT": 182.0, "BNBUSDT": 590.0,
        "AAPL": 230.0, "NVDA": 136.0, "TSLA": 218.0, "MSFT": 425.0,
        "AMZN": 186.0, "GOOGL": 165.0, "META": 585.0, "SPY": 582.0,
        "QQQ": 490.0, "GC=F": 2735.0, "CL=F": 71.50
    }
    for k, v in price_map.items():
        if s == k or s_clean == k or s.startswith(k) or k.startswith(s):
            return v
    if s.endswith(".NS") or s.endswith(".BO"):
        return 650.0
    if "USDT" in s or "BTC" in s:
        return 82000.0
    return 850.0

def generate_nse_timestamps(limit: int = 300, interval_str: str = "5m") -> List[int]:
    """Generate realistic timestamps strictly within NSE trading hours (09:15 to 15:30 IST, Mon-Fri)."""
    norm = normalize_interval(interval_str)
    interval_mins = {
        "1m": 1, "2m": 2, "3m": 3, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
        "1h": 60, "2h": 120, "4h": 240, "1d": 1440, "1w": 10080, "1M": 43200
    }.get(norm, 5)

    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist)

    if interval_mins >= 1440:
        cur = now
        days = []
        step_days = 7 if norm == "1w" else (30 if norm == "1M" else 1)
        while len(days) < limit:
            while cur.weekday() >= 5: # Sat=5, Sun=6
                cur -= timedelta(days=1)
            bar_dt = cur.replace(hour=9, minute=15, second=0, microsecond=0)
            days.append(int(bar_dt.timestamp()))
            cur -= timedelta(days=step_days)
        days.reverse()
        return days

    cur = now
    while cur.weekday() >= 5:
        cur -= timedelta(days=1)
        cur = cur.replace(hour=15, minute=30, second=0, microsecond=0)

    mins_of_day = cur.hour * 60 + cur.minute
    if mins_of_day > 930:
        cur = cur.replace(hour=15, minute=30, second=0, microsecond=0)
    elif mins_of_day < 555:
        cur -= timedelta(days=1)
        while cur.weekday() >= 5:
            cur -= timedelta(days=1)
        cur = cur.replace(hour=15, minute=30, second=0, microsecond=0)
    else:
        m = (cur.minute // interval_mins) * interval_mins
        cur = cur.replace(minute=m, second=0, microsecond=0)

    timestamps = []
    while len(timestamps) < limit:
        timestamps.append(int(cur.timestamp()))
        cur -= timedelta(minutes=interval_mins)
        if cur.hour * 60 + cur.minute < 555:
            cur -= timedelta(days=1)
            while cur.weekday() >= 5:
                cur -= timedelta(days=1)
            cur = cur.replace(hour=15, minute=30, second=0, microsecond=0)

    timestamps.reverse()
    return timestamps

def generate_simulated_candles(symbol: str, interval: str, limit: int = 300) -> List[Dict[str, Any]]:
    """Procedural realistic fallback candle generator respecting NSE market sessions."""
    base_price = get_base_price_for_symbol(symbol)
    s_upper = symbol.upper()
    is_crypto = any(c in s_upper for c in ["USDT", "BTC", "ETH", "SOL", "BNB", "DOGE", "XRP"])
    is_us = any(u in s_upper for u in ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "SPY", "QQQ"])

    if not is_crypto and not is_us:
        timestamps = generate_nse_timestamps(limit, interval)
    else:
        norm = normalize_interval(interval)
        interval_seconds = {
            "1m": 60, "2m": 120, "3m": 180, "5m": 300, "10m": 600, "15m": 900, "30m": 1800,
            "1h": 3600, "2h": 7200, "4h": 14400, "1d": 86400, "1w": 604800, "1M": 2592000
        }.get(norm, 300)
        now_ts = int(time.time())
        start_ts = (now_ts - (limit * interval_seconds)) // interval_seconds * interval_seconds
        timestamps = [start_ts + (i * interval_seconds) for i in range(limit)]

    candles = []
    current_price = base_price
    volatility = base_price * 0.0018

    # Walk backwards from base_price so the latest bar's close ALWAYS matches base_price
    for t in reversed(timestamps):
        cl = current_price
        drift = random.gauss(0, 1) * volatility
        op = round(cl - drift, 2)
        hi = round(max(op, cl) + abs(random.gauss(0, 1) * volatility * 0.7), 2)
        lo = round(min(op, cl) - abs(random.gauss(0, 1) * volatility * 0.7), 2)
        volume = round(random.uniform(50, 5000) * (base_price / 100), 2)

        candles.append({
            "time": t,
            "open": op,
            "high": hi,
            "low": lo,
            "close": cl,
            "volume": volume
        })
        current_price = op

    candles.reverse()
    return candles

def fetch_binance_klines(symbol: str, interval: str, limit: int = 500) -> Optional[List[Dict[str, Any]]]:
    """Fetch candles from Binance REST API."""
    bi_interval = BINANCE_TIMEFRAMES.get(interval, "1h")
    # Clean symbol for Binance (must end in USDT, BTC, etc.)
    bi_symbol = symbol.replace("/", "").replace("-", "").upper()
    if not any(bi_symbol.endswith(q) for q in ["USDT", "BUSD", "BTC", "ETH", "EUR", "USD"]):
        bi_symbol += "USDT"

    urls = [
        f"https://api.binance.com/api/v3/klines?symbol={bi_symbol}&interval={bi_interval}&limit={limit}",
        f"https://data-api.binance.vision/api/v3/klines?symbol={bi_symbol}&interval={bi_interval}&limit={limit}"
    ]

    for url in urls:
        try:
            resp = requests.get(url, timeout=4)
            if resp.status_code == 200:
                raw = resp.json()
                candles = []
                for k in raw:
                    candles.append({
                        "time": int(k[0] // 1000),  # UNIX timestamp in seconds
                        "open": float(k[1]),
                        "high": float(k[2]),
                        "low": float(k[3]),
                        "close": float(k[4]),
                        "volume": float(k[5])
                    })
                return candles
        except Exception:
            continue
    return None

def normalize_yf_symbol(symbol: str) -> str:
    """Translate user/app symbols to proper Yahoo Finance ticker symbols with automatic .NS suffix."""
    s = symbol.upper().strip().rstrip('.')
    if s in ["NIFTY", "NIFTY 50", "NIFTY50", "^NSEI"]:
        return "^NSEI"
    if s in ["BANKNIFTY", "NIFTY BANK", "BANK NIFTY", "^NSEBANK"]:
        return "^NSEBANK"
    if s in ["NIFTY_MID_SELECT", "NIFTY_MID_SELECT.NS", "NIFTY MID SELECT", "MIDCPNIFTY", "MIDCAP NIFTY", "NIFTY MIDCAP"]:
        return "NIFTY_MID_SELECT.NS"
    if s in ["FINNIFTY", "FIN NIFTY", "NIFTY FINANCIAL"]:
        return "NIFTY_FIN_SERVICE.NS"
    if s in ["NIFTYIT", "NIFTY IT", "^CNXIT"]:
        return "^CNXIT"
    if s in ["INDIAVIX", "INDIA VIX", "^INDIAVIX"]:
        return "^INDIAVIX"
    if s == "GOLD":
        return "GC=F"
    if s == "OIL":
        return "CL=F"
    if s in ["EURUSD", "EUR/USD"]:
        return "EURUSD=X"
    if s in ["GBPUSD", "GBP/USD"]:
        return "GBPUSD=X"
    if s.endswith(".NS") or s.endswith(".BO") or "=" in s or "^" in s:
        return s

    # Known foreign symbols
    foreign_tickers = [
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT",
        "ADAUSDT", "AVAXUSDT", "NEARUSDT", "SUIUSDT", "AAPL", "TSLA",
        "NVDA", "MSFT", "AMZN", "GOOGL", "META", "SPY", "QQQ"
    ]
    if any(s.startswith(f) for f in foreign_tickers):
        return s

    # All Indian stocks default to .NS on National Stock Exchange
    return f"{s}.NS"

def fetch_yfinance_klines(symbol: str, interval: str, limit: int = 500) -> Optional[List[Dict[str, Any]]]:
    """Fetch stock/forex/index candles via yfinance."""
    yf_symbol = normalize_yf_symbol(symbol)

    interval_config = YFINANCE_INTERVALS.get(interval, ("1h", "730d"))
    yf_int, yf_per = interval_config

    try:
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period=yf_per, interval=yf_int)
        if df.empty:
            return None

        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        if df.empty:
            return None
            
        candles = []
        for index, row in df.iterrows():
            o, h, l, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
            if any(math.isnan(v) for v in (o, h, l, c)):
                continue
            ts = int(index.timestamp())
            candles.append({
                "time": ts,
                "open": round(o, 4),
                "high": round(h, 4),
                "low": round(l, 4),
                "close": round(c, 4),
                "volume": round(float(row.get("Volume", 0)), 2)
            })
            
        # Return only the requested limit
        if len(candles) > limit:
            candles = candles[-limit:]
        return candles
    except Exception as e:
        print(f"yfinance fetch error for {symbol}: {e}")
        return None


# ================= FYERS API v3 INTEGRATION =================
FYERS_CONFIG_PATH = BASE_DIR / "fyers_config.json"

_fyers_client_cache = None
_fyers_client_token = ""
_fyers_client_app_id = ""

def to_fyers_symbol(symbol: str) -> str:
    """Format symbol to Fyers API v3 standard (e.g. NSE:RELIANCE-EQ, NSE:NIFTY50-INDEX)."""
    sym = symbol.upper().strip()
    if sym.startswith("NSE:") or sym.startswith("BSE:") or sym.startswith("MCX:"):
        return sym

    indices = {
        "NIFTY50": "NSE:NIFTY50-INDEX",
        "NIFTY 50": "NSE:NIFTY50-INDEX",
        "NIFTY": "NSE:NIFTY50-INDEX",
        "^NSEI": "NSE:NIFTY50-INDEX",
        "BANKNIFTY": "NSE:NIFTYBANK-INDEX",
        "NIFTY BANK": "NSE:NIFTYBANK-INDEX",
        "^NSEBANK": "NSE:NIFTYBANK-INDEX",
        "FINNIFTY": "NSE:FINNIFTY-INDEX",
        "NIFTY_MID_SELECT": "NSE:MIDCPNIFTY-INDEX",
        "MIDCPNIFTY": "NSE:MIDCPNIFTY-INDEX",
        "NIFTYIT": "NSE:NIFTYIT-INDEX",
        "INDIAVIX": "NSE:INDIAVIX-INDEX",
        "SENSEX": "BSE:SENSEX-INDEX",
        "^BSESN": "BSE:SENSEX-INDEX"
    }
    if sym in indices:
        return indices[sym]

    clean = sym.replace(".NS", "").replace(".BO", "").rstrip(".")
    return f"NSE:{clean}-EQ"

def get_fyers_client():
    global _fyers_client_cache, _fyers_client_token, _fyers_client_app_id
    app_id = ""
    tok = ""
    enabled = True

    # 1. Check local fyers_config.json
    if FYERS_CONFIG_PATH.exists():
        try:
            with open(FYERS_CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            enabled = bool(cfg.get("enabled", True))
            app_id = str(cfg.get("app_id", cfg.get("client_id", ""))).strip()
            tok = str(cfg.get("access_token", "")).strip()
        except Exception as e:
            print(f"Error reading fyers_config.json: {e}")

    # 2. Fallback to Cloud Environment Variables (for Render / Railway)
    if not app_id or not tok:
        env_app_id = (os.environ.get("FYERS_APP_ID") or os.environ.get("FYERS_CLIENT_ID") or "").strip()
        env_tok = os.environ.get("FYERS_ACCESS_TOKEN", "").strip()
        if env_app_id and env_tok:
            app_id = env_app_id
            tok = env_tok
            enabled = True

    if not enabled or not app_id or not tok:
        return None

    try:
        if _fyers_client_cache and _fyers_client_token == tok and _fyers_client_app_id == app_id:
            return _fyers_client_cache
        from fyers_apiv3.fyersModel import FyersModel
        client = FyersModel(client_id=app_id, token=tok, is_async=False, log_path=None)
        _fyers_client_cache = client
        _fyers_client_token = tok
        _fyers_client_app_id = app_id
        return _fyers_client_cache
    except Exception as e:
        print(f"Error initializing Fyers client: {e}")
        return None

def fetch_fyers_candles(symbol: str, interval: str, limit: int = 500) -> Optional[List[Dict[str, Any]]]:
    client = get_fyers_client()
    if not client:
        return None
    fyers_sym = to_fyers_symbol(symbol)
    norm = normalize_interval(interval)

    int_map = {
        "1m": "1", "2m": "2", "3m": "3", "5m": "5", "10m": "10",
        "15m": "15", "25m": "20", "30m": "30", "1h": "60", "60m": "60",
        "2h": "120", "4h": "240", "1d": "1D", "1w": "1D", "1M": "1D"
    }
    resolution = int_map.get(norm, "5")

    today = datetime.now()
    to_date = today.strftime("%Y-%m-%d")
    if resolution in ["1D", "D", "Day"]:
        from_date = (today - timedelta(days=1825)).strftime("%Y-%m-%d")
    else:
        from_date = (today - timedelta(days=90)).strftime("%Y-%m-%d")

    try:
        data = {
            "symbol": fyers_sym,
            "resolution": resolution,
            "date_format": 1,
            "range_from": from_date,
            "range_to": to_date,
            "cont_flag": 1
        }
        resp = client.history(data=data)
        if resp and resp.get("s") == "ok" and "candles" in resp:
            raw_candles = resp["candles"]
            candles = []
            for c in raw_candles:
                candles.append({
                    "time": int(c[0]),
                    "open": round(float(c[1]), 2),
                    "high": round(float(c[2]), 2),
                    "low": round(float(c[3]), 2),
                    "close": round(float(c[4]), 2),
                    "volume": round(float(c[5]), 2) if len(c) > 5 else 0
                })
            if candles:
                return candles[-limit:]
    except Exception as e:
        print(f"Fyers candle fetch error for {symbol} ({fyers_sym}): {e}")
    return None

def fetch_fyers_quote(symbol: str) -> Optional[Dict[str, Any]]:
    client = get_fyers_client()
    if not client:
        return None
    fyers_sym = to_fyers_symbol(symbol)
    try:
        resp = client.quotes(data={"symbols": fyers_sym})
        if resp and resp.get("s") == "ok" and "d" in resp and len(resp["d"]) > 0:
            d = resp["d"][0]
            if d.get("s") == "ok" and "v" in d:
                v = d["v"]
                last_p = float(v.get("lp", 0))
                chg = float(v.get("ch", 0))
                chg_pct = float(v.get("chp", 0))
                return {
                    "symbol": symbol.upper(),
                    "price": last_p,
                    "change": chg,
                    "changePercent": chg_pct,
                    "high": float(v.get("high_price", last_p)),
                    "low": float(v.get("low_price", last_p)),
                    "volume": float(v.get("volume", 0)),
                    "source": "fyers"
                }
    except Exception as e:
        print(f"Fyers quote fetch error for {symbol} ({fyers_sym}): {e}")
    return None

# ================= REST API ROUTES =================

@app.get("/api/symbols")
def get_symbols():
    """Return available asset universe."""
    return {"status": "ok", "symbols": SUPPORTED_SYMBOLS}

@app.get("/api/history")
def get_history(
    symbol: str = Query(..., description="Ticker symbol, e.g. BTCUSDT, AAPL"),
    interval: str = Query("5m", description="Candle interval, e.g. 1m, 2m, 3m, 5m, 10m, 15m, 30m, 1h, 2h, 4h, 1d, 1w, 1M"),
    limit: int = Query(500, ge=10, le=1500, description="Number of bars to return")
):
    """Retrieve historical candlestick bars."""
    symbol_upper = symbol.upper()
    norm_interval = normalize_interval(interval)
    is_crypto = any(c in symbol_upper for c in ["USDT", "BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "NEAR", "SUI"])
    
    candles = None
    source = "simulation"

    if is_crypto:
        candles = fetch_binance_klines(symbol_upper, norm_interval, limit)
        if candles:
            source = "binance"
    else:
        # Check Fyers live historical candle feed
        candles = fetch_fyers_candles(symbol_upper, norm_interval, limit)
        if candles:
            source = "fyers"

    if not candles:
        candles = fetch_yfinance_klines(symbol_upper, norm_interval, limit)
        if candles:
            source = "yfinance"

    if not candles:
        # Fallback to simulated Brownian motion candles
        candles = generate_simulated_candles(symbol_upper, norm_interval, limit)
        source = "simulation"

    return {
        "status": "ok",
        "symbol": symbol_upper,
        "interval": norm_interval,
        "count": len(candles),
        "source": source,
        "data": candles
    }

@app.get("/api/quote")
def get_quote(symbol: str = Query(..., description="Ticker symbol")):
    """Get live 24h quote and price summary."""
    symbol_upper = symbol.upper()
    
    # Try Binance for crypto
    if any(c in symbol_upper for c in ["USDT", "BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "NEAR", "SUI"]):
        bi_symbol = symbol_upper.replace("/", "").replace("-", "")
        if not bi_symbol.endswith("USDT"):
            bi_symbol += "USDT"
        try:
            resp = requests.get(f"https://api.binance.com/api/v3/ticker/24hr?symbol={bi_symbol}", timeout=3)
            if resp.status_code == 200:
                q = resp.json()
                return {
                    "symbol": symbol_upper,
                    "price": float(q["lastPrice"]),
                    "change": float(q["priceChange"]),
                    "changePercent": float(q["priceChangePercent"]),
                    "high": float(q["highPrice"]),
                    "low": float(q["lowPrice"]),
                    "volume": float(q["volume"]),
                    "quoteVolume": float(q["quoteVolume"])
                }
        except Exception:
            pass

    # Try Fyers live quote if configured
    fyers_q = fetch_fyers_quote(symbol_upper)
    if fyers_q:
        return fyers_q

    # Try yfinance for stocks
    try:
        yf_sym = normalize_yf_symbol(symbol_upper)
        t = yf.Ticker(yf_sym)
        hist = t.history(period="2d")
        if not hist.empty:
            last_p = float(hist["Close"].iloc[-1])
            prev_p = float(hist["Close"].iloc[-2]) if len(hist) > 1 else last_p
            change = last_p - prev_p
            change_pct = (change / prev_p * 100) if prev_p else 0
            return {
                "symbol": symbol_upper,
                "price": round(last_p, 2),
                "change": round(change, 2),
                "changePercent": round(change_pct, 2),
                "high": round(float(hist["High"].max()), 2),
                "low": round(float(hist["Low"].min()), 2),
                "volume": float(hist["Volume"].iloc[-1]) if "Volume" in hist else 0
            }
    except Exception:
        pass

    # Simulated fallback with accurate scrip-specific base price
    base = get_base_price_for_symbol(symbol_upper)
    chg = round((random.random() - 0.48) * (base * 0.012), 2)
    chg_pct = round((chg / base) * 100, 2) if base else 0.0
    return {
        "symbol": symbol_upper,
        "price": round(base + chg, 2),
        "change": chg,
        "changePercent": chg_pct,
        "high": round(base + abs(chg * 1.5) + (base * 0.005), 2),
        "low": round(base - abs(chg * 1.5) - (base * 0.005), 2),
        "volume": round(random.uniform(10000, 500000), 0)
    }


# ================= FYERS API v3 OAUTH & AUTHENTICATION ENDPOINTS ================
STANDARD_FYERS_REDIRECT_URI = "https://trade.fyers.in/api-login/redirect-uri/index.html"
@app.get("/api/fyers/config")
@app.get("/api/dhan/config")
def get_fyers_config(request: Request):
    host = request.headers.get("host", "127.0.0.1:8000")
    scheme = "https" if request.headers.get("x-forwarded-proto") == "https" or "render.com" in host else "http"
    default_callback = f"{scheme}://{host}/api/fyers/callback"

    saved = fyers_auth.load_fyers_config()
    app_id = str(saved.get("app_id", saved.get("client_id", ""))).strip()
    token = str(saved.get("access_token", "")).strip()
    secret_key = str(saved.get("secret_key", "")).strip()
    redirect_uri = str(saved.get("redirect_uri", "")).strip() or STANDARD_FYERS_REDIRECT_URI
    enabled = bool(saved.get("enabled", False))
    has_token = len(token) > 20
    has_secret = len(secret_key) > 5

    status = "Not Configured"
    if app_id and has_token:
        status = "Connected" if enabled else "Disabled"
    elif app_id and has_secret:
        status = "Ready to Login"

    profile = saved.get("profile", {})
    masked_secret = (secret_key[:3] + "••••••••" + secret_key[-2:]) if len(secret_key) > 6 else ("••••••••" if secret_key else "")

    return {
        "enabled": enabled,
        "app_id": app_id,
        "client_id": app_id,
        "masked_id": (app_id[:4] + "****" + app_id[-3:]) if len(app_id) > 7 else app_id,
        "secret_key": secret_key,
        "masked_secret": masked_secret,
        "has_secret": has_secret,
        "redirect_uri": redirect_uri,
        "standard_fyers_redirect_url": STANDARD_FYERS_REDIRECT_URI,
        "default_callback_url": default_callback,
        "has_token": has_token,
        "status": status,
        "profile": profile,
        "token_updated_at": saved.get("token_updated_at", "")
    }

@app.post("/api/fyers/credentials")
def save_fyers_credentials(req: fyers_auth.FyersCredentialsRequest):
    saved = fyers_auth.load_fyers_config()
    saved["app_id"] = req.app_id.strip()
    if req.secret_key:
        saved["secret_key"] = req.secret_key.strip()
    if req.redirect_uri:
        saved["redirect_uri"] = req.redirect_uri.strip()
    saved["enabled"] = req.enabled
    fyers_auth.save_fyers_config(saved)
    return {"status": "ok", "message": "Fyers App credentials saved"}

@app.post("/api/fyers/auth-url")
def get_fyers_auth_url(req: fyers_auth.FyersAuthUrlRequest, request: Request):
    saved = fyers_auth.load_fyers_config()
    app_id = (req.app_id or saved.get("app_id", "")).strip()
    secret_key = (req.secret_key or saved.get("secret_key", "")).strip()

    host = request.headers.get("host", "127.0.0.1:8000")
    scheme = "https" if request.headers.get("x-forwarded-proto") == "https" or "render.com" in host else "http"
    default_redirect = f"{scheme}://{host}/api/fyers/callback"
    redirect_uri = (req.redirect_uri or saved.get("redirect_uri", "") or STANDARD_FYERS_REDIRECT_URI).strip()

    if not app_id:
        return {"status": "error", "message": "Fyers App ID is required. Copy it from myapi.fyers.in"}
    if not secret_key:
        return {"status": "error", "message": "Fyers Secret Key is required. Copy it from myapi.fyers.in"}

    saved["app_id"] = app_id
    saved["secret_key"] = secret_key
    saved["redirect_uri"] = redirect_uri
    fyers_auth.save_fyers_config(saved)

    try:
        from fyers_apiv3 import fyersModel
        session = fyersModel.SessionModel(
            client_id=app_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type="code",
            grant_type="authorization_code"
        )
        auth_url = session.generate_authcode()
        return {
            "status": "ok",
            "auth_url": auth_url,
            "redirect_uri": redirect_uri,
            "app_id": app_id
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to generate Fyers login URL: {str(e)}"}

@app.post("/api/fyers/exchange-token")
def exchange_fyers_token(req: fyers_auth.FyersExchangeTokenRequest, request: Request):
    raw_code = req.auth_code.strip()
    if not raw_code:
        return {"status": "error", "message": "Auth code or redirect URL is required."}

    clean_code = fyers_auth.extract_fyers_code(raw_code)

    saved = fyers_auth.load_fyers_config()
    app_id = (req.app_id or saved.get("app_id", "")).strip()
    secret_key = (req.secret_key or saved.get("secret_key", "")).strip()

    host = request.headers.get("host", "127.0.0.1:8000")
    scheme = "https" if request.headers.get("x-forwarded-proto") == "https" or "render.com" in host else "http"
    default_redirect = f"{scheme}://{host}/api/fyers/callback"
    redirect_uri = (req.redirect_uri or saved.get("redirect_uri", "") or STANDARD_FYERS_REDIRECT_URI).strip()

    if not app_id or not secret_key:
        return {"status": "error", "message": "App ID and Secret Key are required to exchange token."}

    try:
        from fyers_apiv3 import fyersModel
        session = fyersModel.SessionModel(
            client_id=app_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type="code",
            grant_type="authorization_code"
        )
        session.set_token(clean_code)
        token_res = session.generate_token()

        if not token_res or token_res.get("s") != "ok":
            err_msg = token_res.get("message") if isinstance(token_res, dict) else str(token_res)
            return {"status": "error", "message": f"Fyers Token Generation Failed: {err_msg}"}

        access_token = token_res.get("access_token")
        if not access_token:
            return {"status": "error", "message": "No access token returned by Fyers."}

        client = fyersModel.FyersModel(client_id=app_id, token=access_token, is_async=False, log_path=None)
        profile_res = client.get_profile()
        profile_data = profile_res.get("data", {}) if (profile_res and profile_res.get("s") == "ok") else {}

        saved["app_id"] = app_id
        saved["secret_key"] = secret_key
        saved["redirect_uri"] = redirect_uri
        saved["access_token"] = access_token
        saved["enabled"] = True
        saved["profile"] = profile_data
        saved["token_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        fyers_auth.save_fyers_config(saved)

        global _fyers_client_cache, _fyers_client_token, _fyers_client_app_id
        _fyers_client_cache = None
        _fyers_client_token = ""
        _fyers_client_app_id = ""

        return {
            "status": "ok",
            "message": f"Successfully connected to Fyers! Welcome, {profile_data.get('name', 'Trader')}.",
            "profile": profile_data,
            "access_token_masked": access_token[:8] + "..." + access_token[-6:]
        }
    except Exception as e:
        return {"status": "error", "message": f"Token exchange error: {str(e)}"}

@app.get("/api/fyers/callback", response_class=HTMLResponse)
def fyers_callback(
    code: Optional[str] = None,
    auth_code: Optional[str] = None,
    s: Optional[str] = None,
    state: Optional[str] = None,
    request: Request = None
):
    received_code = code or auth_code
    if not received_code:
        return HTMLResponse(content=fyers_auth.render_callback_error("No authorization code received in callback URL."), status_code=400)

    saved = fyers_auth.load_fyers_config()
    app_id = saved.get("app_id", "").strip()
    secret_key = saved.get("secret_key", "").strip()
    redirect_uri = saved.get("redirect_uri", "").strip()

    if not redirect_uri and request:
        host = request.headers.get("host", "127.0.0.1:8000")
        scheme = "https" if request.headers.get("x-forwarded-proto") == "https" or "render.com" in host else "http"
        redirect_uri = f"{scheme}://{host}/api/fyers/callback"

    if not app_id or not secret_key:
        return HTMLResponse(content=fyers_auth.render_callback_error("Missing Fyers App ID or Secret Key on server. Please configure credentials in settings."), status_code=400)

    try:
        from fyers_apiv3 import fyersModel
        session = fyersModel.SessionModel(
            client_id=app_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type="code",
            grant_type="authorization_code"
        )
        session.set_token(received_code)
        token_res = session.generate_token()

        if not token_res or token_res.get("s") != "ok":
            msg = token_res.get("message") if isinstance(token_res, dict) else str(token_res)
            return HTMLResponse(content=fyers_auth.render_callback_error(f"Fyers Token Generation Error: {msg}"), status_code=400)

        access_token = token_res.get("access_token")
        client = fyersModel.FyersModel(client_id=app_id, token=access_token, is_async=False, log_path=None)
        profile_res = client.get_profile()
        profile_data = profile_res.get("data", {}) if (profile_res and profile_res.get("s") == "ok") else {}

        saved["access_token"] = access_token
        saved["enabled"] = True
        saved["profile"] = profile_data
        saved["token_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        fyers_auth.save_fyers_config(saved)

        global _fyers_client_cache, _fyers_client_token, _fyers_client_app_id
        _fyers_client_cache = None
        _fyers_client_token = ""
        _fyers_client_app_id = ""

        return HTMLResponse(content=fyers_auth.render_callback_success(profile_data))
    except Exception as e:
        return HTMLResponse(content=fyers_auth.render_callback_error(str(e)), status_code=500)

@app.post("/api/fyers/disconnect")
def disconnect_fyers():
    saved = fyers_auth.load_fyers_config()
    saved["access_token"] = ""
    saved["profile"] = {}
    saved["enabled"] = False
    fyers_auth.save_fyers_config(saved)

    global _fyers_client_cache, _fyers_client_token, _fyers_client_app_id
    _fyers_client_cache = None
    _fyers_client_token = ""
    _fyers_client_app_id = ""

    return {"status": "ok", "message": "Fyers account disconnected."}

@app.post("/api/fyers/config")
@app.post("/api/dhan/config")
def save_fyers_config(req: fyers_auth.FyersConfigRequest):
    app_id = req.app_id.strip()
    access_token = req.access_token.strip()
    enabled = req.enabled

    test_status = "Connected"
    error_msg = ""
    profile_data = {}

    if enabled and app_id and access_token:
        try:
            from fyers_apiv3 import fyersModel
            client = FyersModel(client_id=app_id, token=access_token, is_async=False, log_path=None)
            res = client.get_profile()
            if res and res.get("s") == "ok":
                profile_data = res.get("data", {})
                name = profile_data.get("name", "")
                test_status = "Connected"
                error_msg = f"Connected to Fyers ({name})" if name else "Connected to Fyers"
            else:
                msg = res.get("message") if isinstance(res, dict) else str(res)
                error_msg = msg or "Authentication failed. Check your App ID and Access Token."
                test_status = "Auth Failed"
        except Exception as e:
            error_msg = str(e)
            test_status = f"Error: {error_msg}"

    saved = fyers_auth.load_fyers_config()
    saved["app_id"] = app_id
    saved["access_token"] = access_token
    saved["enabled"] = enabled
    if req.secret_key:
        saved["secret_key"] = req.secret_key.strip()
    if req.redirect_uri:
        saved["redirect_uri"] = req.redirect_uri.strip()
    if profile_data:
        saved["profile"] = profile_data
        saved["token_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    fyers_auth.save_fyers_config(saved)

    global _fyers_client_cache, _fyers_client_token, _fyers_client_app_id
    _fyers_client_cache = None
    _fyers_client_token = ""
    _fyers_client_app_id = ""

    return {
        "status": "ok",
        "connection_status": test_status,
        "enabled": enabled,
        "profile": profile_data,
        "message": error_msg or "Fyers settings saved successfully"
    }

@app.get("/fyers-auth", response_class=HTMLResponse)
def fyers_auth_standalone_page():
    return HTMLResponse(content=fyers_auth.render_fyers_auth_standalone())

@app.get("/api/watchlist")
def get_watchlist():
    """Retrieve watchlist with latest prices."""
    results = []
    # Curated top Indian assets
    curated = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATAMOTORS", "SBIN", "BHARTIARTL", "ITC", "ZOMATO", "HAL", "NIFTY50", "BANKNIFTY"]
    for sym in curated:
        info = next((s for s in SUPPORTED_SYMBOLS if s["symbol"] == sym), {
            "symbol": sym, "name": sym, "category": "Indian Stocks", "icon": "🇮🇳", "precision": 2
        })
        base_p = get_base_price_for_symbol(sym)
        results.append({
            **info,
            "price": base_p,
            "changePercent": round(random.uniform(-1.5, 2.5), 2),
            "high": round(base_p * 1.015, 2),
            "low": round(base_p * 0.985, 2)
        })
    return {"status": "ok", "watchlist": results}

# ================= PAPER TRADING API =================

class OrderRequest(BaseModel):
    symbol: str
    side: str        # "BUY" or "SELL"
    order_type: str  # "MARKET" or "LIMIT"
    qty: float
    price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None

@app.get("/api/paper/account")
def get_paper_account():
    """Get current virtual paper trading portfolio balance & positions."""
    return PAPER_ACCOUNT

@app.post("/api/paper/order")
def place_order(order: OrderRequest):
    """Execute or queue a virtual paper trading order."""
    exec_price = order.price if order.order_type == "LIMIT" and order.price else 82000.0
    # Calculate notional value
    notional = order.qty * exec_price
    
    if order.side == "BUY" and PAPER_ACCOUNT["balance"] < notional:
        raise HTTPException(status_code=400, detail="Insufficient virtual balance")

    order_id = f"ord_{int(time.time() * 1000)}"
    order_record = {
        "id": order_id,
        "symbol": order.symbol,
        "side": order.side,
        "order_type": order.order_type,
        "qty": order.qty,
        "price": exec_price,
        "take_profit": order.take_profit,
        "stop_loss": order.stop_loss,
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "status": "FILLED"
    }

    # Update balance & positions
    if order.side == "BUY":
        PAPER_ACCOUNT["balance"] -= notional
        if order.symbol in PAPER_ACCOUNT["positions"]:
            pos = PAPER_ACCOUNT["positions"][order.symbol]
            new_qty = pos["qty"] + order.qty
            pos["avg_price"] = (pos["avg_price"] * pos["qty"] + exec_price * order.qty) / new_qty
            pos["qty"] = new_qty
        else:
            PAPER_ACCOUNT["positions"][order.symbol] = {
                "symbol": order.symbol,
                "side": "LONG",
                "qty": order.qty,
                "avg_price": exec_price,
                "current_price": exec_price,
                "pnl": 0.0,
                "pnl_pct": 0.0
            }
    else:  # SELL
        if order.symbol in PAPER_ACCOUNT["positions"]:
            pos = PAPER_ACCOUNT["positions"][order.symbol]
            realized = (exec_price - pos["avg_price"]) * min(pos["qty"], order.qty)
            PAPER_ACCOUNT["realized_pnl"] += realized
            PAPER_ACCOUNT["balance"] += notional
            if pos["qty"] <= order.qty:
                del PAPER_ACCOUNT["positions"][order.symbol]
            else:
                pos["qty"] -= order.qty
        else:
            # Short position
            PAPER_ACCOUNT["positions"][order.symbol] = {
                "symbol": order.symbol,
                "side": "SHORT",
                "qty": order.qty,
                "avg_price": exec_price,
                "current_price": exec_price,
                "pnl": 0.0,
                "pnl_pct": 0.0
            }
            PAPER_ACCOUNT["balance"] += notional

    PAPER_ACCOUNT["orders"].insert(0, order_record)
    return {"status": "ok", "order": order_record, "account": PAPER_ACCOUNT}

@app.post("/api/paper/reset")
def reset_paper_account():
    """Reset paper trading account back to $100,000."""
    PAPER_ACCOUNT["balance"] = 100000.00
    PAPER_ACCOUNT["equity"] = 100000.00
    PAPER_ACCOUNT["realized_pnl"] = 0.0
    PAPER_ACCOUNT["unrealized_pnl"] = 0.0
    PAPER_ACCOUNT["positions"] = {}
    PAPER_ACCOUNT["orders"] = []
    return {"status": "ok", "account": PAPER_ACCOUNT}

# ================= FYERS & UNIFIED ORDERS API =================

class FyersOrderRequest(BaseModel):
    symbol: str
    transaction_type: str = "BUY"  # BUY or SELL
    quantity: int = 1
    order_type: str = "MARKET"     # MARKET or LIMIT
    product_type: str = "INTRADAY" # CNC, INTRADAY, MARGIN
    price: float = 0.0
    trigger_price: float = 0.0
    validity: str = "DAY"
    mode: str = "auto"             # "fyers", "paper", or "auto"

class FyersModifyOrderRequest(BaseModel):
    order_id: str
    order_type: str = "LIMIT"
    quantity: int = 1
    price: float = 0.0
    trigger_price: float = 0.0
    validity: str = "DAY"
    mode: str = "auto"

@app.get("/api/fyers/orders")
@app.get("/api/dhan/orders")
def get_fyers_orders():
    """Retrieve all orders from Fyers if connected, or virtual paper orders."""
    client = get_fyers_client()
    fyers_connected = client is not None
    fyers_orders = []
    error_msg = None

    if fyers_connected:
        try:
            res = client.orderbook()
            if isinstance(res, dict) and res.get("s") == "ok":
                raw_book = res.get("orderBook") or []
                status_map = {1: "CANCELLED", 2: "TRADED", 4: "TRANSIT", 5: "REJECTED", 6: "PENDING"}
                for o in raw_book:
                    st = status_map.get(o.get("status"), str(o.get("status", "UNKNOWN")))
                    side_str = "BUY" if o.get("side") == 1 else "SELL"
                    type_str = "MARKET" if o.get("type") == 2 else "LIMIT"
                    clean_sym = o.get("symbol", "").replace("NSE:", "").replace("-EQ", "").replace("-INDEX", "")
                    fyers_orders.append({
                        "orderId": str(o.get("id")),
                        "tradingSymbol": clean_sym,
                        "symbol": clean_sym,
                        "transactionType": side_str,
                        "orderType": type_str,
                        "productType": o.get("productType", "INTRADAY"),
                        "quantity": o.get("qty", 0),
                        "filled_qty": o.get("filledQty", 0),
                        "price": o.get("limitPrice", 0),
                        "triggerPrice": o.get("stopPrice", 0),
                        "orderStatus": st,
                        "orderTimestamp": o.get("orderDateTime", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                        "source": "fyers",
                        "raw": o
                    })
            elif isinstance(res, dict) and res.get("message"):
                error_msg = res.get("message")
        except Exception as e:
            error_msg = str(e)
            print(f"Error fetching Fyers orders: {e}")

    return {
        "status": "success",
        "fyers_connected": fyers_connected,
        "dhan_connected": fyers_connected,
        "fyers_orders": fyers_orders,
        "dhan_orders": fyers_orders,
        "paper_orders": PAPER_ACCOUNT.get("orders", []),
        "error": error_msg
    }

@app.post("/api/fyers/orders")
@app.post("/api/dhan/orders")
def place_fyers_order(req: FyersOrderRequest):
    """Place an order directly to Fyers or fallback to Paper Trading."""
    client = get_fyers_client()
    is_fyers_ready = client is not None
    should_route_fyers = (req.mode in ["fyers", "dhan"]) or (req.mode == "auto" and is_fyers_ready)

    clean_sym = req.symbol.upper().replace(".NS", "").replace(".BO", "").rstrip(".")
    fyers_sym = to_fyers_symbol(req.symbol)

    if should_route_fyers:
        if not is_fyers_ready:
            raise HTTPException(status_code=400, detail="Fyers client is not connected or credentials not configured.")
        
        if "-INDEX" in fyers_sym:
            raise HTTPException(status_code=400, detail=f"'{req.symbol}' is an Index and cannot be traded directly as spot cash. Use an ETF (e.g. NIFTYBEES) or Paper Trading.")

        fyers_side = 1 if req.transaction_type.upper() == "BUY" else -1
        fyers_type = 2 if req.order_type.upper() == "MARKET" else 1

        try:
            order_data = {
                "symbol": fyers_sym,
                "qty": int(req.quantity),
                "type": fyers_type,
                "side": fyers_side,
                "productType": req.product_type.upper() if req.product_type.upper() in ["CNC", "INTRADAY", "MARGIN"] else "INTRADAY",
                "limitPrice": float(req.price) if fyers_type == 1 and req.price else 0.0,
                "stopPrice": float(req.trigger_price) if req.trigger_price else 0.0,
                "validity": req.validity.upper() if req.validity else "DAY",
                "disclosedQty": 0,
                "offlineOrder": False,
                "isSliceOrder": False
            }
            res = client.place_order(data=order_data)

            if isinstance(res, dict) and res.get("s") != "ok":
                err_msg = res.get("message") or "Order rejected by Fyers."
                raise HTTPException(status_code=400, detail=f"Fyers rejection: {err_msg}")

            order_id = res.get("id") if isinstance(res, dict) else str(int(time.time()))
            return {
                "status": "success",
                "source": "fyers",
                "message": f"Fyers order submitted for {clean_sym}",
                "data": res,
                "orderId": order_id
            }
        except HTTPException:
            raise
        except Exception as e:
            print(f"Fyers place_order error: {e}")
            raise HTTPException(status_code=400, detail=f"Fyers error: {str(e)}")

    # Route to Paper Trading
    exec_price = req.price if req.order_type.upper() == "LIMIT" and req.price > 0 else get_base_price_for_symbol(req.symbol)
    notional = req.quantity * exec_price
    if req.transaction_type.upper() == "BUY" and PAPER_ACCOUNT["balance"] < notional:
        raise HTTPException(status_code=400, detail="Insufficient paper balance")

    order_id = f"paper_{int(time.time() * 1000)}"
    order_record = {
        "orderId": order_id,
        "tradingSymbol": clean_sym,
        "transactionType": req.transaction_type.upper(),
        "orderType": req.order_type.upper(),
        "productType": req.product_type.upper(),
        "quantity": req.quantity,
        "filled_qty": req.quantity if req.order_type.upper() == "MARKET" else 0,
        "price": exec_price,
        "triggerPrice": req.trigger_price,
        "orderStatus": "TRADED" if req.order_type.upper() == "MARKET" else "PENDING",
        "orderTimestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "source": "paper"
    }
    PAPER_ACCOUNT["orders"].insert(0, order_record)

    if order_record["orderStatus"] == "TRADED":
        if req.transaction_type.upper() == "BUY":
            PAPER_ACCOUNT["balance"] -= notional
            pos = PAPER_ACCOUNT["positions"].get(clean_sym, {"qty": 0, "avg_price": 0.0})
            total_qty = pos["qty"] + req.quantity
            total_cost = (pos["qty"] * pos["avg_price"]) + notional
            pos["avg_price"] = total_cost / total_qty if total_qty > 0 else exec_price
            pos["qty"] = total_qty
            PAPER_ACCOUNT["positions"][clean_sym] = pos
        else:
            PAPER_ACCOUNT["balance"] += notional
            pos = PAPER_ACCOUNT["positions"].get(clean_sym, {"qty": 0, "avg_price": 0.0})
            pos["qty"] -= req.quantity
            PAPER_ACCOUNT["positions"][clean_sym] = pos

    return {
        "status": "success",
        "source": "paper",
        "message": f"Paper order placed for {clean_sym}",
        "data": order_record
    }

@app.put("/api/fyers/orders/{order_id}")
@app.put("/api/dhan/orders/{order_id}")
def modify_fyers_order(order_id: str, req: FyersModifyOrderRequest):
    """Modify an existing pending order (Fyers or Paper)."""
    client = get_fyers_client()
    if client and not order_id.startswith("paper_"):
        try:
            fyers_type = 2 if req.order_type.upper() == "MARKET" else 1
            mod_data = {
                "id": str(order_id),
                "type": fyers_type,
                "qty": int(req.quantity),
                "limitPrice": float(req.price) if req.price else 0.0
            }
            if req.trigger_price:
                mod_data["stopPrice"] = float(req.trigger_price)
            res = client.modify_order(data=mod_data)
            if isinstance(res, dict) and res.get("s") != "ok":
                raise HTTPException(status_code=400, detail=res.get("message", "Fyers order modification rejected"))
            return {"status": "success", "source": "fyers", "data": res}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Fyers modify_order error: {e}")
            raise HTTPException(status_code=400, detail=f"Fyers error: {str(e)}")

    for o in PAPER_ACCOUNT["orders"]:
        if o.get("orderId") == order_id:
            if o.get("orderStatus") in ["TRADED", "CANCELLED", "REJECTED"]:
                raise HTTPException(status_code=400, detail=f"Cannot modify order with status {o.get('orderStatus')}")
            o["quantity"] = int(req.quantity)
            o["price"] = float(req.price)
            if req.trigger_price:
                o["triggerPrice"] = float(req.trigger_price)
            o["orderType"] = req.order_type.upper()
            return {"status": "success", "source": "paper", "data": o}

    raise HTTPException(status_code=404, detail="Order not found")

@app.delete("/api/fyers/orders/{order_id}")
@app.delete("/api/dhan/orders/{order_id}")
def cancel_fyers_order(order_id: str):
    """Cancel a pending order (Fyers or Paper)."""
    client = get_fyers_client()
    if client and not order_id.startswith("paper_"):
        try:
            res = client.cancel_order(data={"id": str(order_id)})
            if isinstance(res, dict) and res.get("s") != "ok":
                raise HTTPException(status_code=400, detail=res.get("message", "Fyers order cancellation rejected"))
            return {"status": "success", "source": "fyers", "data": res}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Fyers cancel_order error: {e}")
            raise HTTPException(status_code=400, detail=f"Fyers error: {str(e)}")

    for o in PAPER_ACCOUNT["orders"]:
        if o.get("orderId") == order_id:
            if o.get("orderStatus") in ["TRADED", "CANCELLED", "REJECTED"]:
                raise HTTPException(status_code=400, detail=f"Cannot cancel order with status {o.get('orderStatus')}")
            o["orderStatus"] = "CANCELLED"
            return {"status": "success", "source": "paper", "data": o}

    raise HTTPException(status_code=404, detail="Order not found")

# ================= USER AUTHENTICATION & MULTI-TENANCY =================

class LoginRequest(BaseModel):
    username: str
    password: str
    auth_code: Optional[str] = ""

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = ""
    role: str = "user"

class ApproveUserRequest(BaseModel):
    auth_code: Optional[str] = None

class UserStatusRequest(BaseModel):
    is_active: bool

class ResetPasswordRequest(BaseModel):
    new_password: str

def get_current_user_opt(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return database.get_user_by_token(parts[1])
    return None

def get_current_user(authorization: Optional[str] = Header(None)):
    user = get_current_user_opt(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in to continue")
    return user

def get_admin_user(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    """Register a new user account (pending admin approval on Control Panel)."""
    if not req.username or len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    email = req.email.strip() if req.email else ""
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required (e.g. name@example.com)")

    # Check if email is already taken
    existing_email_user = database.get_user_by_email(email)
    if existing_email_user:
        raise HTTPException(status_code=400, detail="This email address is already registered")

    try:
        user = database.create_pending_user(
            username=req.username.strip(),
            password=req.password,
            email=email
        )

        return {
            "status": "pending_approval",
            "message": "Registration submitted! Your account has been submitted to the administrator for authorization. Once approved, the administrator will provide your 10-character authorization code.",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "approval_status": "pending"
            }
        }
    except Exception as e:
        if "UNIQUE constraint failed: users.username" in str(e):
            raise HTTPException(status_code=400, detail="Username already taken")
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login")
def login(req: LoginRequest):
    """Authenticate username, password, and 10-character authorization code."""
    auth = database.authenticate_user(req.username, req.password, auth_code=req.auth_code or "")
    if auth == "PENDING":
        raise HTTPException(
            status_code=403,
            detail="Your account is awaiting administrator approval. Please contact the administrator for your 10-character authorization code."
        )
    if auth == "REJECTED":
        raise HTTPException(
            status_code=403,
            detail="Your registration request was declined by the administrator."
        )
    if auth == "INACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated by administrator."
        )
    if auth == "CODE_REQUIRED":
        raise HTTPException(
            status_code=400,
            detail="A 10-character authorization code is required. Please enter the code provided by the administrator."
        )
    if auth == "INVALID_CODE":
        raise HTTPException(
            status_code=400,
            detail="Invalid 10-character authorization code. Please verify the code provided by the administrator."
        )
    if not auth:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "status": "success",
        "user": {
            "id": auth["id"],
            "username": auth["username"],
            "email": auth["email"],
            "role": auth["role"],
            "approval_status": auth.get("approval_status", "approved"),
            "last_login": auth["last_login"]
        },
        "token": auth["token"]
    }

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Terminate current user session."""
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            database.logout_user(parts[1])
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/auth/me")
def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {"status": "success", "user": user}

# ================= USER SETTINGS & PROFILES =================

@app.get("/api/user/settings")
def get_settings(user: dict = Depends(get_current_user)):
    """Load current user's personalized chart, layout, indicator, and watchlist settings."""
    settings = database.get_user_settings(user["id"])
    return {
        "status": "success",
        "username": user["username"],
        "settings": settings
    }

@app.post("/api/user/settings")
def save_settings(settings: dict, user: dict = Depends(get_current_user)):
    """Save current user's personalized settings to their profile."""
    database.save_user_settings(user["id"], settings)
    return {"status": "success", "message": "Settings saved to user profile"}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/user/change-password")
def user_change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Allow current user / admin to change their password."""
    if not req.new_password or len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    ok = database.change_password(user["id"], req.current_password, req.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Incorrect current password")
    return {"status": "success", "message": "Password changed successfully"}

# ================= ADMIN PANEL & TRAFFIC ANALYTICS =================

@app.get("/api/admin/stats")
def get_admin_dashboard_stats(admin: dict = Depends(get_admin_user)):
    """Get high-level traffic, user counts, and platform activity."""
    stats = database.get_traffic_stats()
    return {"status": "success", "data": stats}

@app.get("/api/admin/users")
def get_admin_users_list(admin: dict = Depends(get_admin_user)):
    """Get complete user registry with activity timestamps."""
    users = database.list_all_users()
    return {"status": "success", "users": users}

@app.post("/api/admin/users")
def admin_create_user(req: CreateUserRequest, admin: dict = Depends(get_admin_user)):
    """Create a user account manually (pre-approved with 10-char authorization code)."""
    if not req.username or len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    try:
        user = database.create_user(
            username=req.username.strip(),
            password=req.password,
            email=req.email.strip() if req.email else "",
            role=req.role if req.role in ["user", "admin"] else "user"
        )
        return {"status": "success", "message": f"User '{req.username}' created! Authorization Code: {user.get('auth_code', '')}", "user": user}
    except Exception as e:
        if "UNIQUE constraint failed: users.username" in str(e):
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/admin/users/{user_id}/status")
def admin_set_user_status(user_id: int, req: UserStatusRequest, admin: dict = Depends(get_admin_user)):
    """Activate or deactivate user account access."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own admin account")
    database.update_user_status(user_id, req.is_active)
    state = "activated" if req.is_active else "deactivated"
    return {"status": "success", "message": f"User account {state}"}

@app.put("/api/admin/users/{user_id}/reset-password")
def admin_reset_user_password(user_id: int, req: ResetPasswordRequest, admin: dict = Depends(get_admin_user)):
    """Reset a user's password."""
    if not req.new_password or len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    database.reset_user_password(user_id, req.new_password)
    return {"status": "success", "message": "Password reset successfully"}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin: dict = Depends(get_admin_user)):
    """Delete a user account and their settings."""
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    database.delete_user(user_id)
    return {"status": "success", "message": "User deleted successfully"}

@app.get("/api/admin/activity")
def get_admin_recent_activity(limit: int = 50, admin: dict = Depends(get_admin_user)):
    """View recent traffic requests, IP addresses, and user activity."""
    logs = database.get_recent_activity(limit=limit)
    return {"status": "success", "activity": logs}



@app.get("/api/admin/pending-users")
def get_admin_pending_users(admin: dict = Depends(get_admin_user)):
    """List all user registration requests awaiting admin approval."""
    pending = database.get_pending_users()
    return {"status": "success", "pending_users": pending, "count": len(pending)}

@app.post("/api/admin/users/{user_id}/approve")
def admin_approve_user(user_id: int, req: ApproveUserRequest = None, admin: dict = Depends(get_admin_user)):
    """Approve a pending user, generate 10-character auth code for admin to provide manually."""
    custom_code = req.auth_code if req and req.auth_code else None
    approved_user = database.approve_user(user_id, custom_code=custom_code)
    if not approved_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "status": "success",
        "message": f"User '{approved_user['username']}' approved! Authorization Code: {approved_user['auth_code']}",
        "user": approved_user,
        "auth_code": approved_user["auth_code"]
    }

@app.post("/api/admin/users/{user_id}/regenerate-code")
def admin_regenerate_user_code(user_id: int, admin: dict = Depends(get_admin_user)):
    """Regenerate a new 10-character authorization code for an approved user."""
    new_code = database.generate_10char_auth_code()
    approved_user = database.approve_user(user_id, custom_code=new_code)
    if not approved_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "message": f"Generated new Authorization Code: {new_code}",
        "auth_code": new_code,
        "user": approved_user
    }

@app.post("/api/admin/users/{user_id}/reject")
def admin_reject_user(user_id: int, admin: dict = Depends(get_admin_user)):
    """Reject a pending registration request."""
    rejected_user = database.reject_user(user_id)
    if not rejected_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": f"User registration for '{rejected_user['username']}' declined"}

@app.post("/api/admin/users/{user_id}/resend-code")
def admin_resend_code(user_id: int, admin: dict = Depends(get_admin_user)):
    """Resend 10-character authorization code to an approved user's email."""
    conn = database.get_connection()
    c = conn.cursor()
    c.execute('SELECT id, username, email, auth_code, approval_status FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    user = dict(row)
    if not user.get("auth_code"):
        code = database.generate_10char_auth_code()
        database.approve_user(user_id, custom_code=code)
        user["auth_code"] = code

        email_service.send_user_approval_code_email(
        username=user["username"],
        user_email=user["email"],
        auth_code=user["auth_code"]
    )
    return {"status": "success", "message": f"Authorization code resent to {user['email']}", "auth_code": user["auth_code"]}


# ================= STATIC & ROOT =================

# Mount the static directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def serve_index():
    """Serve the single page application with no-cache headers."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        response = FileResponse(index_path)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    return HTMLResponse("<h3>TradingChart is loading...</h3>")

@app.get("/api/admin/db-info")
def get_admin_db_info(admin: dict = Depends(get_admin_user)):
    """Get database file size and statistics."""
    info = database.get_database_file_info()
    user_stats = database.get_traffic_stats()
    info["total_users"] = user_stats.get("total_users", 0)
    info["pending_approvals"] = user_stats.get("pending_approvals", 0)
    return {"status": "success", "db_info": info}

@app.get("/api/admin/backup-db")
def admin_download_backup(admin: dict = Depends(get_admin_user)):
    """Safely download an atomic SQLite hot backup of trading_platform.db."""
    temp_dir = tempfile.gettempdir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"trading_platform_backup_{timestamp}.db"
    backup_path = os.path.join(temp_dir, backup_filename)

    database.backup_database(backup_path)

    return FileResponse(
        backup_path,
        media_type="application/x-sqlite3",
        filename=backup_filename,
        headers={"Content-Disposition": f"attachment; filename={backup_filename}"}
    )

@app.post("/api/admin/restore-db")
async def admin_upload_restore(request: Request, admin: dict = Depends(get_admin_user)):
    """Restore trading_platform.db from an uploaded SQLite backup file."""
    content = await request.body()
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or too small to be a database.")

    temp_dir = tempfile.gettempdir()
    temp_file = os.path.join(temp_dir, f"restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")

    try:
        with open(temp_file, "wb") as f:
            f.write(content)

        res = database.restore_database(temp_file)
        return {
            "status": "success",
            "message": f"Database successfully restored! Found {res['user_count']} user accounts.",
            "user_count": res["user_count"]
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database restore failed: {str(e)}")
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass

if __name__ == "__main__":
    import uvicorn
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    print("\n" + "=" * 60)
    print(" [*] TradingView Multi-Chart Platform Starting...")
    print(" [*] Local Server: http://localhost:8000")
    print(" [*] Real-Time Multi-Chart Engine Ready")
    print("=" * 60 + "\n")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend:app", host="0.0.0.0", port=port, reload=False)
