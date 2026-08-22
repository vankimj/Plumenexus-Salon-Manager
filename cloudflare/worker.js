// tenant-router — Cloudflare Worker for *.plumenexus.com routing.
//
// Wildcard CNAME *.plumenexus.com → plumenexus-prod.web.app is
// proxied through Cloudflare (orange cloud). Cloudflare forwards the
// Host header verbatim, but Firebase Hosting rejects requests whose
// Host it doesn't recognize as a registered custom domain. This Worker
// rewrites Host so Firebase accepts any tenant subdomain, while the
// browser still sees the original subdomain.plumenexus.com URL — which
// the React app reads via window.location.hostname (src/lib/tenant.js)
// to resolve the tenant.
//
// Why a Worker at all: Firebase Hosting has a hard 20-subdomain-per-apex
// cap on customDomain registrations (SSL minting limit) and rejects
// wildcards in the customDomain API. For SaaS scale we need a single
// proxy that handles all subdomains. Cloudflare Universal SSL covers
// *.plumenexus.com for free, so the cert layer is solved without
// per-tenant work.
//
// Specific subdomains with their own Firebase customDomain registration
// (admin.plumenexus.com → plumenexus-admin site, demo.plumenexus.com,
// www.plumenexus.com → marketing) have proxy=OFF on their DNS entry, so
// Cloudflare doesn't see those requests at all — this Worker never runs
// for them, and the more-specific DNS records win over the wildcard.
//
// Deploy via Cloudflare API or `npx wrangler deploy` (uses wrangler.toml).
// Currently deployed via API; the script id at Cloudflare is `tenant-router`.

const FIREBASE_HOST = 'plumenexus-prod.web.app';

// Subdomains that are separate Firebase Hosting sites (other Plume Nexus
// apps), not salon tenants. Belt-and-suspenders: trips.plumenexus.com is
// served via a specific grey-cloud CNAME + Firebase customDomain (the
// mesapicks/admin pattern), so this Worker normally never sees it — the map
// only matters if someone flips that DNS record back to proxied.
const HOST_MAP = {
  'trips.plumenexus.com': 'plumenexus-trips.web.app',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const originalHost = url.hostname;
    const upstreamHost = HOST_MAP[originalHost] || FIREBASE_HOST;
    const upstreamUrl = `https://${upstreamHost}${url.pathname}${url.search}`;
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set('host', upstreamHost);
    upstreamHeaders.set('x-forwarded-host', originalHost);
    const upstreamReq = new Request(upstreamUrl, {
      method:  request.method,
      headers: upstreamHeaders,
      body:    ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow',
    });
    const response = await fetch(upstreamReq);
    // Strip X-Frame-Options so platform-admin tenant preview iframe can render.
    const headers = new Headers(response.headers);
    headers.delete('x-frame-options');
    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
