export interface EvalContext {
  orgAId: string
  orgBId: string
  userAId: string
  userBId: string
}

let _context: EvalContext | null = null

export function setEvalContext(ctx: EvalContext): void {
  _context = ctx
}

export function getEvalContext(): EvalContext {
  if (!_context) {
    throw new Error(
      'evals/context.ts: eval context not initialized. setup.ts must run before any *.eval.ts file.',
    )
  }
  return _context
}
