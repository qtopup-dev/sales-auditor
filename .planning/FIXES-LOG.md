# Production Fixes Log

Ad-hoc production bug fixes outside the normal GSD phase workflow. Newest first.

---

## 2026-07-10 — Admin summary: voided sales inflating breakdown counts (WR-01)

**Symptom:** `productBreakdown`, `mopBreakdown`, and `trendData` in `/api/admin/summary` counted both active and voided sales, while `totalRevenue` counted active-only — so per-product/MOP/trend sums didn't reconcile with the headline totals (flagged as WR-01 in the Phase 06 code review, `.planning/phases/06-add-dashboard-kpi-summary-cards-to-admin-dashboard-top/06-REVIEW.md`).

**Fix:** `packages/backend/src/routes/admin.ts` — changed `totalCount`, `productBreakdown`, `mopBreakdown`, and `trendData` queries to filter `status: 'active'` only (was `status: { in: ['active', 'void'] }` / raw SQL `status IN ('active', 'void')`), matching `totalRevenue`.

**Verified:** `/api/admin/summary` now returns `totalCount`, and the three breakdown sums, all equal (201/201/201/201) — previously the breakdowns summed to one more than `totalCount` (209 vs 208) because they included a voided sale.

**Commit:** `b5a289c` — `fix(backend): make admin summary totalCount/breakdowns active-only`

**Not yet fixed (same review, lower priority):** WR-02 (silent CSV export error swallowing in `DashboardPage.tsx`), IN-01 (unguarded `req.session.organizationId!` non-null assertion), IN-02 (magic `staleTime` number), IN-03 (unnecessary arrow wrapper on `onVoid` prop).

---

## 2026-07-10 — Deactivate toggle returns 400 for products/MOPs/receivers

**Symptom:** Clicking the deactivate/reactivate toggle for products, MOPs, or receivers always returned `400 Bad Request` in production (`audit.quickyx.xyz`), 100% reproducible. The regular "Edit" PATCH (rename/reprice) worked fine.

