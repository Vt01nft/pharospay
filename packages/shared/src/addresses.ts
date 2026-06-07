import type { Hex } from "./types";

export interface Deployment {
  pusd: Hex;
  ledger: Hex;
  registry?: Hex;
}

/** Deterministic anvil deploy addresses (from script/Deploy.s.sol on a fresh anvil). */
const ANVIL: Deployment = {
  pusd: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ledger: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
};

export function getAddresses(chainId: number): Deployment {
  const envPusd = process.env.PUSD_ADDRESS as Hex | undefined;
  const envLedger = process.env.LEDGER_ADDRESS as Hex | undefined;
  const registry = process.env.REGISTRY_ADDRESS as Hex | undefined;

  if (chainId === 31337) {
    return { pusd: envPusd ?? ANVIL.pusd, ledger: envLedger ?? ANVIL.ledger, registry };
  }
  if (!envPusd || !envLedger) {
    throw new Error(`PUSD_ADDRESS / LEDGER_ADDRESS env not set for chainId ${chainId}`);
  }
  return { pusd: envPusd, ledger: envLedger, registry };
}
