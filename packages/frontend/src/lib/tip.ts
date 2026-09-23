import type { KeyboardEvent } from 'react';

// Frontend tip input rules (D-12, D-15). Mirrors packages/backend/src/lib/tip.ts's
// parseTip regex — keep the two in sync.
export const TIP_PATTERN = /^\d{1,8}(\.\d{0,2})?$/;

export const TIP_ERROR = 'Enter an amount like 20 or 20.50 (no negatives, max 2 decimals)';

export function isZeroTip(v: string): boolean {
  return /^0+(\.0{0,2})?$/.test(v);
}

export function blockNonTipKeys(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[\d.]/.test(e.key)) {
    e.preventDefault();
  }
}
