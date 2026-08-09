#!/usr/bin/env bash
# End-to-end tracer for the Void Request workflow (Phase 12 Plan 02).
# Proves, against a running dev API and the live database:
#   moderator create -> admin list -> admin approve -> sale voided -> audit written
#   plus the reject path, three role gates, the duplicate guard, re-request-after-
#   rejection, and both approve/reject idempotency guards.
#
# Usage: API_BASE=http://localhost:3002/api bash 12-02-tracer.sh
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001/api}"

# NOTE: git-bash's /tmp (and POSIX-style /d/... paths) are virtual mappings that a
# native-Windows `node` process cannot resolve (ENOENT), so all scratch files live in a
# real Windows-style path (via `pwd -W`) next to this script instead of the default
# `mktemp` location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -W 2>/dev/null || pwd)"
TRACER_TMP_DIR="$(mktemp -d "${SCRIPT_DIR}/.tracer-tmp.XXXXXX")"
ADMIN_JAR="$(mktemp "${TRACER_TMP_DIR}/admin-cookies.XXXXXX")"
MOD_JAR="$(mktemp "${TRACER_TMP_DIR}/mod-cookies.XXXXXX")"
cleanup() {
  rm -rf "$TRACER_TMP_DIR"
}
trap cleanup EXIT

STEP=0
pass_count=0

# assert_status <description> <expected_status> <actual_status>
assert_status() {
  local desc="$1" expected="$2" actual="$3"
  STEP=$((STEP + 1))
  if [ "$expected" != "$actual" ]; then
    echo "FAIL [step $STEP] $desc — expected status $expected, got $actual" >&2
    exit 1
  fi
  pass_count=$((pass_count + 1))
  echo "PASS [step $STEP] $desc (status $actual)"
}

# assert_true <description> <node-boolean-expr-result: "true"|"false">
assert_true() {
  local desc="$1" result="$2"
  STEP=$((STEP + 1))
  if [ "$result" != "true" ]; then
    echo "FAIL [step $STEP] $desc" >&2
    exit 1
  fi
  pass_count=$((pass_count + 1))
  echo "PASS [step $STEP] $desc"
}

# http <method> <path> <cookie-jar> [body-json]
# Writes response body to a temp file, returns "<status> <bodyfile>" on stdout.
# Every PATCH call in this script passes a non-empty body (e.g. `'{}'`), which this
# function forwards to curl as `-d '{}'` — a bodyless PATCH is mangled by this deploy
# chain's outer proxy, so callers must never omit the 4th argument for PATCH.
http() {
  local method="$1" path="$2" jar="$3" body="${4:-}"
  local bodyfile
  bodyfile="$(mktemp "${TRACER_TMP_DIR}/resp.XXXXXX")"
  local status
  if [ -n "$body" ]; then
    status=$(curl -s -o "$bodyfile" -w '%{http_code}' -X "$method" "${API_BASE}${path}" \
      -H 'Content-Type: application/json' \
      -c "$jar" -b "$jar" \
      -d "$body")
  else
    status=$(curl -s -o "$bodyfile" -w '%{http_code}' -X "$method" "${API_BASE}${path}" \
      -c "$jar" -b "$jar")
  fi
  echo "$status $bodyfile"
}

echo "=== Void Request tracer — API_BASE=${API_BASE} ==="

# ─── 1. Log in as admin and moderator ──────────────────────────────────────────
read -r status bodyfile <<< "$(http POST /auth/login "$ADMIN_JAR" '{"username":"admin","password":"admin1234"}')"
assert_status "admin login" "200" "$status"
rm -f "$bodyfile"

# Reset a known moderator's password to a fixed test value so this script is
# self-contained (moderator seed accounts have unknown passwords in this env).
MOD_USERNAME="testmod"
read -r status bodyfile <<< "$(http GET /users "$ADMIN_JAR")"
assert_status "admin lists users to resolve moderator id" "200" "$status"
MOD_ID=$(node -e "
const rows = require('fs').readFileSync('$bodyfile', 'utf8');
const users = JSON.parse(rows);
const mod = users.find((u) => u.username === '$MOD_USERNAME' && u.role === 'moderator');
if (!mod) { console.error('moderator $MOD_USERNAME not found'); process.exit(1); }
console.log(mod.id);
")
rm -f "$bodyfile"

read -r status bodyfile <<< "$(http POST "/users/${MOD_ID}/reset-password" "$ADMIN_JAR" '{}')"
assert_status "admin resets moderator password" "200" "$status"
MOD_TEMP_PASSWORD=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).tempPassword)")
rm -f "$bodyfile"

