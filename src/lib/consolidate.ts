import { PrivateKey, P2PKH, Transaction, Utils } from "@bsv/sdk";

export interface WocUtxo {
  height: number;
  tx_pos: number;
  tx_hash: string;
  value: number;
}

export interface ConsolidationProgress {
  stage: "scanning" | "fetching" | "building" | "signing" | "broadcasting" | "done" | "error";
  message: string;
  current?: number;
  total?: number;
}

export type ProgressCb = (p: ConsolidationProgress) => void;

const WOC_BASE = "https://api.whatsonchain.com/v1/bsv/main";
const ARC_URL = "https://arc.taal.com/v1/tx";
const BEARER = "Bearer mainnet_063497d3209bb0e11c262b96495cc9ea";

// Throttled fetch queue — WhatsOnChain limit ~3 req/s. We pace at 340ms.
const WOC_INTERVAL_MS = 340;
let wocChain: Promise<unknown> = Promise.resolve();
function wocFetch(url: string, init?: RequestInit): Promise<Response> {
  const run = wocChain.then(async () => {
    const started = Date.now();
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: BEARER,
      },
    });
    const elapsed = Date.now() - started;
    if (elapsed < WOC_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, WOC_INTERVAL_MS - elapsed));
    }
    return res;
  });
  // Keep the chain alive even if a request errors
  wocChain = run.catch(() => undefined);
  return run;
}

export async function fetchUtxos(address: string): Promise<WocUtxo[]> {
  const res = await wocFetch(`${WOC_BASE}/address/${address}/unspent`);
  if (!res.ok) throw new Error(`WoC unspent failed: ${res.status}`);
  return res.json();
}

export async function fetchBeef(txid: string): Promise<number[]> {
  const res = await wocFetch(`${WOC_BASE}/tx/${txid}/beef`);
  if (!res.ok) throw new Error(`BEEF fetch failed for ${txid}: ${res.status}`);
  // Endpoint returns hex string
  const hex = (await res.text()).trim().replace(/^"|"$/g, "");
  return Utils.toArray(hex, "hex");
}

export interface ConsolidationResult {
  txid: string;
  rawTx: string;
  inputCount: number;
  totalSatoshis: number;
  arcResponse: unknown;
}

export async function consolidate(
  wifOrHex: string,
  onProgress: ProgressCb
): Promise<ConsolidationResult> {
  // Parse private key — accept WIF or hex
  let key: PrivateKey;
  try {
    key = PrivateKey.fromWif(wifOrHex.trim());
  } catch {
    key = PrivateKey.fromHex(wifOrHex.trim());
  }
  const address = key.toAddress();

  onProgress({ stage: "scanning", message: `Scanning UTXOs for ${address}…` });
  const utxos = await fetchUtxos(address);
  if (utxos.length === 0) throw new Error("No UTXOs found for this address.");

  const tx = new Transaction();
  const p2pkh = new P2PKH();
  const unlocker = p2pkh.unlock(key);

  let total = 0;
  for (let i = 0; i < utxos.length; i++) {
    const u = utxos[i];
    onProgress({
      stage: "fetching",
      message: `Fetching BEEF for input ${i + 1}/${utxos.length} (${u.tx_hash.slice(0, 12)}…)`,
      current: i + 1,
      total: utxos.length,
    });
    const beef = await fetchBeef(u.tx_hash);
    const sourceTx = Transaction.fromBEEF(beef);
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: u.tx_pos,
      unlockingScriptTemplate: unlocker,
    });
    total += u.value;
  }

  onProgress({ stage: "building", message: `Adding output paying ${total} sats to ${address}` });
  tx.addOutput({
    lockingScript: p2pkh.lock(address),
    satoshis: total,
  });

  onProgress({ stage: "signing", message: "Signing all inputs…" });
  await tx.sign();

  const rawHex = tx.toHex();
  const txid = tx.id("hex") as string;

  onProgress({ stage: "broadcasting", message: "Broadcasting to ARC (Taal) with SkipFeeValidation…" });
  const arcRes = await fetch(ARC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SkipFeeValidation": "true",
      "Authorization": "Bearer mainnet_063497d3209bb0e11c262b96495cc9ea",
    },
    body: JSON.stringify({ rawTx: rawHex }),
  });
  const arcJson = await arcRes.json().catch(() => ({}));
  if (!arcRes.ok) {
    throw new Error(
      `ARC rejected tx [${arcRes.status}]: ${JSON.stringify(arcJson)}`
    );
  }

  onProgress({ stage: "done", message: "Broadcast successful." });
  return {
    txid,
    rawTx: rawHex,
    inputCount: utxos.length,
    totalSatoshis: total,
    arcResponse: arcJson,
  };
}
