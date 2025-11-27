import Fastify from "fastify";
import { generateDualStateProof, generateQStreamProof, verifyDualStateProof, verifyQStreamProof } from "@syndual/zk";

const server = Fastify({ logger: true });

server.get("/health", async () => ({ status: "ok" }));

server.post("/dual-state/proof", async (request, reply) => {
  const { state0, state1, selector } = request.body as {
    state0: string;
    state1: string;
    selector: 0 | 1;
  };

  try {
    const proof = await generateDualStateProof(state0, state1, selector);
    const valid = await verifyDualStateProof(proof);
    return { proof, valid };
  } catch (err) {
    request.log.error(err);
    reply.status(500);
    return { error: "failed to generate proof" };
  }
});

server.post("/qstream/proof", async (request, reply) => {
  const { ratePerSecond, elapsedTime } = request.body as {
    ratePerSecond: string;
    elapsedTime: string;
  };

  try {
    const rate = BigInt(ratePerSecond);
    const elapsed = BigInt(elapsedTime);
    const proof = await generateQStreamProof(rate, elapsed);
    const valid = await verifyQStreamProof(proof);
    return { proof, valid };
  } catch (err) {
    request.log.error(err);
    reply.status(500);
    return { error: "failed to generate proof" };
  }
});

const port = Number(process.env.PORT || 3001);
// TODO: secure server and add auth/gating for production usage
server.listen({ port, host: "0.0.0.0" }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
