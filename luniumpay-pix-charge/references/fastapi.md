# FastAPI (Python 3.10+) — receber Pix e cair em USDT

`pip install fastapi uvicorn httpx`

```python
import hmac, hashlib, os, re, time, json
import httpx
from fastapi import FastAPI, Request, HTTPException

BASE = "https://api.luniumpay.com"
KEY = os.environ["LUNIUM_API_KEY"]
SECRET = os.environ.get("LUNIUM_WEBHOOK_SECRET", "")
IS_SANDBOX = KEY.startswith("lun_test_")
H = {"X-API-Key": KEY, "Content-Type": "application/json"}
DESTINO = os.environ.get("LUNIUM_DESTINO") or ("cripto" if os.environ.get("LUNIUM_PAYOUT_ADDRESS") else "saldo")

def documento_valido(doc: str) -> bool:
    """CPF (11) ou CNPJ (14) com dígito verificador. A API não valida o DV; documento errado vira Pix devolvido."""
    d = re.sub(r"\D", "", str(doc))
    if len(set(d)) < 2:
        return False
    def dv(base: str, pesos) -> int:
        r = sum(int(n) * p for n, p in zip(base, pesos)) % 11
        return 0 if r < 2 else 11 - r
    if len(d) == 11:
        return dv(d[:9], range(10, 1, -1)) == int(d[9]) and dv(d[:10], range(11, 1, -1)) == int(d[10])
    if len(d) == 14:
        p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        return dv(d[:12], p1) == int(d[12]) and dv(d[:13], [6] + p1) == int(d[13])
    return False

app = FastAPI()

async def lunium(method: str, path: str, body: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, BASE + path, headers=H, json=body)
    data = r.json()
    if r.status_code >= 400:
        # data["erro"], data["acao"], data["agent_guidance"] orientam o próximo passo
        raise HTTPException(status_code=400 if r.status_code < 500 else 502, detail=data)
    return data

@app.post("/cobrancas")
async def criar(p: dict):
    if not documento_valido(p["payer_tax_number"]):
        raise HTTPException(400, {"erro": "documento_invalido", "acao": "corrigir", "detail": "CPF/CNPJ do pagador inválido"})
    body = {
        "amount_cents": int(p["amount_cents"]),
        "payer_tax_number": re.sub(r"\D", "", p["payer_tax_number"]),
        "destino": DESTINO,
        "external_id": f"pedido-{p['pedido_id']}",   # grave o pedido ANTES; reutilize no retry
    }
    if DESTINO == "cripto":
        body.update({"asset": "USDT", "chain": os.environ.get("LUNIUM_CHAIN", "polygon"),
                     "payout_address": os.environ["LUNIUM_PAYOUT_ADDRESS"]})
    if IS_SANDBOX:
        body["sandbox_scenario"] = "success"
    c = await lunium("POST", "/cashin/charge", body)
    return {"cashin_id": c["cashin_id"], "qr_image_url": c["qr_image_url"],
            "qr_copypaste": c["qr_copypaste"], "expires_at": c["expires_at"]}

@app.get("/cobrancas/{cashin_id}")
async def status(cashin_id: str):
    s = await lunium("GET", f"/cashin/{cashin_id}/status")
    return {"status": s["status"], "settlement": s.get("settlement_status"),
            "proof": s.get("settlement_proof"),
            "liberado": s["status"] == "paid" and s.get("settlement_status") == "sent",
            "tx_url": s.get("settlement_tx_url")}

@app.post("/webhooks/lunium")
async def webhook(req: Request):
    raw = await req.body()                      # bytes crus, antes de qualquer parse
    sig = req.headers.get("x-lunium-signature", "")
    fields = dict(p.strip().split("=", 1) for p in sig.split(",") if "=" in p)
    t, v1 = fields.get("t", ""), fields.get("v1", "")
    if not t.isdigit() or not re.fullmatch(r"[a-fA-F0-9]{64}", v1):
        raise HTTPException(401)
    if abs(time.time() - int(t)) > 300:
        raise HTTPException(401)
    expected = hmac.new(SECRET.encode(), f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, v1.lower()):
        raise HTTPException(401)
    event = json.loads(raw)
    event_id = req.headers.get("x-lunium-event-id") or event.get("event_id")
    # dedupe por event_id (unique), grave, responda 200, processe depois
    return {"ok": True}
```
