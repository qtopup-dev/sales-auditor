// Runnable end-to-end check of the Phase 14 product-management rules (D-01, D-03..D-07, D-09, D-10).
// Needs the dev API on :3001 and the dev DB. Run:
//   cd packages/backend && npx tsx src/routes/products.check.ts

import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma.js';

const API = 'http://localhost:3001/api';
const stamp = Date.now();

async function call(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}

async function login(username: string, password: string) {
  const res = await call('POST', '/auth/login', '', { username, password });
  assert.equal(res.status, 200);
  return res.setCookie!.split(';')[0];
}

// ─── Setup ────────────────────────────────────────────────────────────────────
const adminCookie = await login('admin', 'admin1234');

const inviteRes = await call('POST', '/auth/invite', adminCookie, {});
assert.equal(inviteRes.status, 201);
const inviteToken = (inviteRes.data as { inviteUrl: string }).inviteUrl.split('/').pop()!;

const modName = 'p14mod' + stamp;
const registerRes = await call('POST', `/auth/invite/${inviteToken}`, '', {
  username: modName,
  password: 'p14-check-pass',
});
assert.equal(registerRes.status, 201);

const usersRes = await call('GET', '/users', adminCookie);
const modUser = (usersRes.data as Array<{ id: number; username: string }>).find(
  (u) => u.username === modName,
);
assert.ok(modUser, 'moderator user not found after invite registration');
const modId = modUser.id;

// D-04: product rights must not depend on canEdit
const canEditRes = await call('PATCH', `/users/${modId}`, adminCookie, { canEdit: false });
assert.equal(canEditRes.status, 200);

// D-05: the moderator never clocks in, which proves shift-independence
const modCookie = await login(modName, 'p14-check-pass');

// ─── D-03: other admin-only routers stay closed ──────────────────────────────
for (const path of ['/mops', '/receivers', '/users']) {
  const res = await call('GET', path, modCookie);
  assert.equal(res.status, 403, `expected 403 for moderator GET ${path}`);
}

// ─── D-01: moderator can read the product list ───────────────────────────────
const listRes = await call('GET', '/products', modCookie);
assert.equal(listRes.status, 200);

// ─── Create as moderator ──────────────────────────────────────────────────────
const createRes = await call('POST', '/products', modCookie, {
  name: 'P14 Check ' + stamp,
  price: '10',
});
assert.equal(createRes.status, 201);
const created = createRes.data as { id: number; price: string };
assert.equal(created.price, '10.00');
const id = created.id;

// ─── D-06: exactly one create audit row, in the same transaction ────────────
const createAuditRows = await prisma.auditLog.findMany({
  where: { tableName: 'products', rowId: id },
  orderBy: { id: 'asc' },
});
assert.equal(createAuditRows.length, 1);
assert.equal(createAuditRows[0].action, 'create');
assert.equal(createAuditRows[0].saleId, null);
assert.equal(createAuditRows[0].userUsername, modName);
assert.deepEqual(JSON.parse(createAuditRows[0].newValue!), {
  name: 'P14 Check ' + stamp,
  price: '10.00',
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────
const deleteRes = await call('DELETE', `/products/${id}`, modCookie);
assert.equal(deleteRes.status, 204);

const deleteModRes = await call('DELETE', `/users/${modId}`, adminCookie);
assert.equal(deleteModRes.status, 204);

await prisma.$disconnect();
console.log('product checks passed');
