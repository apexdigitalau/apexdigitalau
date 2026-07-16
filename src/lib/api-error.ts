import { NextResponse } from 'next/server'

/**
 * Structured failures for routes that call third parties (Anthropic, Google).
 *
 * These routes used to collapse every failure to `err.message`, so a 401 from
 * Anthropic, a Supabase RLS rejection and a JSON parse bug all surfaced in the
 * UI as one indistinguishable red box. That made a missing ANTHROPIC_API_KEY
 * read like a broken model name. Every failure now names the stage it happened
 * in and carries the upstream status and message verbatim.
 */
export interface ApiErrorBody {
  /** Short, user-facing. Safe to render directly. */
  error: string
  /** Which step of the route failed. */
  stage: string
  /** HTTP status from the third party, or null if the failure was local. */
  upstream_status: number | null
  /** The third party's own error text, or null if the failure was local. */
  upstream_error: string | null
}

/**
 * Thrown when a third-party call fails, preserving the context a bare Error
 * would drop. Routes let this bubble to their catch and call `failure()`.
 */
export class UpstreamError extends Error {
  readonly stage: string
  readonly upstreamStatus: number | null
  readonly upstreamError: string | null
  /** Status to return to our own client. */
  readonly httpStatus: number

  constructor(opts: {
    message: string
    stage: string
    upstreamStatus?: number | null
    upstreamError?: string | null
    httpStatus?: number
  }) {
    super(opts.message)
    this.name = 'UpstreamError'
    this.stage = opts.stage
    this.upstreamStatus = opts.upstreamStatus ?? null
    this.upstreamError = opts.upstreamError ?? null
    this.httpStatus = opts.httpStatus ?? 500
  }
}

/**
 * Pull a human-readable message out of whatever an upstream returned.
 * Covers the shapes we actually receive:
 *   Anthropic / Gmail  -> { error: { message } }
 *   Google OAuth       -> { error, error_description }
 *   Supabase           -> { message }
 * Falls back to serialised JSON so an unrecognised shape still tells us
 * something rather than becoming null.
 */
export function describeUpstream(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') return data.slice(0, 500) || null

  const d = data as Record<string, any>
  const candidates = [
    d.error?.message,
    d.error_description,
    typeof d.error === 'string' ? d.error : null,
    d.message,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.slice(0, 500)
  }

  try {
    return JSON.stringify(data).slice(0, 500)
  } catch {
    return null
  }
}

/** Build a structured error response directly. */
export function failWith(opts: {
  error: string
  stage: string
  upstreamStatus?: number | null
  upstreamError?: string | null
  status?: number
}): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: opts.error,
      stage: opts.stage,
      upstream_status: opts.upstreamStatus ?? null,
      upstream_error: opts.upstreamError ?? null,
    },
    { status: opts.status ?? 500 }
  )
}

/**
 * Catch-all for a route's outer try/catch. `fallbackStage` is used only when
 * the thrown value carries no stage of its own (i.e. an unexpected crash).
 */
export function failure(
  err: unknown,
  fallbackStage: string,
  fallbackMessage = 'Request failed'
): NextResponse<ApiErrorBody> {
  if (err instanceof UpstreamError) {
    return failWith({
      error: err.message || fallbackMessage,
      stage: err.stage,
      upstreamStatus: err.upstreamStatus,
      upstreamError: err.upstreamError,
      status: err.httpStatus,
    })
  }

  const message = err instanceof Error ? err.message : String(err)
  return failWith({
    error: message || fallbackMessage,
    stage: fallbackStage,
    upstreamError: null,
    status: 500,
  })
}

/** Turn a Supabase error into a structured response. */
export function failSupabase(
  stage: string,
  err: { message?: string; code?: string; details?: string } | null,
  userMessage = 'Database error'
): NextResponse<ApiErrorBody> {
  return failWith({
    error: userMessage,
    stage,
    upstreamStatus: null,
    upstreamError: describeUpstream(err),
    status: 500,
  })
}