read -r status bodyfile <<< "$(http POST /auth/login "$MOD_JAR" "{\"username\":\"${MOD_USERNAME}\",\"password\":\"${MOD_TEMP_PASSWORD}\"}")"
assert_status "moderator login" "200" "$status"
MOD_USER_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).id)")
rm -f "$bodyfile"

# ─── 2. Moderator resolves (or creates) a target sale it owns ────────────────
# NOTE: sets the global RESOLVED_SALE_ID rather than `echo`-returning via command
# substitution — assert_status/assert_true print PASS/FAIL to stdout, and capturing
# this function's stdout with $(...) would swallow those lines into the "return value".
resolve_or_create_sale() {
  RESOLVED_SALE_ID=""
  read -r status bodyfile <<< "$(http GET /sales "$MOD_JAR")"
  assert_status "moderator lists sales to resolve a target row" "200" "$status"
  local sale_id
  sale_id=$(node -e "
const sales = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
const mine = sales.find((s) => s.status === 'active' && s.createdById === ${MOD_USER_ID});
console.log(mine ? mine.id : '');
")
  rm -f "$bodyfile"

  if [ -n "$sale_id" ]; then
    RESOLVED_SALE_ID="$sale_id"
    return
  fi

  # No eligible row — clock in and create one.
  read -r status bodyfile <<< "$(http POST /shifts/clock-in "$MOD_JAR" '{}')"
  if [ "$status" != "200" ] && [ "$status" != "201" ]; then
    echo "FAIL clock-in expected 200/201, got $status" >&2
    exit 1
  fi
  rm -f "$bodyfile"

  read -r status bodyfile <<< "$(http GET /catalog/products "$MOD_JAR")"
  assert_status "moderator reads product catalog" "200" "$status"
  local product_id
  product_id=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'))[0].id)")
  rm -f "$bodyfile"

  read -r status bodyfile <<< "$(http GET /catalog/mops "$MOD_JAR")"
  assert_status "moderator reads MOP catalog" "200" "$status"
  local mop_id
  mop_id=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'))[0].id)")
  rm -f "$bodyfile"

  read -r status bodyfile <<< "$(http GET /catalog/receivers "$MOD_JAR")"
  assert_status "moderator reads receiver catalog" "200" "$status"
  local receiver_id
  receiver_id=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'))[0].id)")
  rm -f "$bodyfile"

  read -r status bodyfile <<< "$(http POST /sales "$MOD_JAR" "{\"productId\":${product_id},\"mopId\":${mop_id},\"receiverId\":${receiver_id},\"notes\":\"tracer fixture\"}")"
  assert_status "moderator creates a fixture sale row" "201" "$status"
  sale_id=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).id)")
  rm -f "$bodyfile"
  RESOLVED_SALE_ID="$sale_id"
}

resolve_or_create_sale
SALE_ID="$RESOLVED_SALE_ID"
echo "Target sale id: ${SALE_ID}"

# ─── 3. Role gate: admin attempting create -> 403 ──────────────────────────────
read -r status bodyfile <<< "$(http POST /void-requests "$ADMIN_JAR" "{\"saleId\":${SALE_ID},\"reason\":\"admin should not be able to do this\"}")"
assert_status "POST /void-requests as admin -> 403 (role gate, SC6)" "403" "$status"
rm -f "$bodyfile"

# ─── 4. Empty-reason validation -> 400 ─────────────────────────────────────────
read -r status bodyfile <<< "$(http POST /void-requests "$MOD_JAR" "{\"saleId\":${SALE_ID},\"reason\":\"\"}")"
assert_status "POST /void-requests with empty reason -> 400 (SC1)" "400" "$status"
rm -f "$bodyfile"

