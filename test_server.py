import threading
import time
import requests
import uvicorn
from backend import app

def run_uvicorn():
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")

def run_tests():
    # Start server in background thread
    t = threading.Thread(target=run_uvicorn, daemon=True)
    t.start()
    time.sleep(1.5)

    base = "http://127.0.0.1:8001"

    # 1. Test Index
    r = requests.get(f"{base}/")
    assert r.status_code == 200, f"Index failed: {r.status_code}"
    assert "TradeView" in r.text
    print("PASS: / (Index HTML)")

    # 2. Test Symbols
    r = requests.get(f"{base}/api/symbols")
    assert r.status_code == 200
    symbols = r.json().get("symbols", [])
    assert len(symbols) > 0
    print(f"PASS: /api/symbols ({len(symbols)} symbols)")

    # 3. Test History
    r = requests.get(f"{base}/api/history?symbol=BTCUSDT&interval=1h&limit=10")
    assert r.status_code == 200
    res = r.json()
    assert len(res["data"]) > 0
    print(f"PASS: /api/history ({len(res['data'])} candles, source: {res['source']})")

    # 4. Test Quote
    r = requests.get(f"{base}/api/quote?symbol=BTCUSDT")
    assert r.status_code == 200
    print(f"PASS: /api/quote (BTCUSDT: ${r.json()['price']})")

    # 5. Test Watchlist
    r = requests.get(f"{base}/api/watchlist")
    assert r.status_code == 200
    print(f"PASS: /api/watchlist ({len(r.json()['watchlist'])} items)")

    # 6. Test Paper Trading Account
    r = requests.get(f"{base}/api/paper/account")
    assert r.status_code == 200
    print(f"PASS: /api/paper/account (Balance: ${r.json()['balance']})")

    # 7. Test Paper Order
    r = requests.post(f"{base}/api/paper/order", json={
        "symbol": "BTCUSDT",
        "side": "BUY",
        "order_type": "MARKET",
        "qty": 0.1,
        "price": 82000.0
    })
    assert r.status_code == 200
    print("PASS: /api/paper/order (Virtual BUY execution)")

    # 8. Test Static Files
    r = requests.get(f"{base}/static/lightweight-charts.standalone.production.js")
    assert r.status_code == 200
    print(f"PASS: /static/lightweight-charts ({len(r.content)} bytes)")

    r = requests.get(f"{base}/static/css/style.css")
    assert r.status_code == 200
    print("PASS: /static/css/style.css")

    r = requests.get(f"{base}/static/js/app.js")
    assert r.status_code == 200
    print("PASS: /static/js/app.js")

    print("\n=========================================")
    print(" ALL 8 TEST SUITES PASSED SUCCESSFULLY! ")
    print("=========================================\n")

if __name__ == "__main__":
    run_tests()
