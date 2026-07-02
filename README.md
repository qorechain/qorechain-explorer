# QoreChain Explorer

Public block explorer for QoreChain — mainnet (`qorechain-vladi`) and testnet
(`qorechain-diana`). All data comes straight from the chain's public
endpoints through the app's own read-only proxies; there is no backend, no
authentication, and nothing is fabricated: if an endpoint is down, the UI
says so.

## What it shows

- **Home** — live height, chain status, validators, supply, bonded stake,
  latest blocks and transactions, plus network facts (chain ids, per-VM
  decimals, fee floor), copyable public endpoints, and task-oriented links
  into [docs.qorechain.io](https://docs.qorechain.io).
- **Block** (`/block/{height}`) — header facts and the block's transactions.
- **Transaction** (`/tx/{hash}`) — status, fee, gas, messages, the hybrid
  post-quantum signature marker, and the raw response.
- **Account** (`/address/{qor1…|0x…}`) — the unified identity (one 20-byte
  account shown as `qor1…`, `0x…`, and base58 SVM address) with the single
  balance read through all three VM lanes and a live parity check
  (wei = uqor × 1e12, lamports = uqor × 1000).
- **Validators** (`/validators`) — the validator set with voting power and
  commission.
- **Add to wallet** — Keplr/Leap/Cosmostation (`suggestChain`),
  MetaMask/Rabby/Trust/Coinbase/OKX (EIP-3085; this site is the
  `blockExplorerUrls` base), SVM custom-RPC instructions, and WalletConnect
  v2 pairing for mobile wallets (needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`).

The `/tx/{hash}`, `/block/{height}` and `/address/{addr}` routes are wallet
deep-link compatible (EIP-3085 explorers append `/tx/…` to the base URL).

## Networks

The testnet/mainnet toggle is cookie-based (`qore-network`); the default is
mainnet. Endpoints ship in `chain-data/*.json` (mainnet on `*.qore.host`,
testnet on `*-testnet.qore.host`) and can be overridden per deployment via
`NEXT_PUBLIC_*` env vars — see `.env.example`.

## Develop

```bash
nvm use 20
npm install
npm run dev
```

## Deploy

AWS Amplify — `amplify.yml` is committed; connect the repo, set the env vars
from `.env.example` as needed, and add the custom domain.
