/**
 * Safe error response helper for API routes.
 *
 * SECURITY (H3): Error responses must NEVER leak internal schema details, stack
 * traces, SDK error messages, or failure modes to clients. These help attackers
 * understand the DB schema (e.g. PrismaClientValidationError exposes
 * SocialPostWhereInput fields), SDK usage (e.g. "Function invoke failed with
 * status 429"), and failure modes.
 *
 * In production: always returns a generic "Internal server error" message.
 * In development: returns the actual error message (useful for debugging).
 *
 * The full error is ALWAYS logged server-side via console.error so devs can
 * diagnose issues without exposing details to clients.
 */

export interface SafeErrorBody {
  error: string
}

export function safeErrorResponse(
  err: unknown,
  context: string,
): SafeErrorBody {
  // Always log the full error server-side with the route context.
  console.error(`[${context}]`, err)

  // In production: generic message (no schema/stack/SDK leak).
  // In development: actual error message (faster debugging).
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Internal server error' }
  }

  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)
  return { error: message }
}