# ─── 5. Moderator creates a valid request -> 201, status pending ──────────────
read -r status bodyfile <<< "$(http POST /void-requests "$MOD_JAR" "{\"saleId\":${SALE_ID},\"reason\":\"tracer: wrong receiver\"}")"
assert_status "POST /void-requests as moderator -> 201" "201" "$status"
REQUEST_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).id)")
CREATED_STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).status)")
rm -f "$bodyfile"
assert_true "created request status is 'pending'" "$([ "$CREATED_STATUS" = "pending" ] && echo true || echo false)"

# ─── 6. Creating a request voids nothing ───────────────────────────────────────
read -r status bodyfile <<< "$(http GET /sales "$MOD_JAR")"
assert_status "moderator re-lists sales" "200" "$status"
SALE_STILL_ACTIVE=$(node -e "
const sales = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
const s = sales.find((x) => x.id === ${SALE_ID});
console.log(s && s.status === 'active' ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "target sale still 'active' after request creation" "$SALE_STILL_ACTIVE"

# ─── 7. Duplicate pending request -> 409 ───────────────────────────────────────
read -r status bodyfile <<< "$(http POST /void-requests "$MOD_JAR" "{\"saleId\":${SALE_ID},\"reason\":\"tracer: duplicate attempt\"}")"
assert_status "duplicate POST /void-requests -> 409 (D-02)" "409" "$status"
DUP_ERROR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).error)")
rm -f "$bodyfile"
assert_true "duplicate error code is DUPLICATE_PENDING_REQUEST" "$([ "$DUP_ERROR" = "DUPLICATE_PENDING_REQUEST" ] && echo true || echo false)"

# ─── 8. Role gate: moderator attempting list -> 403 ────────────────────────────
read -r status bodyfile <<< "$(http GET /void-requests "$MOD_JAR")"
assert_status "GET /void-requests as moderator -> 403 (role gate)" "403" "$status"
rm -f "$bodyfile"

# ─── 9. Admin lists requests ───────────────────────────────────────────────────
read -r status bodyfile <<< "$(http GET /void-requests "$ADMIN_JAR")"
assert_status "GET /void-requests as admin -> 200" "200" "$status"
LIST_OK=$(node -e "
const rows = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
const found = rows.find((r) => r.id === ${REQUEST_ID});
if (!found) { console.log('false'); process.exit(0); }
const priceOk = /^[0-9]+\.[0-9]{2}\$/.test(found.sale.priceSnapshot);
let orderedOk = true;
for (let i = 1; i < rows.length; i++) {
  if (rows[i - 1].createdAt < rows[i].createdAt) { orderedOk = false; break; }
}
console.log(priceOk && orderedOk ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "admin list contains request with valid priceSnapshot and desc order" "$LIST_OK"

# ─── 10. Pending count ──────────────────────────────────────────────────────────
read -r status bodyfile <<< "$(http GET /void-requests/pending-count "$ADMIN_JAR")"
assert_status "GET /void-requests/pending-count as admin -> 200" "200" "$status"
COUNT_OK=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).count >= 1 ? 'true' : 'false')")
rm -f "$bodyfile"
assert_true "pending-count >= 1 (D-09)" "$COUNT_OK"

