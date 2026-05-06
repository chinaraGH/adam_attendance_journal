import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

type DlqFailureParams = {
  provider: "schedule" | "gaudi";
  operation: string;
  payload: unknown;
  errorCode: string;
  errorMessage: string;
  category: "temporary" | "validation" | "business";
  correlationId?: string;
  attempts?: number;
  maxAttempts?: number;
  errorStack?: string | null;
};

function computeNextRetryAt(attempts: number): Date {
  const backoffMinutes = Math.min(60, Math.max(1, 2 ** Math.max(0, attempts - 1)));
  return new Date(Date.now() + backoffMinutes * 60 * 1000);
}

export async function enqueueIntegrationDlqFailure(params: DlqFailureParams) {
  const attempts = params.attempts ?? 0;
  const maxAttempts = params.maxAttempts ?? 5;
  const nextRetryAt = params.category === "temporary" ? computeNextRetryAt(attempts + 1) : null;
  const status = params.category === "temporary" ? "pending" : "dead";

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.integration_dlq (
        id,
        provider,
        operation,
        payload_json,
        error_code,
        error_message,
        category,
        attempts,
        max_attempts,
        next_retry_at,
        status,
        correlation_id,
        last_error_at,
        last_error_stack,
        created_at,
        updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,now(),now()
      )
    `,
    randomUUID(),
    params.provider,
    params.operation,
    JSON.stringify(params.payload ?? null),
    params.errorCode,
    params.errorMessage,
    params.category,
    attempts,
    maxAttempts,
    nextRetryAt,
    status,
    params.correlationId ?? null,
    params.errorStack ?? null,
  );
}
