@echo off
title TradeView Multi-Chart Platform
echo =========================================================
echo    TradeView - Multi-Chart Trading Platform
echo =========================================================
echo.
echo Starting FastAPI Web Server at http://localhost:8000 ...
echo.
start http://localhost:8000
python backend.py
pause
