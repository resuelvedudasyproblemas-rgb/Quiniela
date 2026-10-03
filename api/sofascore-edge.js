export const config = { runtime: "edge" };

async function requestedWith() {
  const slot = Math.floor(Date.now() / 1000 / 1800);
  const bytes = new TextEncoder().encode(String(slot));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 6);
}

function headers(xrw) {
  return {
    "accept": "application/json,text/plain,*/*",
    "accept-language": "es-ES,es;q=0.9,en;q=0.8",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "cache-control": "no-cache, no-store, max-age=0",
    "pragma": "no-cache",
    "origin": "https://www.sofascore.com",
    "referer": "https://www.sofascore.com/",
    "x-requested-with": xrw
  };
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const input = new URL(request.url);
  const eventId = String(input.searchParams.get("event") || "");
  const kind = String(input.searchParams.get("kind") || "");

  if (!/^\d{5,12}$/.test(eventId) || !["event", "incidents"].includes(kind)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const suffix = kind === "incidents" ? "/incidents" : "";
  const upstreamUrl = `https://www.sofascore.com/api/v1/event/${eventId}${suffix}`;

  const candidates = [await requestedWith(), "XMLHttpRequest"];
  let last = null;

  for (const xrw of candidates) {
    const response = await fetch(upstreamUrl, {
      headers: headers(xrw),
      cache: "no-store",
      redirect: "follow"
    });
    const body = await response.text();
    last = { response, body };
    if (response.ok) {
      return new Response(body, {
        status: response.status,
        headers: {
          "content-type": response.headers.get("content-type") || "application/json",
          "cache-control": "no-store, max-age=0"
        }
      });
    }
    if (response.status !== 403) break;
  }

  return new Response(last?.body || JSON.stringify({ error: "sofascore_fetch_failed" }), {
    status: last?.response?.status || 502,
    headers: {
      "content-type": last?.response?.headers.get("content-type") || "application/json",
      "cache-control": "no-store, max-age=0"
    }
  });
}
