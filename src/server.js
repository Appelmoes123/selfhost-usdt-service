import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

// ---------- Config ----------
const PORT = process.env.PORT || 8787;
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const CHAIN_ID = Number(process.env.CHAIN_ID || 1);
const USDT_ADDRESS = (process.env.USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7').trim();

// Basic ERC20 ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// Multer in-memory storage (do NOT write keystores to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic rate limiting (tweak as needed)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// Serve static UI
app.use(express.static(path.join(process.cwd(), 'public')));

// Single-user in-memory wallet state (keep private, do not persist unencrypted)
let WALLET = null; // ethers.Wallet connected to provider
let PROVIDER = new ethers.JsonRpcProvider(RPC_URL);

// Health
app.get('/health', (_req, res) => res.json({ ok: true, chainId: CHAIN_ID }));

// Import keystore (.m0 / JSON V3) and decrypt
app.post('/import', upload.single('keystore'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: keystore)' });
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const json = req.file.buffer.toString('utf8');
    // Decrypt to wallet (memory only)
    const wallet = await ethers.Wallet.fromEncryptedJson(json, password);
    WALLET = wallet.connect(PROVIDER);

    // Verify chain
    const net = await PROVIDER.getNetwork();
    if (net.chainId !== BigInt(CHAIN_ID)) {
      console.warn(`Warning: provider chainId ${net.chainId} != expected ${CHAIN_ID}`);
    }

    // Balances
    const addr = await WALLET.getAddress();
    const ethBal = await PROVIDER.getBalance(addr);
    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, PROVIDER);
    const [dec, sym, usdtBalRaw] = await Promise.all([
      usdt.decimals(),
      usdt.symbol().catch(() => 'USDT'),
      usdt.balanceOf(addr)
    ]);
    const usdtBal = ethers.formatUnits(usdtBalRaw, dec);

    res.json({
      address: addr,
      chainId: Number(net.chainId),
      ethBalance: ethers.formatEther(ethBal),
      usdt: { address: USDT_ADDRESS, symbol: sym || 'USDT', decimals: dec, balance: usdtBal }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import keystore. Is the password correct and format JSON v3?' });
  }
});

// Send USDT to a recipient
app.post('/send', async (req, res) => {
  try {
    if (!WALLET) return res.status(400).json({ error: 'No wallet loaded. Import a keystore first.' });
    const { to, amount } = req.body;
    if (!to || !amount) return res.status(400).json({ error: 'Fields "to" and "amount" are required' });

    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, WALLET);
    const dec = await usdt.decimals();
    const value = ethers.parseUnits(String(amount), dec);
    const tx = await usdt.transfer(to, value);
    const receipt = await tx.wait();

    res.json({ txHash: tx.hash, receipt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'USDT transfer failed', details: String(err) });
  }
});

// (Optional) Swap endpoint placeholder (Uniswap/1inch integration can be added later)
app.post('/swap-to-usdt', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented. Integrate Uniswap/1inch router here.' });
});

// Fallback to UI
app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Self-host USDT service running on http://localhost:${PORT}`);
  console.log(`Using RPC: ${RPC_URL}`);
});
