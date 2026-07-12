// Module ("maccount") addresses on QoreChain. These are NOT user wallets — each
// is derived deterministically from a module name as bech32(sha256(name)[:20]),
// has no private key, and is controlled only by chain logic. Recognizing them
// keeps the explorer honest: an EVM transfer routes value through the "EVM
// module" escrow, which the bank layer emits as an extra transfer leg. Labeling
// that hop stops it from reading like a second user-to-user payment.
//
// Addresses are permanent (fixed at genesis), so a static map is authoritative.
// Generated from the module names registered in app/app.go + x/*/types.
export const MODULE_ACCOUNTS: Record<string, string> = {
  "qor17xpfvakm2amg962yls6f84z3kell8c5lyj5r7l": "Fee collector",
  "qor1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8n5nlua": "Staking rewards",
  "qor1m3h30wlvsf8llruxtpukdvsy0km2kum8u6smjz": "Mint",
  "qor1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3ps7vv4": "Bonded pool",
  "qor1tygms3xhhs3yv487phx3dw4a95jn7t7l4sza6p": "Unbonding pool",
  "qor10d07y265gmmuvt4z0w9aw880jnsr700jwfyxr3": "Governance",
  "qor1vqu8rska6swzdmnhf90zuv0xmelej4lqeejhp2": "EVM module",
  "qor1el68mjnzv87uurqks8u29tec0cj329700hnfnv": "EIP-1559 fee market",
  "qor1glht96kr2rseywuvhhay894qw7ekuc4q70yeuy": "ERC-20 module",
  "qor1yl6hdjhmkf37639730gffanpzndzdpmh65p2zp": "IBC transfer",
  "qor1d4e35hk3gk4k6t5gh02dcm923z8ck86qjzqy7d": "Inflation",
  "qor1sk06e3dyexuq4shw77y3dsv480xv42mqv7ss37": "Burn",
  "qor1442dlsw3vhyhph474we8ayvp5g8d7504d26rut": "Abstract account",
  "qor1xt5rayk5t4cld8w0n5s5dz8sxa25yyyxqmy99w": "AI module",
  "qor1xxs9c4mfqzya8yt38pphxl4zuut67fllcw740z": "AMM",
  "qor1nl3mrrzyvgkkzzfk70jufjrnvjtvm3m62p50z4": "Babylon",
  "qor1zlefkpe3g0vvm9a4h0jf9000lmqutlh90ut59e": "Bridge",
  "qor1vrkywhenukamlg7qys4nv2ez7j3ypnl6ydfsee": "Cross-VM",
  "qor1jskvf0rsth62xn3nl57wap79xzc3fx7afderrz": "Fairblock",
  "qor14vfmsumu2nwlak9gvgr3fmhrslq7npazlarjn2": "Gas abstraction",
  "qor1eswnkq35s3n3fv9wmfkvxjc90dpstwur9tkted": "License",
  "qor19jz9krtut4hm3udun7rtjmhshacu509vxg2dtl": "Light node",
  "qor1zlt9g9lqxk8nydpwj2y4h2s0dm3az6yv52ghjf": "Multilayer",
  "qor1qcdg6cazjakwg5v4vczq8nf682fa98z4dw0fmw": "PQC",
  "qor1d3fvk7x5sk9y9ul4wyxytd2uph4vedm8zsyfu7": "QCA",
  "qor1qadyq99h5qtkhumcjsejh8nanfshltv3zghqsd": "RDK",
  "qor124hvwjzakmkzt9s9fmcrwn6sun0mesuk3w4fkq": "Reputation",
  "qor1ecw3ngmdet8zw5kvn7lcav00yx0p7qy9r30du9": "RL consensus",
  "qor1g4wc7x38g4jtprvejf5lhcgcwwj75ddzq3vdv3": "SVM",
  "qor1cva9aw5t7tp3rwla0a3utyrlvu4r4qlrsmsmjj": "xQORE",
};

/** Friendly module label for an address, or null if it is a normal account. */
export function moduleLabel(address: string): string | null {
  return MODULE_ACCOUNTS[address] ?? null;
}

export function isModuleAccount(address: string): boolean {
  return address in MODULE_ACCOUNTS;
}
