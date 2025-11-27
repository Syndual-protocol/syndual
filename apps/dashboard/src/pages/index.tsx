import Link from "next/link";

const sections = [
  {
    title: "Dual-State Cryptography",
    href: "/dual-state",
    summary: "Define dual states, generate ZK-DualProofs, and finalize via Gate-01 Engine.",
  },
  {
    title: "Q-Stream Micropayments",
    href: "/qstream",
    summary: "Stream SyndualToken over time and simulate zk-backed settlement.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">SynDual Protocol</p>
        <h1 className="text-4xl font-semibold text-sky-200">Quantum-inspired dual-state cryptography</h1>
        <p className="max-w-3xl text-lg text-slate-300">
          Explore Dual-State Cryptography (DSC), the Gate-01 Engine, ZK-DualProof (ZKDP), and Q-Stream micropayments
          through a minimal dashboard powered by the SynDual SDK.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 mt-10">
        {sections.map((section) => (
          <Link key={section.title} href={section.href} className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg transition hover:-translate-y-1 hover:border-sky-500">
            <h2 className="text-2xl font-semibold text-sky-100">{section.title}</h2>
            <p className="mt-3 text-slate-300">{section.summary}</p>
            <span className="mt-4 inline-block text-sm text-sky-300">Open ?</span>
          </Link>
        ))}
      </section>

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold text-sky-100">How it works</h3>
        <p className="mt-3 text-slate-300">
          Dual states are committed on-chain, ZK-DualProof verifies selections without revealing the alternate state, and
          Q-Stream continuously settles SyndualToken. The current build uses mocked providers and proof generation hooks
          to illustrate the integration points.
        </p>
      </section>
    </main>
  );
}
