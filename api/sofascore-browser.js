module.exports = async function handler(req, res) {
  const raw = Array.isArray(req.query.event) ? req.query.event[0] : req.query.event;
  const eventId = String(raw || "");
  if (!/^\d{5,12}$/.test(eventId)) {
    res.status(400).json({ error: "invalid_event" });
    return;
  }

  let browser;
  try {
    const puppeteer = require("puppeteer-core");
    const chromium = require("@sparticuz/chromium");
    chromium.setGraphicsMode = false;
    browser = await puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: "shell"
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    );

    let settle;
    const incidentsPromise = new Promise(resolve => {
      settle = resolve;
      page.on("response", async response => {
        const url = response.url();
        if (!url.includes(`/api/v1/event/${eventId}/incidents`)) return;
        try {
          const status = response.status();
          const text = await response.text();
          if (status >= 200 && status < 300) {
            const json = JSON.parse(text);
            resolve({ ok: true, status, json, url });
          } else {
            resolve({ ok: false, status, body: text.slice(0, 500), url });
          }
        } catch (error) {
          resolve({ ok: false, status: response.status(), error: String(error), url });
        }
      });
    });

    const widget =
      `https://widgets.sofascore.com/embed/lineups?id=${eventId}&widgetTheme=light&_live=${Date.now()}`;

    await page.goto(widget, { waitUntil: "domcontentloaded", timeout: 15000 });

    const result = await Promise.race([
      incidentsPromise,
      new Promise(resolve => setTimeout(() => resolve({ ok: false, timeout: true }), 12000))
    ]);

    if (!result || !result.ok) {
      res.status(502).json({ error: "sofascore_incidents_unavailable", detail: result || null });
      return;
    }

    const incidents = Array.isArray(result.json?.incidents) ? result.json.incidents : [];
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).json({ event: Number(eventId), incidents, source: "sofascore-widget-browser" });
  } catch (error) {
    res.status(500).json({
      error: "browser_failed",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? String(error.stack||"").slice(0,1800) : ""
    });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
};

module.exports.config = { maxDuration: 30 };
