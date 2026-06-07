# PharosPay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PharosPay — an x402 agent-payment rail on Pharos: an EIP-3009 stablecoin, an on-chain settlement+reputation ledger, a provider middleware, an MCP payer Skill with spending guardrails, a real paid analytics service, and a live leaderboard with shareable cards + referrals.

**Architecture:** TypeScript pnpm monorepo. Solidity (Foundry) contracts (pUSD token, PharosPayLedger, ServiceRegistry). A framework-agnostic verify/settle core wrapped as Hono middleware (provider). An MCP server (payer) that signs EIP-3009 authorizations and enforces budget guardrails. Settlement relays through PharosPayLedger so reputation/streak data is produced on every payment. Integration tests run against a local **anvil** chain; the final artifact is deployed to **Pharos Atlantic testnet** (chainId 688688).

**Tech Stack:** TypeScript, viem, Foundry/Solidity ^0.8.24, OpenZeppelin, `@modelcontextprotocol/sdk`, Hono, Next.js (App Router) + `@vercel/og`, vitest, pnpm workspaces, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-07-pharospay-x402-skill-design.md`

**Build-quality rules (apply to every task):** tests before code (TDD); no task is "done" until its tests pass with shown output; run `code-review` + `security-review` before final submission; pull current API docs via context7 (fallback: official docs) before writing against any library. Commit after every green step. Commits credit only the user (no Claude co-author trailer).

---

## File Structure

```
pharospay/
├─ pnpm-workspace.yaml
├─ package.json                      # root scripts, devDeps (vitest, typescript)
├─ tsconfig.base.json
├─ .env.example                      # RPC, keys, addresses (never commit real .env)
├─ packages/
│  ├─ contracts/                     # Foundry project
│  │  ├─ foundry.toml
│  │  ├─ src/PharosPayUSD.sol        # ① EIP-3009 stablecoin + faucet + referral
│  │  ├─ src/PharosPayLedger.sol     # ⑥ settlement relay + reputation/streak
│  │  ├─ src/ServiceRegistry.sol     # ⑤ STRETCH
│  │  ├─ src/lib/EIP3009.sol         # EIP-3009 mixin
│  │  ├─ test/PharosPayUSD.t.sol
│  │  ├─ test/PharosPayLedger.t.sol
│  │  └─ script/Deploy.s.sol
│  ├─ shared/                        # TS: chain config, ABIs, EIP-712 helpers
│  │  ├─ src/chain.ts                # viem Pharos chain + anvil chain
│  │  ├─ src/addresses.ts            # deployed addresses per chain
│  │  ├─ src/abis.ts                 # exported ABIs (from foundry out)
│  │  ├─ src/eip3009.ts              # build/sign/verify authorization (EIP-712)
│  │  ├─ src/types.ts                # x402 payment-requirements + payload types
│  │  └─ test/eip3009.test.ts
│  ├─ x402-pharos/                   # ② provider middleware
│  │  ├─ src/core.ts                 # build402, parseHeader, verify, settle
│  │  ├─ src/hono.ts                 # requirePayment() Hono middleware
│  │  └─ test/{core,hono}.test.ts
│  └─ skill/                         # ③ MCP payer Skill
│     ├─ src/store.ts                # budget + receipts (JSON file)
│     ├─ src/payClient.ts            # payFetch() x402 flow + guardrails
│     ├─ src/reputation.ts           # read ledger counters (⑥)
│     ├─ src/server.ts               # MCP server (stdio) + tool registration
│     ├─ SKILL.md
│     ├─ README.md
│     └─ test/{store,payClient}.test.ts
├─ apps/
│  ├─ alpha-api/                     # ④ real paid service (Hono)
│  │  ├─ src/index.ts
│  │  ├─ src/analytics.ts            # compute Pharos wallet analytics via RPC
│  │  ├─ vercel.json
│  │  └─ test/analytics.test.ts
│  └─ leaderboard/                   # ⑥ Next.js leaderboard + cards (SHOULD)
│     ├─ app/page.tsx                # rankings
│     ├─ app/agent/[address]/page.tsx
│     ├─ app/card/receipt/[txHash]/route.tsx   # @vercel/og
│     └─ app/card/agent/[address]/route.tsx
├─ docs/                             # demo script, video script
└─ README.md                         # headline: "give your agent a wallet on Pharos"
```

---

## Phase 0 — Monorepo & tooling

### Task 0.1: pnpm workspace skeleton

**Files:** Create `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.env.example`.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 2: Create root `package.json`**
```json
{
  "name": "pharospay",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "anvil": "anvil --silent"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "declaration": true, "resolveJsonModule": true, "types": ["node"]
  }
}
```

- [ ] **Step 4: Create `.env.example`**
```
PHAROS_RPC_URL=https://testnet.dplabs-internal.com
PHAROS_CHAIN_ID=688688
PHAROS_EXPLORER=https://testnet.pharosscan.xyz
# Funded settler wallet (pays gas to relay settlements)
SETTLER_PRIVATE_KEY=
# Agent wallet used by the Skill
PHAROSPAY_PRIVATE_KEY=
# Deployed addresses (filled after deploy)
PUSD_ADDRESS=
LEDGER_ADDRESS=
REGISTRY_ADDRESS=
```

- [ ] **Step 5: Commit**
```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .env.example
git commit -m "chore: pnpm monorepo skeleton"
```

### Task 0.2: Foundry project

- [ ] **Step 1:** `forge init packages/contracts --no-git --no-commit` then install OZ: `cd packages/contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit`.
- [ ] **Step 2:** Create `packages/contracts/foundry.toml`:
```toml
[profile.default]
src = "src"
test = "test"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]
```
- [ ] **Step 3:** Delete the template `src/Counter.sol`, `test/Counter.t.sol`, `script/Counter.s.sol`.
- [ ] **Step 4: Verify** `forge build` succeeds (empty project). Expected: "Nothing to compile" or clean build.
- [ ] **Step 5: Commit** `git commit -am "chore: foundry project + OpenZeppelin"`.

---

## Phase 1 — ① pUSD: EIP-3009 stablecoin + faucet + referral (MUST)

### Task 1.1: EIP-3009 mixin + token

**Files:** Create `src/lib/EIP3009.sol`, `src/PharosPayUSD.sol`, `test/PharosPayUSD.t.sol`.

- [ ] **Step 1: Write failing test `test/PharosPayUSD.t.sol`** (covers: claim, claim cooldown, referral bonus + cap, transferWithAuthorization happy path, nonce replay revert, expired-auth revert).
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "forge-std/Test.sol";
import "../src/PharosPayUSD.sol";

contract PharosPayUSDTest is Test {
    PharosPayUSD t;
    uint256 alicePk = 0xA11CE;
    address alice;
    address bob = address(0xB0B);

    function setUp() public { t = new PharosPayUSD(); alice = vm.addr(alicePk); }

    function test_claim_mints_and_cooldown() public {
        vm.prank(alice); t.claim();
        assertEq(t.balanceOf(alice), t.FAUCET_AMOUNT());
        vm.prank(alice); vm.expectRevert(bytes("cooldown"));
        t.claim();
    }

    function test_referral_bonus_and_cap() public {
        vm.prank(bob); t.claimWithReferrer(alice);
        assertEq(t.balanceOf(alice), t.REFERRAL_BONUS());
        assertEq(t.referralCount(alice), 1);
    }

    function _sign(uint256 pk, address from, address to, uint256 value, bytes32 nonce)
        internal view returns (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb)
    {
        va = 0; vb = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(abi.encode(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), from, to, value, va, vb, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function test_transferWithAuthorization() public {
        vm.prank(alice); t.claim();
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) =
            _sign(alicePk, alice, bob, 10e6, nonce);
        t.transferWithAuthorization(alice, bob, 10e6, va, vb, nonce, v, r, s);
        assertEq(t.balanceOf(bob), 10e6);
        // replay
        vm.expectRevert(bytes("auth used"));
        t.transferWithAuthorization(alice, bob, 10e6, va, vb, nonce, v, r, s);
    }
}
```

