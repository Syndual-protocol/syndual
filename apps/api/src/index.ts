import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { generateDualStateProof, generateQStreamProof, verifyDualStateProof, verifyQStreamProof } from "@syndual/zk";
import {
  DualStateProof,
  QStreamProof,
  ProtocolError,
  OperationStatus,
  ValidationResult,
  TransactionResult,
} from "@syndual/core-types";
import {
  validateDualStateProof,
  validateQStreamProof,
  validateStream,
  calculateStreamFlow,
  hashDualState,
  batchValidateProofs,
} from "@syndual/sdk";

// ==================== Request/Response Types ====================

interface GenerateDualStateProofRequest {
  state0: string;
  state1: string;
  selector: 0 | 1;
}

interface GenerateDualStateProofResponse {
  proof: DualStateProof;
  valid: boolean;
  timestamp: number;
  gasEstimate?: number;
}

interface GenerateQStreamProofRequest {
  ratePerSecond: string;
  elapsedTime: string;
  streamId?: string;
  metadata?: Record<string, unknown>;
}

interface GenerateQStreamProofResponse {
  proof: QStreamProof;
  valid: boolean;
  timestamp: number;
  estimatedFlow?: string;
}

interface VerifyProofRequest {
  proof: DualStateProof | QStreamProof;
  proofType: "dual-state" | "qstream";
}

interface VerifyProofResponse {
  valid: boolean;
  validationResult: ValidationResult;
  timestamp: number;
}

interface ValidateStreamRequest {
  from: string;
  to: string;
  ratePerSecond: string;
  start: number;
  end: number;
  total?: string;
}

interface BatchProofRequest {
  proofs: (DualStateProof | QStreamProof)[];
  types: ("dual-state" | "qstream")[];
}

interface BatchProofResponse {
  results: ValidationResult[];
  totalValid: number;
  totalInvalid: number;
  timestamp: number;
}

interface StreamInfoRequest {
  streamId: string;
}

interface StreamInfoResponse {
  streamId: string;
  from: string;
  to: string;
  ratePerSecond: string;
  start: number;
  end: number;
  status: string;
  progress: number;
  totalFlowed: string;
  remainingAmount: string;
  timestamp: number;
}

interface ProofStatsResponse {
  totalProofsGenerated: number;
  totalProofsVerified: number;
  successRate: number;
  averageGenerationTime: number;
  averageVerificationTime: number;
  timestamp: number;
}

interface ConfigResponse {
  version: string;
  features: {
    dualState: boolean;
    qstream: boolean;
    hybridProofs: boolean;
    batchProcessing: boolean;
  };
  limits: {
    maxProofSize: number;
    maxBatchSize: number;
    maxStreamsPerBatch: number;
  };
  timestamp: number;
}

interface ErrorResponse extends ProtocolError {
  requestId: string;
}

// ==================== Server Setup ====================

const server = Fastify({ 
  logger: true,
  requestIdHeader: "x-request-id",
  requestIdLogLabel: "requestId",
});

// Request counter for monitoring
let requestCounter = 0;

// Error handler middleware
const errorHandler = (err: any, statusCode: number = 500): ErrorResponse => {
  const requestId = `req-${requestCounter}`;
  return {
    code: `ERR_${statusCode}`,
    message: err.message || "An error occurred",
    details: { originalError: err.name },
    timestamp: Date.now(),
    requestId,
  };
};

// ==================== Health & Status Endpoints ====================

server.get("/health", async () => ({
  status: "ok",
  timestamp: Date.now(),
  uptime: process.uptime(),
}));

server.get("/status", async () => ({
  status: "operational",
  timestamp: Date.now(),
  requestsProcessed: requestCounter,
}));

// ==================== Dual-State Endpoints ====================

server.post<{ Body: GenerateDualStateProofRequest }>(
  "/dual-state/proof",
  async (request: FastifyRequest<{ Body: GenerateDualStateProofRequest }>, reply: FastifyReply) => {
    requestCounter++;
    const { state0, state1, selector } = request.body;

    try {
      if (!state0 || !state1 || selector === undefined) {
        reply.status(400);
        return errorHandler(new Error("state0, state1, and selector are required"), 400);
      }

      const proof = await generateDualStateProof(state0, state1, selector);
      const valid = await verifyDualStateProof(proof);
      const validation = await validateDualStateProof(proof);
      const stateHash = hashDualState({ state0, state1, createdAt: Date.now() });

      const response: GenerateDualStateProofResponse = {
        proof,
        valid,
        timestamp: Date.now(),
        gasEstimate: 150000,
      };

      reply.status(200);
      return response;
    } catch (err: any) {
      request.log.error(err);
      reply.status(500);
      return errorHandler(err, 500);
    }
  }
);

