// Runnable assert-based check of parseTip's value rules (D-12..D-15). This is the
// phase's one runnable check of the money/validation rules — no test framework.
// Run: npx tsx packages/backend/src/lib/tip.check.ts

import assert from 'node:assert/strict';
import { parseTip } from './tip.js';

// Returns null
assert.equal(parseTip(''), null);
assert.equal(parseTip('   '), null);
assert.equal(parseTip(null), null);
assert.equal(parseTip(undefined), null);
assert.equal(parseTip('0'), null);
assert.equal(parseTip('0.00'), null);
assert.equal(parseTip('000'), null);
assert.equal(parseTip('0.'), null);

// Returns a canonical string
assert.equal(parseTip('20'), '20.00');
assert.equal(parseTip('20.5'), '20.50');
assert.equal(parseTip('20.50'), '20.50');
assert.equal(parseTip('007.5'), '7.50');
assert.equal(parseTip('20.'), '20.00');
assert.equal(parseTip('99999999.99'), '99999999.99');
assert.equal(parseTip(20.5), '20.50');

// Throws
assert.throws(() => parseTip('-5'));
assert.throws(() => parseTip('-0'));
assert.throws(() => parseTip('+5'));
assert.throws(() => parseTip('20.505'));
assert.throws(() => parseTip('100000000'));
assert.throws(() => parseTip('abc'));
assert.throws(() => parseTip('1e3'));
assert.throws(() => parseTip('12a'));
assert.throws(() => parseTip('.5'));
assert.throws(() => parseTip('1,000'));
assert.throws(() => parseTip(-5));
assert.throws(() => parseTip(['5']));
assert.throws(() => parseTip(true));
assert.throws(() => parseTip({}));

console.log('tip checks passed');
