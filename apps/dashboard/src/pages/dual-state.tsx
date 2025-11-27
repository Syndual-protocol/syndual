import { FormEvent, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { SynDualClient } from "@syndual/sdk";

const mockAddresses = {
  token: "0x0000000000000000000000000000000000000000",
  dualStateEngine: "0x0000000000000000000000000000000000000000",
  qStreamPayments: "0x0000000000000000000000000000000000000000",
};

export default function DualStatePage() {
  const [keyInput, setKeyInput] = useState("dual-key");
  const [state0, setState0] = useState("state-0-hash");
  const [state1, setState1] = useState("state-1-hash");
  const [selector, setSelector] = useState<0 | 1>(0);
  const [status, setStatus] = useState<string>("");
  const [proofPayload, setProofPayload] = useState<any>(null);
  const [finalized, setFinalized] = useState<string>("");

  const [client, setClient] = useState<SynDualClient | null>(null);

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC || "http://localhost:8545");
    const wallet = ethers.Wallet.createRandom().connect(provider);
    setClient(new SynDualClient({ provider, signer: wallet, addresses: mockAddresses }));
  }, []);

  const keyHash = useMemo(() => ethers.keccak256(ethers.toUtf8Bytes(keyInput)), [keyInput]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setStatus("Generating proof...");
    setFinalized("");
    setProofPayload(null);
    try {
      const proof = await client.requestDualStateProof(state0, state1, selector);
      setProofPayload(proof);
      setStatus("Proof generated (mock)");
      try {
        const chosen = await client.finalizeState(keyHash, selector);
        setFinalized(chosen);
      } catch (err) {
        // No live contract; surface mock message instead of hard failing
        setFinalized("finalization pending on-chain");
        console.warn(err);
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to generate proof");
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-sky-100">Dual-State Playground</h1>
      <p className="mt-2 text-slate-300">
        Define dual states, generate a mocked ZK-DualProof, and finalize selection through the Gate-01 Engine interface.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <label className="text-sm text-slate-300">Key</label>
          <input
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Derived key hash: {keyHash.slice(0, 10)}...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-300">State 0 (hash)</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
              value={state0}
              onChange={(e) => setState0(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">State 1 (hash)</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
              value={state1}
              onChange={(e) => setState1(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">Chosen state</label>
          <select
            className="rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
            value={selector}
            onChange={(e) => setSelector(Number(e.target.value) as 0 | 1)}
          >
            <option value={0}>State 0</option>
            <option value={1}>State 1</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold text-slate-50 shadow hover:bg-sky-500"
        >
          Generate Proof
        </button>
        {status && <p className="text-sm text-sky-300">{status}</p>}
      </form>

      {proofPayload && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-sky-100">Proof Output</h2>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-sm text-slate-200">
            {JSON.stringify(proofPayload, null, 2)}
          </pre>
          {finalized && <p className="mt-3 text-sm text-slate-300">Finalized state: {finalized}</p>}
        </section>
      )}
    </main>
  );
}
