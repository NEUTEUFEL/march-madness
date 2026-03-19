#!/bin/bash
# Auto-update scores from NCAA API to Supabase
# Run: bash scripts/update_scores.sh

SUPABASE_URL="https://ayvpzgytivcklgwrzocz.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5dnB6Z3l0aXZja2xnd3J6b2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTgxMjUsImV4cCI6MjA4OTQzNDEyNX0.sV7tyjsB7HG8Q9b1KtjOZbeSUyO4THPo_RVHR1Cn3Hk"
DATE=$(date +"%Y/%m/%d")

echo "Checking scores for $DATE..."

python3 << 'PYEOF'
import json, subprocess, urllib.parse, os, sys

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

NAME_MAP = {
    "Ohio St.": "Ohio State", "Michigan St.": "Michigan State",
    "North Dakota St.": "North Dakota State", "South Fla.": "South Florida",
    "Kennesaw St.": "Kennesaw State", "Saint Mary's (CA)": "Saint Mary's",
    "Hawaii": "Hawai'i", "Miami (OH)": "M-OH/SMU", "Miami Ohio": "M-OH/SMU",
    "Tenn. St.": "Tennessee State", "Tennessee St.": "Tennessee State",
    "Utah St.": "Utah State", "Wright St.": "Wright State",
}

def resolve(name):
    return NAME_MAP.get(name, name)

def update_team(team, data):
    encoded = urllib.parse.quote(team)
    subprocess.run([
        "curl", "-s", "-X", "PATCH",
        f"{SUPABASE_URL}/rest/v1/team_states?team_name=eq.{encoded}",
        "-H", f"apikey: {SUPABASE_KEY}", "-H", f"Authorization: Bearer {SUPABASE_KEY}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(data)
    ], capture_output=True)

# Fetch current team states
result = subprocess.run([
    "curl", "-s", f"{SUPABASE_URL}/rest/v1/team_states?select=team_name,wins,eliminated",
    "-H", f"apikey: {SUPABASE_KEY}", "-H", f"Authorization: Bearer {SUPABASE_KEY}",
], capture_output=True, text=True)
current = {t["team_name"]: t for t in json.loads(result.stdout)}

# Fetch NCAA scores
from datetime import datetime
now = datetime.now()
url = f"https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/{now.year}/{now.month:02d}/{now.day:02d}"
result = subprocess.run(["curl", "-s", url], capture_output=True, text=True)
data = json.loads(result.stdout)

updates = 0
for g in data.get("games", []):
    game = g.get("game", g)
    if game.get("gameState") != "final":
        continue

    away = game.get("away", {})
    home = game.get("home", {})
    away_name = resolve(away.get("names", {}).get("short", ""))
    home_name = resolve(home.get("names", {}).get("short", ""))
    away_score = int(away.get("score", 0) or 0)
    home_score = int(home.get("score", 0) or 0)

    if away_score == 0 and home_score == 0:
        continue

    winner = away_name if away_score > home_score else home_name
    loser = home_name if away_score > home_score else away_name

    # Update winner
    if winner in current and not current[winner].get("eliminated"):
        new_wins = current[winner].get("wins", 0) + 1
        if new_wins != current[winner].get("wins", 0) + 1 or current[winner].get("wins", 0) == 0:
            # Only update if not already updated
            expected_wins = current[winner].get("wins", 0)
            if expected_wins < new_wins:
                update_team(winner, {"wins": new_wins})
                print(f"  WIN: {winner} -> {new_wins} wins")
                updates += 1

    # Eliminate loser
    if loser in current and not current[loser].get("eliminated"):
        update_team(loser, {"eliminated": True})
        print(f"  OUT: {loser}")
        updates += 1

if updates == 0:
    print("  No new updates.")
else:
    print(f"  {updates} updates applied.")
PYEOF
