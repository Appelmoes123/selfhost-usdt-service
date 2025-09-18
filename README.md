# Self-Host Wallet Service (USDT)

A minimal self-hosted service to:
- import your Ethereum keystore (`.m0` / Web3 JSON v3),
- decrypt it **in memory**,
- show ETH/USDT balances, and
- send USDT to another wallet.

> Swapping into USDT is left as a next step (Uniswap/1inch router integration).

## Requirements
- macOS
- Node.js 18+
- Your own RPC (recommended: Nethermind) running locally at `http://localhost:8545` (default)

## Setup

```bash
# 1) unzip and enter the folder
cd selfhost-usdt-service

# 2) install deps
npm install

# 3) configure environment
cp .env.example .env
# edit .env if needed (RPC_URL, CHAIN_ID, USDT_ADDRESS)

# 4) run
npm run start
# or during development:
npm run dev
```

Open: http://localhost:8787

## Usage

1. **Import keystore**: Upload your `.m0` (JSON v3) file and enter the password.  
   - The private key is decrypted in memory and never written to disk.
2. **Check balance**: The UI shows ETH and USDT balances.
3. **Send USDT**: Enter a recipient and amount, then send.

> You need some ETH for gas (on Ethereum mainnet).

## Security Notes

- Keep the service local (or behind a VPN). Do not expose it to the public internet.
- Never log or persist private keys or passwords.
- Make a small test transfer first.
- If your `.m0` is not standard Web3 JSON v3, convert it first before importing.

## Next Steps: Swaps

To add a swap endpoint:
- Integrate the Uniswap V3 or 1inch SDK to build a swap transaction to USDT.
- Sign with the in-memory wallet and broadcast via your RPC.
- Always verify token addresses and slippage settings.
