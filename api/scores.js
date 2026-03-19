export default async function handler(req, res) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  try {
    const response = await fetch(
      `https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/${y}/${m}/${d}`
    );
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=15");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
}
