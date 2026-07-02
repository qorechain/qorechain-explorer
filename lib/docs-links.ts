/**
 * Curated task-oriented links into the docs site (docs.qorechain.io).
 * Every path is a REAL published Docusaurus slug (source of truth:
 * qorechain-docs/sidebars.ts) — add entries only for pages that exist.
 *
 * @file lib/docs-links.ts
 */

export const DOCS_BASE = "https://docs.qorechain.io";

export interface DocsLink {
  label: string;
  path: string;
  description: string;
}

export interface DocsLinkGroup {
  title: string;
  links: DocsLink[];
}

export const DOCS_LINK_GROUPS: DocsLinkGroup[] = [
  {
    title: "Get started",
    links: [
      { label: "Quickstart", path: "/getting-started/quickstart", description: "From zero to your first interaction" },
      { label: "Wallet setup", path: "/getting-started/wallet-setup", description: "Add QoreChain to your wallet" },
      { label: "Connect to mainnet", path: "/getting-started/connecting-to-mainnet", description: "qorechain-vladi endpoints & config" },
      { label: "Connect to testnet", path: "/getting-started/connecting-to-testnet", description: "qorechain-diana endpoints & faucet" },
      { label: "First transaction", path: "/getting-started/first-transaction", description: "Send QOR step by step" },
    ],
  },
  {
    title: "Use the network",
    links: [
      { label: "Token operations", path: "/user-guide/token-operations", description: "Transfers, balances, denominations" },
      { label: "Staking & delegation", path: "/user-guide/staking-and-delegation", description: "Delegate QOR to validators" },
      { label: "Governance", path: "/user-guide/governance", description: "Proposals and voting" },
      { label: "Bridging assets", path: "/user-guide/bridging-assets", description: "Cross-chain transfers" },
      { label: "Testnet faucet", path: "/dashboard/faucet", description: "Get testnet QOR" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "EVM development", path: "/developer-guide/evm-development", description: "Solidity on chain id 9801/9800" },
      { label: "SVM development", path: "/developer-guide/svm-development", description: "Solana-compatible programs" },
      { label: "CosmWasm development", path: "/developer-guide/cosmwasm-development", description: "Rust smart contracts" },
      { label: "Post-quantum signing", path: "/developer-guide/post-quantum-signing", description: "Hybrid ML-DSA-87 signatures" },
      { label: "SDK quickstart", path: "/sdk/quickstart", description: "@qorechain/sdk in minutes" },
      { label: "Deploy a rollup", path: "/rollups/deploying-a-rollup", description: "Rollup Development Kit" },
    ],
  },
  {
    title: "Operate & reference",
    links: [
      { label: "Run a node", path: "/developer-guide/running-a-node", description: "Full node setup" },
      { label: "Run a validator", path: "/developer-guide/running-a-validator", description: "Join the validator set" },
      { label: "Light node", path: "/light-node/overview", description: "SX / UX editions & rewards" },
      { label: "REST & gRPC endpoints", path: "/api-reference/rest-grpc-endpoints", description: "Query the chain directly" },
      { label: "EVM JSON-RPC", path: "/api-reference/json-rpc-eth_-namespace", description: "eth_* namespace" },
      { label: "Solana-compatible RPC", path: "/api-reference/json-rpc-solana-compatible", description: "SVM read methods" },
      { label: "WebSocket events", path: "/api-reference/websocket-events", description: "Live blocks & txs" },
      { label: "Chain parameters", path: "/appendix/chain-parameters", description: "Canonical network constants" },
    ],
  },
];

export function docsUrl(path: string): string {
  return `${DOCS_BASE}${path}`;
}