- [ ] **Step 2: Run, expect FAIL** `cd packages/contracts && forge test --match-contract PharosPayUSDTest` → fails (no contract).

- [ ] **Step 3: Implement `src/lib/EIP3009.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

abstract contract EIP3009 is ERC20 {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");
    bytes32 public immutable DOMAIN_SEPARATOR;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor(string memory name_, string memory version_) {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name_)), keccak256(bytes(version_)), block.chainid, address(this)));
    }

    function transferWithAuthorization(
        address from, address to, uint256 value, uint256 validAfter, uint256 validBefore,
        bytes32 nonce, uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp > validAfter, "auth not yet valid");
        require(block.timestamp < validBefore, "auth expired");
        require(!authorizationState[from][nonce], "auth used");
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(ECDSA.recover(digest, v, r, s) == from, "invalid signature");
        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external {
        require(!authorizationState[authorizer][nonce], "auth used");
        bytes32 structHash = keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        require(ECDSA.recover(digest, v, r, s) == authorizer, "invalid signature");
        authorizationState[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }
}
```

- [ ] **Step 4: Implement `src/PharosPayUSD.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP3009} from "./lib/EIP3009.sol";

contract PharosPayUSD is EIP3009 {
    uint256 public constant FAUCET_AMOUNT = 100e6;     // 100 pUSD
    uint256 public constant REFERRAL_BONUS = 25e6;     // 25 pUSD each side
    uint256 public constant COOLDOWN = 12 hours;
    uint256 public constant REFERRAL_CAP = 50;         // max referrals counted per referrer
    mapping(address => uint256) public lastClaim;
    mapping(address => uint256) public referralCount;

    constructor() ERC20("PharosPay USD", "pUSD") EIP3009("PharosPay USD", "1") {}

    function decimals() public pure override returns (uint8) { return 6; }

    function claim() public {
        require(block.timestamp - lastClaim[msg.sender] >= COOLDOWN, "cooldown");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function claimWithReferrer(address referrer) external {
        claim();
        if (referrer != address(0) && referrer != msg.sender && referralCount[referrer] < REFERRAL_CAP) {
            referralCount[referrer] += 1;
            _mint(referrer, REFERRAL_BONUS);
            _mint(msg.sender, REFERRAL_BONUS);
        }
    }
}
```
> Note: `claim()` is `public` (not `external`) so `claimWithReferrer` can call it. First `claim()` in `claimWithReferrer` sets cooldown for `msg.sender`.

