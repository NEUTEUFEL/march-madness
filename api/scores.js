const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const NAME_MAP = {
  "Ohio St.": "Ohio State", "Michigan St.": "Michigan State",
  "North Dakota St.": "North Dakota State", "South Fla.": "South Florida",
  "Kennesaw St.": "Kennesaw State", "Saint Mary's (CA)": "Saint Mary's",
  "St. John's (NY)": "St. John's", "Miami (OH)": "Miami OH",
  "Miami Ohio": "Miami OH", "Hawaii": "Hawai'i",
  "LIU": "Long Island", "Cal Baptist": "CA Baptist",
  "Prairie View A&M": "PV A&M/Lehigh", "Prairie View": "PV A&M/Lehigh",
  "Tenn. St.": "Tennessee State", "Tennessee St.": "Tennessee State",
  "Utah St.": "Utah State", "Wright St.": "Wright State",
};

function resolve(name) {
  if (NAME_MAP[name]) return NAME_MAP[name];
  return name;
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");

    const ncaaRes = await fetch(
      `https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/${y}/${m}/${d}`
    );
    if (!ncaaRes.ok) {
      res.status(502).json({ error: "NCAA API unavailable" });
      return;
    }
    const ncaaData = await ncaaRes.json();
    const rawGames = ncaaData?.games || [];

    // Transform games into a clean format
    const games = rawGames.map((g) => {
      const game = g.game || g;
      const away = game.away || {};
      const home = game.home || {};
      return {
        id: game.gameID,
        state: game.gameState || "pre",
        period: game.currentPeriod || "",
        clock: game.contestClock || "",
        network: game.network || "",
        startTime: game.startTime || "",
        away: {
          name: resolve(away.names?.short || ""),
          score: away.score || "",
          seed: away.seed || "",
        },
        home: {
          name: resolve(home.names?.short || ""),
          score: home.score || "",
          seed: home.seed || "",
        },
      };
    });

    // Write to Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/live_scores?id=eq.1`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          games: JSON.stringify(games),
          updated_at: new Date().toISOString(),
        }),
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=15");
    res.status(200).json({ games, updated_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch scores", detail: e.message });
  }
}