server.post<{ Body: VerifyProofRequest }>(
  "/proof/verify",
  async (request: FastifyRequest<{ Body: VerifyProofRequest }>, reply: FastifyReply) => {
    requestCounter++;
    const { proof, proofType } = request.body;

    try {
      let validationResult: ValidationResult;

      if (proofType === "dual-state") {
        validationResult = await validateDualStateProof(proof as DualStateProof);
      } else if (proofType === "qstream") {
        validationResult = await validateQStreamProof(proof as QStreamProof);
      } else {
        reply.status(400);
        return errorHandler(new Error("Invalid proofType"), 400);
      }

      const response: VerifyProofResponse = {
        valid: validationResult.valid,
        validationResult,
        timestamp: Date.now(),
      };

      reply.status(200);
      return response;
    } catch (err: any) {
      request.log.error(err);
      reply.status(500);
      return errorHandler(err, 500);
    }
  }
);

// ==================== Stream Validation Endpoints ====================



server.post<{ Body: GenerateQStreamProofRequest }>(
  "/qstream/proof",
  async (request: FastifyRequest<{ Body: GenerateQStreamProofRequest }>, reply: FastifyReply) => {
    requestCounter++;
    const { ratePerSecond, elapsedTime, streamId, metadata } = request.body;

    try {
      if (!ratePerSecond || !elapsedTime) {
        reply.status(400);
        return errorHandler(new Error("ratePerSecond and elapsedTime are required"), 400);
      }

      const rate = BigInt(ratePerSecond);
      const elapsed = BigInt(elapsedTime);
      const proof = await generateQStreamProof(rate, elapsed);
      const valid = await verifyQStreamProof(proof);
      const validation = await validateQStreamProof(proof);

      const estimatedFlow = (rate * elapsed).toString();

      const response: GenerateQStreamProofResponse = {
        proof,
        valid,
        timestamp: Date.now(),
        estimatedFlow,
      };

      reply.status(200);
      return response;
    } catch (err: any) {
      request.log.error(err);
      reply.status(500);
      return errorHandler(err, 500);
    }
  }
);

// ==================== Stream Validation Endpoints ====================

server.post<{ Body: ValidateStreamRequest }>(
  "/stream/validate",
  async (request: FastifyRequest<{ Body: ValidateStreamRequest }>, reply: FastifyReply) => {
    requestCounter++;
    const { from, to, ratePerSecond, start, end, total } = request.body;

    try {
      const stream = {
        from,
        to,
        ratePerSecond: BigInt(ratePerSecond),
        start: BigInt(start),
        end: BigInt(end),
        total: total ? BigInt(total) : undefined,
      };

      const validationResult = validateStream(stream);

      reply.status(validationResult.valid ? 200 : 400);
      return validationResult;
    } catch (err: any) {
      request.log.error(err);
      reply.status(500);
      return errorHandler(err, 500);
    }
  }
);

// ==================== Batch Operations ====================

server.post<{ Body: BatchProofRequest }>(
  "/batch/verify-proofs",
  async (request: FastifyRequest<{ Body: BatchProofRequest }>, reply: FastifyReply) => {
    requestCounter++;
    const { proofs, types } = request.body;

    try {
      if (!proofs || !types || proofs.length !== types.length) {
        reply.status(400);
        return errorHandler(new Error("proofs and types arrays must match in length"), 400);
      }

      const results = await batchValidateProofs(proofs);

      const response: BatchProofResponse = {
        results,
        totalValid: results.filter((r) => r.valid).length,
        totalInvalid: results.filter((r) => !r.valid).length,
        timestamp: Date.now(),
      };

      reply.status(200);
      return response;
    } catch (err: any) {
      request.log.error(err);
      reply.status(500);
      return errorHandler(err, 500);
    }
  }
);

// ==================== Server Start ====================

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";

server.listen({ port, host }).catch((err) => {
  server.log.error(err);
  process.exit(1);
});

export default server;