**Root cause:** The three toggle mutations (`ProductsPage.tsx`, `MopsPage.tsx`, `ReceiversPage.tsx`) called `api.patch(url)` with **no request body**. Somewhere in the OpenLiteSpeed (aaPanel outer proxy, terminates Cloudflare's TLS) → Docker frontend container hop, a bodyless PATCH gets mangled on the wire. The frontend container's own nginx (`packages/frontend/nginx.conf`) then rejects the malformed request with its own default 400 error page — the request never reaches Express at all. Requests with any body (even `{}`) pass through fine.

**How this was diagnosed** (useful precedent for similar "400 with no app-level error" reports on this stack):
1. Confirmed the 400 response body was nginx's own default error page (recognizable by the "padding to disable MSIE and Chrome friendly error page" HTML comments), not JSON from Express — meaning the request died before reaching the app.
2. `docker logs <frontend-container>` access log showed the frontend container's *own* nginx logged the 400 for this exact request — confirming that layer, not Express, generated it.
3. Replaying the identical request (headers + cookies, via Chrome's "Copy as cURL") directly to the frontend container (`127.0.0.1:8080`, bypassing OLS/Cloudflare) **succeeded** — proving the request content itself was valid and the problem lives in a layer between the browser and the container.
4. Attempts to test the aaPanel/OpenLiteSpeed layer directly via `curl --resolve` failed with `Broken pipe` — this turned out to be a dead end (curl connecting from `127.0.0.1` isn't a Cloudflare IP, and the origin likely only accepts connections from Cloudflare's ranges given it uses a Cloudflare Origin CA certificate — this is unrelated to the actual bug).
5. Confirmed via the real browser (`fetch()` from DevTools console, real session/cookies, real Cloudflare→OLS→container path) that adding an explicit JSON body (`body: JSON.stringify({})`) made the exact same call return `200` instead of `400`. This isolated "no body" as the trigger without needing a redeploy to test.

**Fix:** Added an explicit `{}` body to all three toggle calls:
- `packages/frontend/src/pages/ProductsPage.tsx`
- `packages/frontend/src/pages/MopsPage.tsx`
- `packages/frontend/src/pages/ReceiversPage.tsx`

**Commit:** `aa36f5b` — `fix(frontend): send explicit body on toggle PATCH requests`

**Deployed:** pushed to `master`, which triggers `.github/workflows/deploy.yml` (SSH → `git reset --hard` → `docker compose build` → `prisma migrate deploy` → `docker compose up -d`).

**Update:** `UsersPage.tsx`'s bodyless `api.post('/auth/invite')` was tested next (see below) and did **not** hit this same 400 — the invite POST succeeds fine bodyless. So the bodyless-request proxy quirk doesn't trigger deterministically for every bodyless call; treat it as a real but not-fully-understood trigger condition, not "any bodyless request always fails."

**Infra note for future debugging:** This VPS's aaPanel install uses **OpenLiteSpeed**, not nginx, as the outer reverse proxy in front of the Docker containers (despite `nginx` vhost config files existing under `/www/server/panel/vhost/nginx/` — those aren't actually active; live logs are at `/www/wwwlogs/<domain>_ols.access_log` / `_ols.error_log`). The chain is: Cloudflare → OpenLiteSpeed (TLS termination, Cloudflare Origin CA cert) → Docker `frontend` container (nginx, `packages/frontend/nginx.conf`) → Docker `backend` container (Express). Any future "400 with no error log entry anywhere" reports on this stack should be treated as a possible bodyless-request-vs-OLS-proxy issue first.

---

## 2026-07-10 — Invite link shows literal `$host` instead of the domain

**Symptom:** Admin-generated invite links (`POST /api/auth/invite`) came back as `https://$host/invite/<token>` — the literal text `$host`, not the actual domain. Manually editing the URL to swap `$host` for the real domain made the link work fine, pointing at a header/proxy issue rather than an app bug.

**Root cause:** Not in this repo — it's aaPanel's auto-generated **OpenLiteSpeed** reverse-proxy config for the site, at `/www/server/panel/vhost/openlitespeed/proxy/audit.quickyx.xyz/urlrewrite/a1f855102de043a1a276a0b7c1ebf695_audit.quickyx.xyz.conf`:

```
RewriteRule ^/(.*)$ http://proxy_ea8a4/$1 [P,E=Proxy-Host:$host]
```

The `E=Proxy-Host:$host` flag is meant to forward the real incoming `Host` header to the backend (the standard OLS/Apache pattern for preserving the original Host header across a reverse proxy, otherwise the backend sees `127.0.0.1:8080`). But `$host` is nginx variable syntax, not valid in OpenLiteSpeed/Apache `RewriteRule` syntax — the correct token is `%{HTTP_HOST}`. Since `$host` didn't resolve to anything, OLS forwarded it as the literal string, which is exactly what `req.get('host')` in `packages/backend/src/routes/auth.ts:150` then saw and used to build the invite URL.

**Fix (server-side only, not in git):** On the VPS,
```bash
sed -i 's/E=Proxy-Host:\$host/E=Proxy-Host:%{HTTP_HOST}/' \
  /www/server/panel/vhost/openlitespeed/proxy/audit.quickyx.xyz/urlrewrite/a1f855102de043a1a276a0b7c1ebf695_audit.quickyx.xyz.conf
systemctl restart lsws
```

**Caveat:** This config is likely regenerated by aaPanel's panel UI if the reverse-proxy settings for this site are ever edited again through the dashboard (e.g. changing the proxied port). If `$host` reappears in invite links after touching that panel screen, reapply this same fix.

---

## 2026-07-10 — Invite link redirects to `/login` for anonymous visitors

**Symptom:** After fixing the domain above, pasting a fresh invite link into an incognito tab loaded fine (`200` on `/invite/<token>`) but immediately bounced to `/login` instead of showing the registration form.

**Root cause:** `packages/frontend/src/main.tsx:20` fires `GET /api/auth/me` on every app boot (to rehydrate the Zustand auth store from the session cookie), before the router even renders. For an anonymous visitor this call correctly 401s — but that response goes through the shared axios instance, and its response interceptor (`packages/frontend/src/lib/axios.ts`) redirects to `/login` on **any** 401 anywhere in the app, only skipping the redirect when already on `/login`. It didn't know `/invite/:token` (`packages/frontend/src/router/index.tsx:37`) is also a public route, so the background session check's expected 401 bounced anonymous invite visitors to `/login` before `InviteRegisterPage` ever got a chance to render.

**Fix:** `packages/frontend/src/lib/axios.ts` — also skip the redirect when `currentPath.startsWith('/invite/')`.

**Commit:** _(pushed same session as the OLS fix above — see git log for exact hash)_

**Pattern to remember:** any future public/unauthenticated route added to `router/index.tsx` needs the same exemption added to this interceptor, or it'll suffer the identical bounce-to-login bug from the `/auth/me` bootstrap call.