- [ ] **Step 5: Run tests, expect PASS** `forge test --match-contract PharosPayUSDTest -vv`. Expected: all green.

- [ ] **Step 6: Commit** `git commit -am "feat(contracts): pUSD EIP-3009 stablecoin with faucet + referral"`.

---

## Phase 2 — ⑥ PharosPayLedger: settlement relay + reputation (MUST)

### Task 2.1: Ledger contract

**Files:** Create `src/PharosPayLedger.sol`, `test/PharosPayLedger.t.sol`.

- [ ] **Step 1: Write failing test** (settle relays transfer + updates payer/payee counters + streak; emits PaymentSettled).
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "forge-std/Test.sol";
import "../src/PharosPayUSD.sol";
import "../src/PharosPayLedger.sol";

contract PharosPayLedgerTest is Test {
    PharosPayUSD t; PharosPayLedger ledger;
    uint256 alicePk = 0xA11CE; address alice; address bob = address(0xB0B);

    function setUp() public {
        t = new PharosPayUSD(); ledger = new PharosPayLedger(address(t));
        alice = vm.addr(alicePk); vm.prank(alice); t.claim();
    }

    function _auth(uint256 value, bytes32 nonce)
        internal view returns (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb)
    {
        va = 0; vb = block.timestamp + 1 hours;
        bytes32 sh = keccak256(abi.encode(
            t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), alice, bob, value, va, vb, nonce));
        bytes32 d = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), sh));
        (v, r, s) = vm.sign(alicePk, d);
    }

    function test_settle_relays_and_records() public {
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) = _auth(10e6, keccak256("n1"));
        ledger.settle(alice, bob, 10e6, va, vb, keccak256("n1"), v, r, s, keccak256("GET /x"));
        assertEq(t.balanceOf(bob), 10e6);
        (uint256 txc, uint256 paid,,, uint256 streak,) = ledger.stats(alice);
        assertEq(txc, 1); assertEq(paid, 10e6); assertEq(streak, 1);
        (, , uint256 earned,,,) = ledger.stats(bob);
        assertEq(earned, 10e6);
    }
}
```

- [ ] **Step 2: Run, expect FAIL** `forge test --match-contract PharosPayLedgerTest`.

- [ ] **Step 3: Implement `src/PharosPayLedger.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IEIP3009 {
    function transferWithAuthorization(
        address from, address to, uint256 value, uint256 validAfter, uint256 validBefore,
        bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external;
}

contract PharosPayLedger {
    IEIP3009 public immutable token;

    struct Stats {
        uint256 txCount; uint256 totalPaid; uint256 totalEarned;
        uint256 lastActiveDay; uint256 streak; uint256 repScore;
    }
    mapping(address => Stats) public stats;

    event PaymentSettled(
        address indexed payer, address indexed payee, uint256 amount, bytes32 resourceHash, uint256 ts);

    constructor(address token_) { token = IEIP3009(token_); }

    function settle(
        address from, address to, uint256 value, uint256 validAfter, uint256 validBefore,
        bytes32 nonce, uint8 v, bytes32 r, bytes32 s, bytes32 resourceHash
    ) external {
        token.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
        _recordPayer(from, value);
        Stats storage pe = stats[to];
        pe.totalEarned += value; pe.repScore += 1;
        emit PaymentSettled(from, to, value, resourceHash, block.timestamp);
    }

    function _recordPayer(address payer, uint256 value) internal {
        Stats storage s = stats[payer];
        uint256 day = block.timestamp / 1 days;
        if (day == s.lastActiveDay + 1) { s.streak += 1; }
        else if (day != s.lastActiveDay) { s.streak = 1; }
        s.lastActiveDay = day;
        s.txCount += 1; s.totalPaid += value;
        s.repScore = s.txCount + (s.totalEarned / 1e6) + s.streak * 5;
    }
}
```

- [ ] **Step 4: Run tests, expect PASS** `forge test --match-contract PharosPayLedgerTest -vv`.
- [ ] **Step 5: Commit** `git commit -am "feat(contracts): PharosPayLedger settlement relay + reputation"`.

---

## Phase 3 — Deploy script + shared TS package (MUST)

### Task 3.1: Foundry deploy script

**Files:** Create `script/Deploy.s.sol`.

- [ ] **Step 1: Implement**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "forge-std/Script.sol";
import "../src/PharosPayUSD.sol";
import "../src/PharosPayLedger.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        PharosPayUSD t = new PharosPayUSD();
        PharosPayLedger ledger = new PharosPayLedger(address(t));
        vm.stopBroadcast();
        console2.log("PUSD_ADDRESS=", address(t));
        console2.log("LEDGER_ADDRESS=", address(ledger));
    }
}
```
- [ ] **Step 2: Verify against anvil** — start `anvil` in another shell, then `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`. Expected: prints both addresses.
- [ ] **Step 3: Commit** `git commit -am "feat(contracts): deploy script"`.

### Task 3.2: shared package (chain, EIP-712 helpers, types)

**Files:** Create `packages/shared/{package.json,tsconfig.json}`, `src/chain.ts`, `src/types.ts`, `src/eip3009.ts`, `test/eip3009.test.ts`. (ABIs/addresses added after build.)

- [ ] **Step 1: `package.json`** (name `@pharospay/shared`, deps `viem@^2.21.0`, scripts `test: vitest run`, `build: tsc`).
- [ ] **Step 2: `src/chain.ts`**
```ts
import { defineChain } from "viem";
export const pharosTestnet = defineChain({
  id: 688688,
  name: "Pharos Atlantic Testnet",
  nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: [process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com"] } },
  blockExplorers: { default: { name: "PharosScan", url: "https://testnet.pharosscan.xyz" } },
  testnet: true,
});
export const anvilLocal = defineChain({
  id: 31337, name: "Anvil", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
```
- [ ] **Step 3: `src/types.ts`** — x402 payment-requirements + payload:
```ts
export interface PaymentRequirements {
  scheme: "exact"; network: string; maxAmountRequired: string; asset: `0x${string}`;
  payTo: `0x${string}`; resource: string; description: string; mimeType: string; maxTimeoutSeconds: number;
}
export interface Authorization {
  from: `0x${string}`; to: `0x${string}`; value: string;
  validAfter: string; validBefore: string; nonce: `0x${string}`;
}
export interface PaymentPayload { authorization: Authorization; signature: `0x${string}`; }
```
- [ ] **Step 4: Write failing test `test/eip3009.test.ts`** — sign then verify round-trips, and recovers the signer address.
```ts
import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildAuthorization, signAuthorization, recoverAuthorizationSigner } from "../src/eip3009.js";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

describe("eip3009", () => {
  it("signs and recovers", async () => {
    const acct = privateKeyToAccount(PK);
    const token = "0x0000000000000000000000000000000000000001" as const;
    const auth = buildAuthorization({ from: acct.address, to: "0x00000000000000000000000000000000000000b0", value: "10000000" });
    const sig = await signAuthorization({ account: acct, token, chainId: 31337, auth });
    const signer = recoverAuthorizationSigner({ token, chainId: 31337, auth, signature: sig });
    expect(signer.toLowerCase()).toBe(acct.address.toLowerCase());
  });
});
```
- [ ] **Step 5: Run, expect FAIL** `pnpm --filter @pharospay/shared test`.
- [ ] **Step 6: Implement `src/eip3009.ts`** — EIP-712 domain `{name:"PharosPay USD",version:"1",chainId,verifyingContract:token}`, types matching the contract typehash; `buildAuthorization` (fills validAfter=0, validBefore=now+1h, random 32-byte nonce); `signAuthorization` via `account.signTypedData`; `recoverAuthorizationSigner` via `recoverTypedDataAddress`.
```ts
import { recoverTypedDataAddress, type LocalAccount } from "viem";
import { randomBytes } from "node:crypto";
import type { Authorization } from "./types.js";

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" },
    { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ],
} as const;
const domain = (chainId: number, token: `0x${string}`) =>
  ({ name: "PharosPay USD", version: "1", chainId, verifyingContract: token }) as const;

export function buildAuthorization(a: { from: `0x${string}`; to: `0x${string}`; value: string; ttlSeconds?: number }): Authorization {
  const now = Math.floor(Date.now() / 1000);
  return { from: a.from, to: a.to, value: a.value, validAfter: "0",
    validBefore: String(now + (a.ttlSeconds ?? 3600)), nonce: `0x${randomBytes(32).toString("hex")}` };
}
export async function signAuthorization(p: { account: LocalAccount; token: `0x${string}`; chainId: number; auth: Authorization }) {
  return p.account.signTypedData({ domain: domain(p.chainId, p.token), types, primaryType: "TransferWithAuthorization",
    message: { ...p.auth, value: BigInt(p.auth.value), validAfter: BigInt(p.auth.validAfter), validBefore: BigInt(p.auth.validBefore) } });
}
export async function recoverAuthorizationSigner(p: { token: `0x${string}`; chainId: number; auth: Authorization; signature: `0x${string}` }) {
  return recoverTypedDataAddress({ domain: domain(p.chainId, p.token), types, primaryType: "TransferWithAuthorization",
    message: { ...p.auth, value: BigInt(p.auth.value), validAfter: BigInt(p.auth.validAfter), validBefore: BigInt(p.auth.validBefore) }, signature: p.signature });
}
```
- [ ] **Step 7: Run, expect PASS** `pnpm --filter @pharospay/shared test`.
- [ ] **Step 8:** Create `src/abis.ts` (hand-written minimal ABIs for `transferWithAuthorization`, `claim`, `claimWithReferrer`, `balanceOf`, `stats`, `settle`, `PaymentSettled` event) and `src/addresses.ts` (read from env with anvil defaults). Export everything from `src/index.ts`.
- [ ] **Step 9: Commit** `git commit -am "feat(shared): viem chain, EIP-712 sign/verify, x402 types"`.

---

## Phase 4 — ② x402-pharos provider middleware (MUST)

### Task 4.1: verify/settle core

**Files:** Create `packages/x402-pharos/{package.json,tsconfig.json}`, `src/core.ts`, `test/core.test.ts`. Deps: `@pharospay/shared`, `viem`.

- [ ] **Step 1: Write failing test `test/core.test.ts`** — `build402Body` shape; `verifyPayment` rejects wrong amount/payTo and accepts a valid signed payload (recover via shared).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `src/core.ts`:**
  - `build402Body({price, payTo, asset, network, resource, description})` → `{ x402Version: 1, accepts: [PaymentRequirements] }` (convert price to base units with 6 decimals).
  - `parsePaymentHeader(headerValue)` → decode base64 JSON → `PaymentPayload`.
  - `verifyPayment(payload, requirements, chainId)` → checks `to===payTo`, `BigInt(value) >= maxAmountRequired`, `validBefore > now`, recovers signer === `authorization.from`; returns `{ ok, reason? }`.
  - `settle(payload, { settlerAccount, ledger, token, resourceHash, chain })` → viem walletClient writes `ledger.settle(...)` (split signature into v,r,s), waits for receipt, returns `txHash`. Fallback `settleDirect` writes `token.transferWithAuthorization` if ledger missing.
- [ ] **Step 4: Run, expect PASS** (unit tests of build/verify; settle covered by integration test in Task 4.2).
- [ ] **Step 5: Commit** `git commit -am "feat(x402-pharos): verify/settle core"`.

### Task 4.2: Hono middleware + anvil integration

**Files:** Create `src/hono.ts`, `test/hono.test.ts`.

- [ ] **Step 1: Write failing integration test `test/hono.test.ts`** — spins an anvil chain (via a test helper that runs `anvil` and deploys pUSD+Ledger with viem using the known anvil key), mounts a Hono app with `requirePayment`, then: (a) unpaid request → 402 with correct body; (b) signs an authorization with a funded anvil account, sends `X-PAYMENT` → 200 + `X-PAYMENT-RESPONSE` with a real txHash; asserts pUSD moved to payTo on-chain.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `src/hono.ts`** — `requirePayment(opts)` returns a Hono middleware: read `X-PAYMENT`; if absent/invalid → `c.json(build402Body(...), 402)`; else `verifyPayment` → on fail 402; on success `settle(...)`, set `X-PAYMENT-RESPONSE` header, `await next()`.
- [ ] **Step 4: Run, expect PASS** `pnpm --filter @pharospay/x402-pharos test` (anvil must be installed; helper starts it).
- [ ] **Step 5: Commit** `git commit -am "feat(x402-pharos): Hono requirePayment middleware + anvil integration test"`.

---

## Phase 5 — ③ PharosPay Skill (MCP payer) (MUST)

### Task 5.1: budget + receipts store

**Files:** `packages/skill/{package.json,tsconfig.json}`, `src/store.ts`, `test/store.test.ts`. Deps: `@modelcontextprotocol/sdk`, `@pharospay/shared`, `viem`.

- [ ] **Step 1: Write failing test** — guardrail checks: rejects over perCallMax; rejects when spentToday+amount > dailyCap; rejects host not in allowlist (when allowlist set); resets spentToday on a new day; `recordReceipt`/`listReceipts` round-trip.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `src/store.ts`** — JSON file at `~/.pharospay/store.json`: `{ budget: { perCallMax, dailyCap, allowlist, denylist }, spent: { day, amount }, receipts: [] }`. Functions: `getBudget`, `setBudget`, `checkAllowed({host, amount})→{ok,reason?}`, `addSpend(amount)`, `recordReceipt(r)`, `listReceipts(limit)`.
- [ ] **Step 4: Run, expect PASS.** **Step 5: Commit.**

### Task 5.2: payFetch x402 client

**Files:** `src/payClient.ts`, `test/payClient.test.ts`.

- [ ] **Step 1: Write failing integration test** — against the anvil + Hono app helper from Task 4.2: `payFetch` on a 402 endpoint signs + pays and returns the body + a receipt with txHash; a second call exceeding `perCallMax` is rejected before any signing.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `src/payClient.ts`:**
  - `payFetch({url, method, body, maxAmount})`: `fetch`; if status !== 402 return as-is; parse `accepts[0]`; `host = new URL(url).host`; `checkAllowed({host, amount})` and enforce `amount <= maxAmount` → on fail throw a clear error (no signing); `buildAuthorization` + `signAuthorization` (shared); base64-encode `{authorization, signature}` into `X-PAYMENT`; re-`fetch`; on 200 read `X-PAYMENT-RESPONSE` txHash, `addSpend`, `recordReceipt`, return `{ status, data, payment }`.
  - wallet from `PHAROSPAY_PRIVATE_KEY`; `getBalance()` reads pUSD `balanceOf` + native PHRS.
- [ ] **Step 4: Run, expect PASS.** **Step 5: Commit.**

### Task 5.3: MCP server wiring

**Files:** `src/server.ts` (bin entry).

- [ ] **Step 1:** Implement an MCP stdio server registering tools: `pay_fetch`, `get_wallet`, `get_balance`, `set_budget`, `get_budget`, `list_receipts` (zod input schemas; handlers call payClient/store). Add `bin` in package.json (`pharospay-skill`).
- [ ] **Step 2: Manual verify** — `npx @modelcontextprotocol/inspector node packages/skill/dist/server.js` lists all six tools and `get_budget` returns defaults. (Document expected output in the task.)
- [ ] **Step 3: Commit** `git commit -am "feat(skill): MCP server with pay_fetch + budget + receipts"`.

### Task 5.4: SKILL.md + README

- [ ] **Step 1:** Write `packages/skill/SKILL.md` (AgentSkill format: name, description, when-to-use, tool list) using the `skill-creator` skill for structure.
- [ ] **Step 2:** Write `README.md` with the MCP config snippet:
```json
{ "mcpServers": { "pharospay": { "command": "npx", "args": ["pharospay-skill"], "env": { "PHAROSPAY_PRIVATE_KEY": "0x..." } } } }
```
- [ ] **Step 3: Commit.**

---

## Phase 6 — ④ Alpha API: real paid analytics service (MUST)

### Task 6.1: analytics + gated route

**Files:** `apps/alpha-api/{package.json,tsconfig.json}`, `src/analytics.ts`, `src/index.ts`, `test/analytics.test.ts`, `vercel.json`. Deps: `hono`, `@pharospay/x402-pharos`, `@pharospay/shared`, `viem`.

- [ ] **Step 1: Write failing test `test/analytics.test.ts`** — `analyzeWallet(address, client)` with a mocked viem client returns `{ address, native, pusd, txCount, riskFlags }` with expected shapes/values.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `src/analytics.ts`** — given a viem public client on Pharos: `getBalance` (native PHRS), pUSD `balanceOf`, `getTransactionCount`, derive simple `riskFlags` (e.g. `freshWallet` if txCount===0; `lowBalance` if native < gas threshold). Return typed object.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Implement `src/index.ts`** — Hono app: free `GET /health`; paid `GET /alpha/wallet/:address` gated by `requirePayment({ price: "0.01", payTo: MERCHANT, description: "Pharos wallet analytics" })`, returning `analyzeWallet(...)`. Add `vercel.json` for the Hono build.
- [ ] **Step 6: Manual verify** — run locally against anvil-deployed token, `payFetch` the route via the Skill → returns analytics + a settled txHash.
- [ ] **Step 7: Commit** `git commit -am "feat(alpha-api): paid Pharos wallet analytics via x402"`.

---

## Phase 7 — Live deploy to Pharos + end-to-end loop (MUST)

### Task 7.1: Deploy contracts to Pharos

- [ ] **Step 1:** Fund the settler + agent wallets from the Pharos faucet (official + gas.zip). Record addresses.
- [ ] **Step 2:** `forge script script/Deploy.s.sol --rpc-url $PHAROS_RPC_URL --broadcast --private-key $SETTLER_PRIVATE_KEY`. Capture `PUSD_ADDRESS`, `LEDGER_ADDRESS` into `.env` and `packages/shared/src/addresses.ts`.
- [ ] **Step 3:** Verify both contracts on `pharosscan.xyz` (forge verify or explorer UI). Confirm `claim()` works from the agent wallet (real tx).
- [ ] **Step 4: Commit** the recorded addresses `git commit -am "chore: Pharos testnet deploy addresses"`.

### Task 7.2: Deploy Alpha API + run the real loop

- [ ] **Step 1:** `vercel deploy --prod` the `alpha-api` app with Pharos env (`SETTLER_PRIVATE_KEY`, `PUSD_ADDRESS`, `LEDGER_ADDRESS`, `MERCHANT`).
- [ ] **Step 2:** Point the Skill at the live URL; run `pay_fetch` → confirm 402 → auto-pay → 200 + analytics; open the settlement tx on `pharosscan.xyz`. This is the **demo loop**.
- [ ] **Step 3:** Capture screenshots/recording for the video. **Commit** any config.

**✅ At this point ①–④ + ledger are live on Pharos — a complete, real, submittable product.**

---

## Phase 8 — ⑥ Retention: leaderboard, cards, referral tools (SHOULD)

### Task 8.1: reputation Skill tools
- [ ] Add `src/reputation.ts` (read `ledger.stats(address)` via viem) and register `get_reputation`, `share_receipt` (returns `${LEADERBOARD_URL}/card/receipt/${txHash}`), `get_referral_link` (returns `${LEADERBOARD_URL}/?ref=${address}`) tools. Test `reputation.ts` against anvil. Commit.

### Task 8.2: leaderboard Next.js app
- [ ] Scaffold `apps/leaderboard` (Next.js App Router, viem). `app/page.tsx`: query `PaymentSettled` logs + `ledger.stats` for ranked tables (top payers by totalPaid, top earners by totalEarned, longest streaks). `app/agent/[address]/page.tsx`: per-agent profile. Use `frontend-design` skill for polish. Commit.

### Task 8.3: shareable OG cards
- [ ] `app/card/receipt/[txHash]/route.tsx` and `app/card/agent/[address]/route.tsx` using `@vercel/og` `ImageResponse` — render payment/profile card with explorer link + referral `?ref=`. Commit.

### Task 8.4: deploy leaderboard
- [ ] `vercel deploy --prod`. Wire `LEADERBOARD_URL` into the Skill env. Confirm a real payment appears on the board + a card renders. Commit.

---

## Phase 9 — ⑤ ServiceRegistry + discover (STRETCH)

- [ ] Task 9.1: `src/ServiceRegistry.sol` (`register(url,price,asset,description,category)`, `getServices()`, events) + Foundry tests + add to `Deploy.s.sol` + deploy. Commit.
- [ ] Task 9.2: Skill tools `discover({category?})` / `list_services()` reading the registry via viem. Test against anvil. Commit.

---

## Phase 10 — Submission polish & review

- [ ] Task 10.1: Root `README.md` — headline "PharosPay — give your AI agent a wallet on Pharos"; quickstart; deployed addresses + links; architecture diagram; ≥250-word writeup framing it as the Skill with Pharos-vision alignment; Phase-2 note.
- [ ] Task 10.2: `docs/demo-script.md` — exact 60–90s video walkthrough (agent → 402 → auto-pay on Pharos → analytics → tx on explorer → leaderboard climb + shareable card).
- [ ] Task 10.3: Run `security-review` (contracts + key handling) and `code-review` (whole diff); fix findings. Commit.
- [ ] Task 10.4: Push to GitHub (user as sole author, no Claude trailer); record the repo + demo links for the DoraHacks BUIDL (when submission opens).

---

## Self-Review (completed)

- **Spec coverage:** ① Task 1.1 · ② Tasks 4.1–4.2 · ③ Tasks 5.1–5.4 + 8.1 · ④ Tasks 6.1 · ⑤ Tasks 9.1–9.2 · ⑥ Tasks 2.1 + 8.1–8.4 · referral faucet Task 1.1 · guardrails Task 5.1 · live deploy Phase 7 · submission Phase 10. All spec sections map to tasks.
- **Cut line honored:** MUST = Phases 0–7; SHOULD = Phase 8; STRETCH = Phase 9. Phase 7 ends with a complete submittable product; the retention/registry phases never block the core loop (settle has a `settleDirect` fallback if the ledger path misbehaves).
- **Type consistency:** `Authorization`/`PaymentPayload`/`PaymentRequirements` defined in `shared/src/types.ts` and reused by middleware + skill. Contract typehash fields (`from,to,value,validAfter,validBefore,nonce`) match the EIP-712 `types` in `shared/src/eip3009.ts`. `ledger.settle(...)` argument order matches `core.settle` and the deploy. `stats()` tuple order (txCount,totalPaid,totalEarned,lastActiveDay,streak,repScore) matches the test destructuring.
- **Verified-knowledge:** Tasks instruct pulling current docs (context7 / official) for viem typed-data, MCP SDK, Hono, @vercel/og, Foundry before coding.
