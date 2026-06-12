/**
 * Token estimation. We deliberately avoid a tokenizer dependency:
 * ~4 chars/token is accurate enough for log text (within ±15%), and the
 * point of this tool is relative savings, not exact billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