# ─── 11. Pending sale ids (moderator's own) ────────────────────────────────────
read -r status bodyfile <<< "$(http GET /void-requests/pending-sale-ids "$MOD_JAR")"
assert_status "GET /void-requests/pending-sale-ids as moderator -> 200" "200" "$status"
SALE_IN_PENDING=$(node -e "
const body = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
console.log(body.saleIds.includes(${SALE_ID}) ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "target saleId present in moderator's pending-sale-ids" "$SALE_IN_PENDING"

# ─── 12. Role gate: moderator attempting approve -> 403 ────────────────────────
# All approve/reject PATCH calls below pass an explicit '{}' body through the http()
# helper, which sends it as `-d '{}'` — never a bodyless PATCH, which this deploy
# chain's outer proxy mangles (see http() above).
read -r status bodyfile <<< "$(http PATCH "/void-requests/${REQUEST_ID}/approve" "$MOD_JAR" '{}')"
assert_status "PATCH approve as moderator -> 403 (role gate, SC6)" "403" "$status"
rm -f "$bodyfile"

# ─── 13. Admin approves -> 200, request approved, sale voided ─────────────────
read -r status bodyfile <<< "$(http PATCH "/void-requests/${REQUEST_ID}/approve" "$ADMIN_JAR" '{}')"
assert_status "PATCH approve as admin -> 200 (SC3)" "200" "$status"
APPROVE_OK=$(node -e "
const body = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
console.log(
  body.status === 'approved' && body.reviewedAt !== null && body.sale.status === 'void'
    ? 'true' : 'false'
);
")
rm -f "$bodyfile"
assert_true "approve response: status approved, reviewedAt set, sale voided" "$APPROVE_OK"

# ─── 14. Repeat approve -> 404 (idempotency guard) ─────────────────────────────
read -r status bodyfile <<< "$(http PATCH "/void-requests/${REQUEST_ID}/approve" "$ADMIN_JAR" '{}')"
assert_status "repeat PATCH approve -> 404 (SC3 concurrency guard)" "404" "$status"
rm -f "$bodyfile"

# ─── 15. Audit log has a void entry ────────────────────────────────────────────
read -r status bodyfile <<< "$(http GET "/sales/${SALE_ID}/audit" "$ADMIN_JAR")"
assert_status "GET /sales/:id/audit as admin -> 200" "200" "$status"
AUDIT_OK=$(node -e "
const rows = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
console.log(rows.some((r) => r.action === 'void') ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "audit log has a 'void' entry (CLAUDE.md Rule 2)" "$AUDIT_OK"

# ─── 16. Pending-sale-ids no longer includes the approved sale ────────────────
read -r status bodyfile <<< "$(http GET /void-requests/pending-sale-ids "$MOD_JAR")"
assert_status "GET /void-requests/pending-sale-ids after approve -> 200" "200" "$status"
SALE_ABSENT=$(node -e "
const body = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
console.log(!body.saleIds.includes(${SALE_ID}) ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "target saleId absent from pending-sale-ids after approve" "$SALE_ABSENT"

# ─── 17. Reject path on a second row ───────────────────────────────────────────
resolve_or_create_sale
SALE_ID_2="$RESOLVED_SALE_ID"
echo "Second target sale id: ${SALE_ID_2}"

read -r status bodyfile <<< "$(http POST /void-requests "$MOD_JAR" "{\"saleId\":${SALE_ID_2},\"reason\":\"tracer: reject path\"}")"
assert_status "POST /void-requests for second sale -> 201" "201" "$status"
REQUEST_ID_2=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).id)")
rm -f "$bodyfile"

# Reject PATCH also sends `-d '{}'` (never bodyless) via the http() helper above.
read -r status bodyfile <<< "$(http PATCH "/void-requests/${REQUEST_ID_2}/reject" "$ADMIN_JAR" '{}')"
assert_status "PATCH reject as admin -> 200 (SC4)" "200" "$status"
REJECT_STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8')).status)")
rm -f "$bodyfile"
assert_true "reject response status is 'rejected'" "$([ "$REJECT_STATUS" = "rejected" ] && echo true || echo false)"

read -r status bodyfile <<< "$(http GET /sales "$MOD_JAR")"
assert_status "moderator re-lists sales after reject" "200" "$status"
SALE2_STILL_ACTIVE=$(node -e "
const sales = JSON.parse(require('fs').readFileSync('$bodyfile', 'utf8'));
const s = sales.find((x) => x.id === ${SALE_ID_2});
console.log(s && s.status === 'active' ? 'true' : 'false');
")
rm -f "$bodyfile"
assert_true "second sale remains 'active' after reject (SC4 — reject touches nothing)" "$SALE2_STILL_ACTIVE"

read -r status bodyfile <<< "$(http PATCH "/void-requests/${REQUEST_ID_2}/reject" "$ADMIN_JAR" '{}')"
assert_status "repeat PATCH reject -> 404 (repeat-reject guard)" "404" "$status"
rm -f "$bodyfile"

# ─── 18. Re-request after rejection succeeds (D-03) ────────────────────────────
read -r status bodyfile <<< "$(http POST /void-requests "$MOD_JAR" "{\"saleId\":${SALE_ID_2},\"reason\":\"tracer: re-request after rejection\"}")"
assert_status "POST /void-requests for same sale after rejection -> 201 (D-03)" "201" "$status"
rm -f "$bodyfile"

echo ""
echo "=== ALL ${pass_count} ASSERTIONS PASSED ==="
