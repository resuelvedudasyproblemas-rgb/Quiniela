module.exports = async function handler(req, res) {
  const tournament = String(req.query.tournament || "8");
  const season = String(req.query.season || "97268");
  const urls = [
    "https://www.sofascore.com/api/v1/unique-tournament/"+tournament+"/season/"+season+"/events/next/0",
    "https://api.sofascore.app/api/v1/unique-tournament/"+tournament+"/season/"+season+"/events/next/0",
    "https://api.sofascore.com/api/v1/unique-tournament/"+tournament+"/season/"+season+"/events/next/0"
  ];
  const out = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "accept": "application/json,text/plain,*/*",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
          "user-agent": "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140 Safari/537.36"
        },
        redirect: "follow"
      });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      const events = Array.isArray(parsed?.events) ? parsed.events : [];
      out.push({
        url,
        status: r.status,
        events: events.length,
        hasNextPage: parsed?.hasNextPage ?? null,
        sample: events.slice(0,5).map(e => ({
          id:e.id,
          startTimestamp:e.startTimestamp,
          status:e?.status?.type,
          home:e?.homeTeam?.name,
          away:e?.awayTeam?.name
        })),
        text: text.slice(0,120)
      });
    } catch (e) {
      out.push({url,error:String(e)});
    }
  }
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({tournament,season,out});
};