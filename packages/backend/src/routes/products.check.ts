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

// ─── D-09: create conflict (case/space variant) ──────────────────────────────
const createConflictRes = await call('POST', '/products', modCookie, {
  name: '  p14 CHECK ' + stamp + '  ',
  price: '5',
});
assert.equal(createConflictRes.status, 409);
assert.equal((createConflictRes.data as { error: string }).error, 'DUPLICATE_PRODUCT_NAME');

// ─── D-09: case-variant rename of A's own name is not a conflict ────────────
const selfRenameRes = await call('PATCH', `/products/${id}`, modCookie, {
  name: 'p14 check ' + stamp,
  price: '12.5',
});
assert.equal(selfRenameRes.status, 200);
assert.equal((selfRenameRes.data as { price: string }).price, '12.50');

// ─── Unchanged save writes no audit row ──────────────────────────────────────
const unchangedRes = await call('PATCH', `/products/${id}`, modCookie, {
  name: 'p14 check ' + stamp,
  price: '12.50',
});
assert.equal(unchangedRes.status, 200);

// ─── Second product ───────────────────────────────────────────────────────────
const createBRes = await call('POST', '/products', modCookie, {
  name: 'P14 Other ' + stamp,
  price: '1',
});
assert.equal(createBRes.status, 201);
const idB = (createBRes.data as { id: number }).id;

// ─── D-09: rename conflict ────────────────────────────────────────────────────
const renameConflictRes = await call('PATCH', `/products/${idB}`, modCookie, {
  name: 'P14 CHECK ' + stamp,
});
assert.equal(renameConflictRes.status, 409);

// ─── D-10: legacy duplicate (created outside the API) can still be re-priced ─
const legacy = await prisma.product.create({
  data: { organizationId: 1, name: 'P14 Other ' + stamp, price: '2' },
});
const idLegacy = legacy.id;
const legacyRepriceRes = await call('PATCH', `/products/${idLegacy}`, modCookie, {
  name: 'P14 Other ' + stamp,
  price: '3',
});
assert.equal(legacyRepriceRes.status, 200);

// ─── Toggle A off as moderator ────────────────────────────────────────────────
const toggleOffRes = await call('PATCH', `/products/${id}/toggle`, modCookie);
assert.equal(toggleOffRes.status, 200);
assert.equal((toggleOffRes.data as { isActive: boolean }).isActive, false);

// ─── Inactive names still block create ───────────────────────────────────────
const inactiveBlockRes = await call('POST', '/products', modCookie, {
  name: 'P14 check ' + stamp,
  price: '1',
});
assert.equal(inactiveBlockRes.status, 409);

// ─── D-07: toggle A back on as admin — audit has no role branch ─────────────
const toggleOnRes = await call('PATCH', `/products/${id}/toggle`, adminCookie);
assert.equal(toggleOnRes.status, 200);
assert.equal((toggleOnRes.data as { isActive: boolean }).isActive, true);

// ─── Delete A; race losers get 404 ────────────────────────────────────────────
const deleteARes = await call('DELETE', `/products/${id}`, modCookie);
assert.equal(deleteARes.status, 204);

const deleteAAgainRes = await call('DELETE', `/products/${id}`, modCookie);
assert.equal(deleteAAgainRes.status, 404);

const toggleDeletedRes = await call('PATCH', `/products/${id}/toggle`, modCookie);
assert.equal(toggleDeletedRes.status, 404);

// ─── Deleted names are free again ────────────────────────────────────────────
const createA2Res = await call('POST', '/products', modCookie, {
  name: 'P14 Check ' + stamp,
  price: '1',
});
assert.equal(createA2Res.status, 201);
const idA2 = (createA2Res.data as { id: number }).id;

// ─── Full audit trail for A ───────────────────────────────────────────────────
const auditRowsA = await prisma.auditLog.findMany({
  where: { tableName: 'products', rowId: id },
  orderBy: { id: 'asc' },
});
assert.deepEqual(
  auditRowsA.map((r) => r.fieldName),
  [null, 'name', 'price', 'isActive', 'isActive', 'deletedAt'],
);
assert.equal(auditRowsA[1].oldValue, 'P14 Check ' + stamp);
assert.equal(auditRowsA[1].newValue, 'p14 check ' + stamp);
assert.equal(auditRowsA[2].oldValue, '10.00');
assert.equal(auditRowsA[2].newValue, '12.50');
assert.equal(auditRowsA[3].oldValue, 'true');
assert.equal(auditRowsA[3].newValue, 'false');
assert.equal(auditRowsA[3].userUsername, modName);
assert.equal(auditRowsA[4].oldValue, 'false');
assert.equal(auditRowsA[4].newValue, 'true');
assert.equal(auditRowsA[4].userUsername, 'admin');
assert.equal(auditRowsA[5].oldValue, null);
assert.ok(Number.isFinite(Date.parse(auditRowsA[5].newValue!)));
for (const row of auditRowsA) {
  assert.equal(row.saleId, null);
}

// ─── Audit trail for the legacy duplicate: price only, no name row ──────────
const auditRowsLegacy = await prisma.auditLog.findMany({
  where: { tableName: 'products', rowId: idLegacy },
  orderBy: { id: 'asc' },
});
assert.equal(auditRowsLegacy.length, 1);
assert.equal(auditRowsLegacy[0].fieldName, 'price');
assert.equal(auditRowsLegacy[0].oldValue, '2.00');
assert.equal(auditRowsLegacy[0].newValue, '3.00');

// ─── Cleanup ──────────────────────────────────────────────────────────────────
for (const cleanupId of [idB, idLegacy, idA2]) {
  const res = await call('DELETE', `/products/${cleanupId}`, modCookie);
  assert.equal(res.status, 204);
}

const deleteModRes = await call('DELETE', `/users/${modId}`, adminCookie);
assert.equal(deleteModRes.status, 204);

await prisma.$disconnect();
console.log('product checks passed');
