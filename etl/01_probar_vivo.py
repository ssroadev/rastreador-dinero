import json, requests, websocket

r = requests.get("https://mempool.space/api/mempool/recent", timeout=10)
print("mempool.space recent:", r.status_code, r.json()[:2])

ws = websocket.create_connection("wss://ws.blockchain.info/inv", timeout=15)
ws.send(json.dumps({"op": "unconfirmed_sub"}))
for _ in range(3):
    msg = json.loads(ws.recv())
    x = msg.get("x", {})
    print("tx en vivo:", x.get("hash"), "salidas:", len(x.get("out", [])))
ws.close()
