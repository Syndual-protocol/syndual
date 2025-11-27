import { FormEvent, useEffect, useState } from "react";
import { ethers } from "ethers";
import { SynDualClient } from "@syndual/sdk";

const mockAddresses = {
  token: "0x0000000000000000000000000000000000000000",
  dualStateEngine: "0x0000000000000000000000000000000000000000",
  qStreamPayments: "0x0000000000000000000000000000000000000000",
};

export default function QStreamPage() {
  const [to, setTo] = useState("0x000000000000000000000000000000000000dEaD");
  const [rate, setRate] = useState("1000000000000000");
  const [elapsed, setElapsed] = useState("60");
  const [status, setStatus] = useState("");
  const [proof, setProof] = useState<any>(null);

  const [client, setClient] = useState<SynDualClient | null>(null);

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC || "http://localhost:8545");
    const wallet = ethers.Wallet.createRandom().connect(provider);
    setClient(new SynDualClient({ provider, signer: wallet, addresses: mockAddresses }));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setStatus("Generating Q-Stream proof...");
    setProof(null);
    try {
      const rateBigInt = BigInt(rate);
      const elapsedBigInt = BigInt(elapsed);
      const generated = await client.requestQStreamProof(rateBigInt, elapsedBigInt);
      setProof(generated);
      setStatus("Proof generated (mock)");
    } catch (err) {
      console.error(err);
      setStatus("Failed to generate proof");
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-sky-100">Q-Stream Micropayments</h1>
      <p className="mt-2 text-slate-300">
        Model a continuous SyndualToken stream, then simulate zk-backed settlement of the owed amount over elapsed time.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <label className="text-sm text-slate-300">Recipient</label>
          <input
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-300">Rate per second (wei)</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300">Elapsed seconds</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-100"
              value={elapsed}
              onChange={(e) => setElapsed(e.target.value)}
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-2 font-semibold text-slate-50 shadow hover:bg-sky-500"
        >
          Generate Proof
        </button>
        {status && <p className="text-sm text-sky-300">{status}</p>}
      </form>

      {proof && (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-sky-100">Proof Output</h2>
          <p className="mt-2 text-slate-300">Owed amount (wei): {BigInt(rate) * BigInt(elapsed)}</p>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap text-sm text-slate-200">
            {JSON.stringify(proof, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
