///// Date : 2026-08-27 | Changes : Allocation buckets from Tokenomics v2.2, for circulating supply (SCRUM-242) | Who : Liviu Epure

/**
 * The on-chain address of every allocation bucket, transcribed from
 * "QCTokenomics v2.2, table: On-chain address of every allocation bucket".
 *
 * These wallets hold allocations that have NOT been distributed yet, so their
 * balances are excluded from circulating supply. They are listed with their
 * labels rather than as bare strings so that an address appearing in this file
 * can be checked against the document it came from.
 *
 * If a bucket is renamed, split or retired in a later tokenomics revision, this
 * list must be updated with it — a stale entry silently mis-states the
 * circulating supply, and nothing else in the codebase would notice.
 */
export interface AllocationBucket {
  label: string;
  address: string;
}

export const ALLOCATION_BUCKETS: AllocationBucket[] = [
  { label: "Community Airdrop", address: "qor1n4th333p2hdmr3yaudp87q22r3zwh749ls3u7c" },
  { label: "Public Sale & Pre-Market", address: "qor1us7vg99vcyqep8jf8xx4fmt0fvt7e05sa07d34" },
  { label: "Early Community Contributors", address: "qor15vzu9tcll0uyv6huumky8v9ykd6fwjv4w99ts8" },
  { label: "Ecosystem Fund", address: "qor1ncymmj0wwtvd55vr5eqallw9yp5g6e62snaq9v" },
  { label: "Developer Grants (Builders Fund)", address: "qor1308a6dcaaxk75wyft7999z9hkp63299eejpn75" },
  { label: "Staking Rewards", address: "qor1kfuqp9fxammht8y6h0jsxfgrqau3rh4y7c30y6" },
  { label: "Liquidity and Listings", address: "qor1ap9yx8wgngdwnf3gsh032twg6phg6wt747h3qj" },
  { label: "Validator Incentives", address: "qor1kue4rh86a5mk8vevc5x2vwhjhuk6rtsm9jn6px" },
  { label: "Bug Bounty", address: "qor1c60gmsq68jpx8yzjj0pagl7kkggs4zc8mrfkkm" },
  { label: "Security Audits", address: "qor1atxgrrn2epwwkdm9pyyhzentdcxvavqjzssqye" },
  { label: "Core Team", address: "qor1pstahlngflck3cgsjcfqyuhua70nuvjpjnrxwf" },
  { label: "Advisors", address: "qor1mmeync4zwyz9sjfla7rxrh5zuqjqw7knkj9cs3" },
  { label: "Early Team Contributors", address: "qor1f50vx6zyj4njsvjj4dc97m37a39ts5tu740w9e" },
  { label: "Seed", address: "qor1ue0ujtz56wy2z2paje3sxyhjx445we8yys7x8v" },
  { label: "Private", address: "qor12nujzu7yf4e30yyq8ndax4e3hde2lulqsh8ad4" },
  { label: "Strategic", address: "qor1w225478z08ek8z3udlvv97fy2atfnmvrctqsrg" },
  { label: "Treasury Reserve", address: "qor1lgn73vxgf0q902wvxyxwxh8d4tkxphzvlm4qjf" },
  { label: "Foundation Operations", address: "qor12c8vfzltd6gft3wzx0nr9ekz9yy42waynxhz3f" },
  { label: "Future Partnerships", address: "qor1e03u6wddeajsp94lvcnukrgnv77ay98hc400rv" },
  { label: "Marketing Operations", address: "qor1hf8dvgjywn3lxk9ap9djnvc32xm4a02p89zutd" },
  { label: "Strategic Partners", address: "qor1522wk8tknx4yrja6n2nf50cu976xy0thefl3nz" },
  { label: "KOL and Influencers", address: "qor1mtz0f8g4luzvaccqj8m7ekma5j94uxscqvapj4" },
  { label: "Community Campaigns", address: "qor1m7jfh9mcfh9v8cg68fjgyrr6lqmvvkvqs5e4xm" },
  { label: "Ambassador Programme", address: "qor1caujgl7uuez63sl7825c9yrwh6t7jrwpnfgru0" },
  { label: "Content Creators", address: "qor1w8gxlznxqzwykfpfr0l3xjqvm2q2y6y9mysq7h" },
  { label: "Education", address: "qor19hqd8zhr4tptpy3cmd2jur8aq7vxgsgpeyjvnr" },
  { label: "Governance DAO", address: "qor1ek28hq2z5r0c98qz7nvu4rnsw03e7aymy2cr75" },
  { label: "Emergency Reserve", address: "qor1aa36thg8swf42j9nh4lqmz7mhqrm6d08csgvkn" },
  { label: "Insurance Fund", address: "qor1p45mez0q2t94sawrcsx3namknruwd2l8ffjlp8" },
];

export const ALLOCATION_ADDRESSES: ReadonlySet<string> = new Set(
  ALLOCATION_BUCKETS.map((b) => b.address),
);

/**
 * Module accounts that hold protocol-owned funds. Excluded from circulating.
 *
 * `bonded_tokens_pool` and `not_bonded_tokens_pool` are deliberately NOT here:
 * they hold delegators' own coins in transit, and as of this writing none of
 * the bonded stake comes from an allocation bucket — excluding that pool would
 * erase ~44.5M QOR that belongs to ordinary holders.
 *
 * `distribution` IS here: it holds staking rewards that have been earned but
 * not withdrawn. They are not in anyone's account and cannot be sold until
 * claimed, so counting them would move the headline figure without anything
 * having actually moved.
 */
export const PROTOCOL_MODULE_NAMES: ReadonlySet<string> = new Set([
  "protocolpool",
  "lightnode",
  "distribution",
  "burn",
  "inflation",
  "svm",
  "evm",
  "erc20",
  "precisebank",
  "fee_collector",
  "gov",
]);
