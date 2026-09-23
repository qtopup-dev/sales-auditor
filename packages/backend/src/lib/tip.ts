// Single backend source of tip value rules (D-07..D-16). Pure string operations, no
// imports, no float math — money is never touched with JS float arithmetic (CLAUDE.md
// Rule 6). Keep packages/frontend/src/lib/tip.ts's TIP_PATTERN in sync with the regex here.

export function parseTip(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new Error('INVALID_TIP');
  }

  const trimmed = String(raw).trim();
  if (trimmed === '') return null; // blank = no tip (D-09)

  // Rejects signs/negatives, letters, exponents, commas, spaces (D-15), more than 2
  // decimals (D-13), and more than 8 integer digits i.e. above 99999999.99 (D-14).
  // Trailing dot ("20.") is allowed so a live frontend check doesn't flash mid-typing.
  if (!/^\d{1,8}(\.\d{0,2})?$/.test(trimmed)) {
    throw new Error('INVALID_TIP');
  }

  const [intPartRaw, decPartRaw = ''] = trimmed.split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const decPart = decPartRaw.padEnd(2, '0');
  const canonical = `${intPart}.${decPart}`;

  if (canonical === '0.00') return null; // one representation of "no tip" (D-12)
  return canonical;
}
