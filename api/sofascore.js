const crypto = require("crypto");

function requestedWith() {
  const slot = Math.floor(Date.now() / 1000 / 1800);
  return crypto.createHash("sha256").update(String(slot)).digest("hex").slice(0, 6);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const rawEvent = Array.isArray(req.query.event) ? req.query.event[0] : req.query.event;
  const kind = Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind;
  const eventId = String(rawEvent || "");

  if (!/^\d{5,12}$/.test(eventId) || !["event", "incidents"].includes(String(kind || ""))) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const suffix = kind === "incidents" ? "/incidents" : "";
  const url = `https://www.sofascore.com/api/v1/event/${eventId}${suffix}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "accept": "application/json,text/plain,*/*",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "cache-control": "no-cache, no-store, max-age=0",
        "pragma": "no-cache",
        "origin": "https://www.sofascore.com",
        "referer": "https://www.sofascore.com/",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "x-requested-with": requestedWith()
      },
      cache: "no-store"
    });

    const text = await upstream.text();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.status(upstream.status).send(text);
  } catch (error) {
    res.status(502).json({
      error: "sofascore_fetch_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
