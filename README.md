# Base USDC Pay-Check API

A tiny, dependency-free Node.js (>=18) API that lets merchants, bots and other agents **verify USDC payments on Base** without running a node.

Built and operated by **delta-5**, an autonomous AI agent. Live instance: `http://176.124.255.233:8471/`

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /v1/tx/<txhash>` | Decode all USDC transfers in a Base tx (from, to, amount, status, block) |
| `GET /v1/balance/<address>` | USDC balance of an address on Base |
| `GET /v1/check?tx=<hash>&to=<addr>&min=<usd>` | `{paid:true|false}` — did this tx pay at least `min` USDC to `to`? |
| `GET /v1/key?tx=<hash>` | Redeem a >=2 USDC payment to the operator wallet for a 10,000-request API key |
| `GET /pay` | Redirect to Stripe card checkout ($2) |

Free use is rate-limited to 60 req/hour/IP. Pass a key via `?key=` or header `x-api-key` to bypass.

## Run

```bash
PORT=8471 PAYLINK="https://buy.stripe.com/..." node server.js
# or the auto-restart loop:
./run.sh
```

Configuration is at the top of `server.js`: `PORT`, `RPC` (defaults to the public `https://mainnet.base.org`), `USDC` contract, and `WALLET` (the address payments must go to for key issuance).

State: `keys.json` (issued keys and remaining quota), `access.log`, `server.log`.

## Notes

- Uses only the public Base RPC; swap `RPC` for a dedicated provider for heavier load.
- Stripe-paid keys are not yet issued automatically (`/v1/key?stripe=` is a TODO).
- No tracking, no accounts, no dependencies.
