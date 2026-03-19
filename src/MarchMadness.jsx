import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "./supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend as RLegend } from "recharts";

const TEAMS = [
  {name:"Duke",seed:1,region:"East"},{name:"Siena",seed:16,region:"East"},{name:"Ohio State",seed:8,region:"East"},{name:"TCU",seed:9,region:"East"},{name:"St. John's",seed:5,region:"East"},{name:"Northern Iowa",seed:12,region:"East"},{name:"Kansas",seed:4,region:"East"},{name:"CA Baptist",seed:13,region:"East"},{name:"Louisville",seed:6,region:"East"},{name:"South Florida",seed:11,region:"East"},{name:"Michigan State",seed:3,region:"East"},{name:"North Dakota State",seed:14,region:"East"},{name:"UCLA",seed:7,region:"East"},{name:"UCF",seed:10,region:"East"},{name:"UConn",seed:2,region:"East"},{name:"Furman",seed:15,region:"East"},
  {name:"Florida",seed:1,region:"South"},{name:"PV A&M/Lehigh",seed:16,region:"South"},{name:"Clemson",seed:8,region:"South"},{name:"Iowa",seed:9,region:"South"},{name:"Vanderbilt",seed:5,region:"South"},{name:"McNeese",seed:12,region:"South"},{name:"Nebraska",seed:4,region:"South"},{name:"Troy",seed:13,region:"South"},{name:"North Carolina",seed:6,region:"South"},{name:"VCU",seed:11,region:"South"},{name:"Illinois",seed:3,region:"South"},{name:"Penn",seed:14,region:"South"},{name:"Saint Mary's",seed:7,region:"South"},{name:"Texas A&M",seed:10,region:"South"},{name:"Houston",seed:2,region:"South"},{name:"Idaho",seed:15,region:"South"},
  {name:"Arizona",seed:1,region:"West"},{name:"Long Island",seed:16,region:"West"},{name:"Villanova",seed:8,region:"West"},{name:"Utah State",seed:9,region:"West"},{name:"Wisconsin",seed:5,region:"West"},{name:"High Point",seed:12,region:"West"},{name:"Arkansas",seed:4,region:"West"},{name:"Hawai'i",seed:13,region:"West"},{name:"BYU",seed:6,region:"West"},{name:"Texas",seed:11,region:"West"},{name:"Gonzaga",seed:3,region:"West"},{name:"Kennesaw State",seed:14,region:"West"},{name:"Miami",seed:7,region:"West"},{name:"Missouri",seed:10,region:"West"},{name:"Purdue",seed:2,region:"West"},{name:"Queens",seed:15,region:"West"},
  {name:"Michigan",seed:1,region:"Midwest"},{name:"Howard",seed:16,region:"Midwest"},{name:"Georgia",seed:8,region:"Midwest"},{name:"Saint Louis",seed:9,region:"Midwest"},{name:"Texas Tech",seed:5,region:"Midwest"},{name:"Akron",seed:12,region:"Midwest"},{name:"Alabama",seed:4,region:"Midwest"},{name:"Hofstra",seed:13,region:"Midwest"},{name:"Tennessee",seed:6,region:"Midwest"},{name:"M-OH/SMU",seed:11,region:"Midwest"},{name:"Virginia",seed:3,region:"Midwest"},{name:"Wright State",seed:14,region:"Midwest"},{name:"Kentucky",seed:7,region:"Midwest"},{name:"Santa Clara",seed:10,region:"Midwest"},{name:"Iowa State",seed:2,region:"Midwest"},{name:"Tennessee State",seed:15,region:"Midwest"},
  {name:"New Mexico",seed:10,region:"N/A"},{name:"Xavier",seed:11,region:"N/A"},{name:"Drake",seed:11,region:"N/A"},{name:"Liberty",seed:12,region:"N/A"},
];

const REGION_COLORS = {East:"#2563eb",South:"#dc2626",West:"#16a34a",Midwest:"#d97706","N/A":"#9ca3af"};
const PICKS_LOCK = new Date("2026-03-19T12:15:00-04:00");

// Draft payment status
const DRAFT_PAID = {
  "Bethanie DeRose":true,"Kalvin Kerwin":true,"Charlie Johnson":true,"Derek Bratrud":true,
  "Franco Matticoli":true,"Gwen Baer":true,"Katie Close":true,"Laura Vidal":true,
  "Matthew Avila":true,"Mike Thiessen":true,"Sarah Jenkins":true,"Billy Jenkins":true,
  "Tanay Desai":true,"Lucas Neuteufel":true,
  "Rob Hunden":false,"Steven Haemmerle":false,
};
// Classic-only participants (not in draft)
const CLASSIC_ONLY = [
  {name:"Benjamin Pittenger",paid:true},
  {name:"Patty Tostado",paid:true},
  {name:"Shawn Gustafson",paid:true},
  {name:"Sheila Butler",paid:true},
];

const REGION_BRACKET = [
  [[[1,16],[8,9]],[[5,12],[4,13]]],
  [[[6,11],[3,14]],[[7,10],[2,15]]]
];
const FF_PAIRS = [["East","West"],["South","Midwest"]];
const SEED_PATH = {1:0,16:1,8:2,9:3,5:4,12:5,4:6,13:7,6:8,11:9,3:10,14:11,7:12,10:13,2:14,15:15};
const ROUND_NAMES = ["","R64","R32","Sweet 16","Elite 8","Final Four","Final"];

// ===================== BRACKET-AWARE MAX =====================
function computeBracketMax(picks, teamMap, teamState, allTeams) {
  const pickSet = new Set(picks.filter(Boolean));
  if (pickSet.size === 0) return 0;
  const findTeam = (region, seed) => allTeams.find(t => t.region === region && t.seed === seed);
  const upd = (map, k, v) => { if (!map.has(k) || map.get(k) < v) map.set(k, v); };

  function dp(node, region, round) {
    if (typeof node === "number") {
      const t = findTeam(region, node);
      if (!t || teamState[t.name]?.eliminated) return new Map([["_", 0]]);
      return pickSet.has(t.name) ? new Map([[t.name, 0], ["_", 0]]) : new Map([["_", 0]]);
    }
    const L = dp(node[0], region, round - 1);
    const R = dp(node[1], region, round - 1);
    const res = new Map();
    for (const [lk, lv] of L) for (const [rk, rv] of R) {
      const base = lv + rv;
      const lw = lk !== "_" ? (teamState[lk]?.wins || 0) : -1;
      const rw = rk !== "_" ? (teamState[rk]?.wins || 0) : -1;
      if (lw >= round) { upd(res, lk, base); }
      else if (rw >= round) { upd(res, rk, base); }
      else {
        upd(res, lk, base + ((lk !== "_" && pickSet.has(lk)) ? (teamMap[lk]?.seed || 0) : 0));
        upd(res, rk, base + ((rk !== "_" && pickSet.has(rk)) ? (teamMap[rk]?.seed || 0) : 0));
      }
    }
    return res;
  }

  function mergeGame(oL, oR, round) {
    const res = new Map();
    for (const [lk, lv] of oL) for (const [rk, rv] of oR) {
      const base = lv + rv;
      const lw = lk !== "_" ? (teamState[lk]?.wins || 0) : -1;
      const rw = rk !== "_" ? (teamState[rk]?.wins || 0) : -1;
      if (lw >= round) upd(res, lk, base);
      else if (rw >= round) upd(res, rk, base);
      else {
        upd(res, lk, base + ((lk !== "_" && pickSet.has(lk)) ? (teamMap[lk]?.seed || 0) : 0));
        upd(res, rk, base + ((rk !== "_" && pickSet.has(rk)) ? (teamMap[rk]?.seed || 0) : 0));
      }
    }
    return res;
  }

  const ro = {}; ["East","South","West","Midwest"].forEach(r => { ro[r] = dp(REGION_BRACKET, r, 4); });
  const ff1 = mergeGame(ro.East, ro.West, 5);
  const ff2 = mergeGame(ro.South, ro.Midwest, 5);
  let max = 0;
  for (const [lk, lv] of ff1) for (const [rk, rv] of ff2) {
    const base = lv + rv;
    const lw = lk !== "_" ? (teamState[lk]?.wins || 0) : -1;
    const rw = rk !== "_" ? (teamState[rk]?.wins || 0) : -1;
    if (lw >= 6) max = Math.max(max, base);
    else if (rw >= 6) max = Math.max(max, base);
    else {
      max = Math.max(max, base + ((lk !== "_" && pickSet.has(lk)) ? (teamMap[lk]?.seed || 0) : 0));
      max = Math.max(max, base + ((rk !== "_" && pickSet.has(rk)) ? (teamMap[rk]?.seed || 0) : 0));
    }
  }
  for (const p of picks) if (p && teamMap[p]?.region === "N/A" && !teamState[p]?.eliminated)
    max += teamMap[p].seed * (6 - (teamState[p]?.wins || 0));
  return max;
}

// ===================== BRACKET CONFLICTS =====================
function findConflicts(picks, teamMap, teamState) {
  const alive = picks.filter(p => p && !teamState[p]?.eliminated);
  const conflicts = [];
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = teamMap[alive[i]], b = teamMap[alive[j]];
    if (!a || !b) continue;
    let meetRound;
    if (a.region === b.region && a.region !== "N/A") {
      const xor = SEED_PATH[a.seed] ^ SEED_PATH[b.seed];
      meetRound = xor >= 8 ? 4 : xor >= 4 ? 3 : xor >= 2 ? 2 : 1;
    } else if (a.region !== "N/A" && b.region !== "N/A") {
      const inSameFF = FF_PAIRS.some(p => p.includes(a.region) && p.includes(b.region));
      meetRound = inSameFF ? 5 : 6;
    } else continue;
    const aw = teamState[alive[i]]?.wins || 0, bw = teamState[alive[j]]?.wins || 0;
    if (aw < meetRound && bw < meetRound)
      conflicts.push({ team1: alive[i], team2: alive[j], round: meetRound, roundName: ROUND_NAMES[meetRound], seed1: a.seed, seed2: b.seed });
  }
  return conflicts.sort((a, b) => a.round - b.round);
}

// ===================== MONTE CARLO SIMULATION =====================
function runSimulations(teamState, allTeams, numSims = 3000) {
  const findTeam = (region, seed) => allTeams.find(t => t.region === region && t.seed === seed);
  const totals = {};
  allTeams.forEach(t => { totals[t.name] = 0; });

  for (let sim = 0; sim < numSims; sim++) {
    const sw = {};
    allTeams.forEach(t => { sw[t.name] = teamState[t.name]?.wins || 0; });

    function simNode(node, region, round) {
      if (typeof node === "number") {
        const t = findTeam(region, node);
        return (t && !teamState[t.name]?.eliminated) ? t.name : null;
      }
      const L = simNode(node[0], region, round - 1);
      const R = simNode(node[1], region, round - 1);
      if (!L && !R) return null;
      if (!L) { if (sw[R] < round) sw[R]++; return R; }
      if (!R) { if (sw[L] < round) sw[L]++; return L; }
      if (sw[L] >= round) return L;
      if (sw[R] >= round) return R;
      const pL = teamState[L]?.win_prob ?? 0.5;
      const pR = teamState[R]?.win_prob ?? 0.5;
      const denom = pL + pR;
      if (Math.random() < (denom > 0 ? pL / denom : 0.5)) { sw[L]++; return L; }
      else { sw[R]++; return R; }
    }

    function simGame(a, b, round) {
      if (!a && !b) return null;
      if (!a) { if (sw[b] < round) sw[b]++; return b; }
      if (!b) { if (sw[a] < round) sw[a]++; return a; }
      if (sw[a] >= round) return a;
      if (sw[b] >= round) return b;
      const pA = teamState[a]?.win_prob ?? 0.5;
      const pB = teamState[b]?.win_prob ?? 0.5;
      const d = pA + pB;
      if (Math.random() < (d > 0 ? pA / d : 0.5)) { sw[a]++; return a; }
      else { sw[b]++; return b; }
    }

    const rc = {};
    ["East","South","West","Midwest"].forEach(r => { rc[r] = simNode(REGION_BRACKET, r, 4); });
    const f1 = simGame(rc.East, rc.West, 5);
    const f2 = simGame(rc.South, rc.Midwest, 5);
    simGame(f1, f2, 6);

    allTeams.forEach(t => { totals[t.name] += sw[t.name]; });
  }

  const result = {};
  allTeams.forEach(t => { result[t.name] = totals[t.name] / numSims; });
  return result;
}

// ===================== UI HELPERS =====================
const TeamSelect = ({value, onChange, teams}) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    className="w-full bg-surface text-sm border border-border rounded px-2 py-1.5 font-mono text-text-secondary focus:outline-none focus:border-accent cursor-pointer"
    style={{appearance:"auto"}}>
    <option value="">Select team...</option>
    {teams.map(t=><option key={t.name} value={t.name}>({t.seed}) {t.name}</option>)}
  </select>
);

function winDots(wins) {
  if (wins === 0) return null;
  const colors = ["bg-accent", "bg-accent", "bg-amber-500", "bg-orange-500", "bg-red-500", "bg-red-400"];
  return (
    <span className="inline-flex gap-0.5 ml-1.5">
      {Array.from({length: Math.min(wins, 6)}, (_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${colors[i] || "bg-accent"}`} />
      ))}
    </span>
  );
}

// ===================== MAIN COMPONENT =====================
export default function MarchMadness() {
  const [tab, setTab] = useState("leaderboard");
  const [teamState, setTeamState] = useState(()=>{
    const s = {}; TEAMS.forEach(t=>{s[t.name]={wins:0,eliminated:false,win_prob:0.5};}); return s;
  });
  const [drafters, setDrafters] = useState([]);
  const [newName, setNewName] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOdds, setShowOdds] = useState(false);
  const [isAdmin, setIsAdmin] = useState(()=>localStorage.getItem("mm_admin")==="1");
  const [selectedUser, setSelectedUser] = useState(()=>localStorage.getItem("mm_user")||"");
  const [timeline, setTimeline] = useState([]);
  const locked = Date.now() >= PICKS_LOCK.getTime();

  useEffect(() => {
    async function loadData() {
      const [teamRes, drafterRes] = await Promise.all([
        supabase.from("team_states").select("*"),
        supabase.from("drafters").select("*").order("id"),
      ]);
      let savedOdds = {};
      try { savedOdds = JSON.parse(localStorage.getItem("mm_odds") || "{}"); } catch {}
      if (teamRes.data) {
        const s = {};
        teamRes.data.forEach(r => {
          s[r.team_name] = { wins: r.wins, eliminated: r.eliminated, win_prob: r.win_prob ?? savedOdds[r.team_name] ?? 0.5 };
        });
        TEAMS.forEach(t => { if (!s[t.name]) s[t.name] = { wins: 0, eliminated: false, win_prob: savedOdds[t.name] ?? 0.5 }; });
        setTeamState(s);
      }
      if (drafterRes.data) setDrafters(drafterRes.data.map(r => ({ id: r.id, name: r.name, picks: r.picks || [] })));
      // Load timeline
      const tlRes = await supabase.from("timeline").select("*").order("ts");
      if (tlRes.data) setTimeline(tlRes.data);
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    const teamChannel = supabase.channel("team_states_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_states" }, (payload) => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          const r = payload.new;
          setTeamState(prev => ({ ...prev, [r.team_name]: { wins: r.wins, eliminated: r.eliminated, win_prob: r.win_prob ?? prev[r.team_name]?.win_prob ?? 0.5 } }));
        }
      }).subscribe();
    const drafterChannel = supabase.channel("drafters_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "drafters" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new;
          setDrafters(prev => [...prev, { id: r.id, name: r.name, picks: r.picks || [] }]);
        } else if (payload.eventType === "UPDATE") {
          const r = payload.new;
          setDrafters(prev => prev.map(d => d.id === r.id ? { id: r.id, name: r.name, picks: r.picks || [] } : d));
        } else if (payload.eventType === "DELETE") {
          setDrafters(prev => prev.filter(d => d.id !== payload.old.id));
        }
      }).subscribe();
    return () => { supabase.removeChannel(teamChannel); supabase.removeChannel(drafterChannel); };
  }, []);

  const teamMap = useMemo(()=>{ const m={}; TEAMS.forEach(t=>{m[t.name]=t;}); return m; },[]);

  const logTimeline = useCallback(async (eventType, teamName, detail, currentScores) => {
    const scoreSnap = {};
    if(currentScores) currentScores.forEach(s=>{scoreSnap[s.name]={pts:s.pts,alive:s.alive};});
    const row = {event_type:eventType, team_name:teamName, detail, scores:scoreSnap};
    const {data} = await supabase.from("timeline").insert(row).select();
    if(data?.[0]) setTimeline(prev=>[...prev, data[0]]);
  },[]);

  // Find opponent of a team in a specific round (1-indexed: 1=R64, 2=R32, etc.)
  const findOpponent = useCallback((name, round) => {
    const team = teamMap[name];
    if(!team || team.region==="N/A") return null;
    const region = team.region;
    const path = SEED_PATH[team.seed];
    if(path===undefined) return null;

    // Rounds 1-4 are within the region
    if(round>=1 && round<=4) {
      // In round R, teams whose paths differ only in the last R bits meet
      // Round 1: differ in bit 0 (XOR mask 1)
      // Round 2: differ in bits 0-1 (group of 4, XOR mask within group)
      const groupSize = Math.pow(2, round);
      const groupStart = Math.floor(path / groupSize) * groupSize;
      // The opponent survived previous rounds — find the team in the opposing half of this group
      const halfSize = groupSize / 2;
      const myHalf = Math.floor((path - groupStart) / halfSize);
      const oppHalfStart = groupStart + (myHalf === 0 ? halfSize : 0);
      // Find the surviving team in the opponent's half
      const regionTeams = TEAMS.filter(t=>t.region===region && t.region!=="N/A");
      const candidates = regionTeams.filter(t=>{
        const p = SEED_PATH[t.seed];
        return p >= oppHalfStart && p < oppHalfStart + halfSize;
      });
      // Return the one that's alive with enough wins to be in this round
      const alive = candidates.filter(t=>{
        const s = teamState[t.name];
        return s && !s.eliminated && s.wins >= round - 1;
      });
      return alive.length === 1 ? alive[0].name : null;
    }
    return null; // Final Four / Final are cross-region, skip auto for now
  },[teamMap, teamState]);

  const setWins = useCallback(async (name, w) => {
    const prevWins = teamState[name]?.wins || 0;
    setTeamState(p=>({...p,[name]:{...p[name],wins:w}}));
    await supabase.from("team_states").update({ wins: w }).eq("team_name", name);

    // If wins increased, find and eliminate the opponent for each new win round
    if(w > prevWins) {
      for(let round = prevWins + 1; round <= w; round++) {
        const opp = findOpponent(name, round);
        if(opp && !teamState[opp]?.eliminated) {
          setTeamState(p=>({...p,[opp]:{...p[opp],eliminated:true}}));
          await supabase.from("team_states").update({ eliminated: true }).eq("team_name", opp);
          logTimeline("elimination", opp, {seed: teamMap[opp]?.seed, region: teamMap[opp]?.region, lost_to: name});
        }
      }
    }
  },[teamState, findOpponent, logTimeline, teamMap]);

  const toggleElim = useCallback(async (name) => {
    const newVal = !teamState[name]?.eliminated;
    setTeamState(p=>({...p,[name]:{...p[name],eliminated:newVal}}));
    await supabase.from("team_states").update({ eliminated: newVal }).eq("team_name", name);

    if(newVal) {
      // Eliminated: give the opponent a win
      const round = (teamState[name]?.wins || 0) + 1;
      const opp = findOpponent(name, round);
      if(opp && !teamState[opp]?.eliminated) {
        const oppWins = (teamState[opp]?.wins || 0) + 1;
        setTeamState(p=>({...p,[opp]:{...p[opp],wins:oppWins}}));
        await supabase.from("team_states").update({ wins: oppWins }).eq("team_name", opp);
      }
      logTimeline("elimination", name, {seed: teamMap[name]?.seed, region: teamMap[name]?.region, lost_to: opp});
    }
  },[teamState, findOpponent, logTimeline, teamMap]);

  const setWinProb = useCallback(async (name, prob) => {
    const v = Math.max(0.01, Math.min(0.99, prob));
    setTeamState(p=>{
      const next = {...p,[name]:{...p[name],win_prob:v}};
      try {
        const odds = {};
        Object.entries(next).forEach(([k,s])=>{ odds[k] = s.win_prob; });
        localStorage.setItem("mm_odds", JSON.stringify(odds));
      } catch {}
      return next;
    });
    supabase.from("team_states").update({ win_prob: v }).eq("team_name", name).then(()=>{});
  },[]);

  const getPoints = useCallback((tn)=>{
    const t=teamMap[tn], s=teamState[tn];
    return (!t||!s) ? 0 : t.seed * s.wins;
  },[teamMap,teamState]);

  const getNaiveMax = useCallback((tn)=>{
    const t=teamMap[tn], s=teamState[tn];
    return (!t||!s||s.eliminated) ? 0 : t.seed * (6 - s.wins);
  },[teamMap,teamState]);

  const simResults = useMemo(()=> runSimulations(teamState, TEAMS), [teamState]);

  const scores = useMemo(()=>drafters.map(d=>{
    const pts = d.picks.reduce((sum,p)=>sum+getPoints(p),0);
    const naiveMax = d.picks.reduce((sum,p)=>sum+getNaiveMax(p),0);
    const bracketMax = computeBracketMax(d.picks, teamMap, teamState, TEAMS);
    const conflicts = findConflicts(d.picks, teamMap, teamState);
    const seeds = d.picks.filter(p=>p).map(p=>teamMap[p]?.seed||0);
    const avg = seeds.length > 0 ? (seeds.reduce((a,b)=>a+b,0)/seeds.length) : 0;
    const alive = d.picks.filter(p=>p && !teamState[p]?.eliminated).length;
    const totalPicks = d.picks.filter(p=>p).length;
    const ev = d.picks.reduce((sum,p)=>{
      if(!p || !teamMap[p]) return sum;
      return sum + teamMap[p].seed * (simResults[p] || 0);
    }, 0);
    const teamEVs = d.picks.filter(p=>p).map(p=>({
      name: p, seed: teamMap[p]?.seed||0,
      currentPts: getPoints(p),
      expectedPts: Math.round((teamMap[p]?.seed||0) * (simResults[p]||0) * 10) / 10,
      avgWins: Math.round((simResults[p]||0) * 100) / 100,
      win_prob: teamState[p]?.win_prob ?? 0.5,
      eliminated: teamState[p]?.eliminated || false,
    })).sort((a,b)=>b.expectedPts - a.expectedPts);
    return {...d, pts, naiveMax, bracketMax, conflicts, avg:avg.toFixed(1), alive, totalPicks, seeds, ev:Math.round(ev), teamEVs};
  }).sort((a,b)=>b.pts-a.pts || b.ev-a.ev),[drafters,getPoints,getNaiveMax,teamMap,teamState,simResults]);

  const maxPossible = Math.max(...scores.map(s=>s.pts + s.bracketMax), 1);

  const updatePick = async (drafterIdx, pickIdx, teamName) => {
    const drafter = drafters[drafterIdx];
    const picks = [...drafter.picks];
    picks[pickIdx] = teamName;
    setDrafters(prev => { const next = [...prev]; next[drafterIdx] = {...next[drafterIdx], picks}; return next; });
    await supabase.from("drafters").update({ picks }).eq("id", drafter.id);
  };

  const addDrafter = async () => {
    if(!newName.trim()) return;
    const picks = ["","","","","","","",""];
    const { data } = await supabase.from("drafters").insert({ name: newName.trim(), picks }).select().single();
    if (data) setDrafters(p=>[...p,{ id: data.id, name: data.name, picks: data.picks }]);
    setNewName("");
  };

  const removeDrafter = async (idx) => {
    const drafter = drafters[idx];
    setDrafters(p=>p.filter((_,i)=>i!==idx));
    await supabase.from("drafters").delete().eq("id", drafter.id);
  };

  const TABS = [
    {id:"leaderboard",label:"Leaderboard"},
    {id:"draft",label:"Draft Board"},
    {id:"teams",label:"Teams"},
    {id:"projections",label:"Projections"},
    {id:"timeline",label:"Timeline"},
    {id:"analytics",label:"Analytics"},
  ];

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-text-muted text-sm font-mono tracking-wide">LOADING TOURNAMENT DATA...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface text-text-primary font-sans">
      {/* Accent stripe */}
      <div className="h-[3px] bg-accent" />

      {/* Masthead */}
      <header className="bg-surface-raised border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xs font-semibold tracking-[0.2em] uppercase text-text-secondary">Hunden Partners</h1>
            <p className="text-lg font-semibold text-text-primary mt-0.5">March Madness 2026</p>
            <p className="text-xs text-text-muted mt-0.5 font-mono">Points = Seed &times; Wins</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedUser} onChange={e=>{setSelectedUser(e.target.value);localStorage.setItem("mm_user",e.target.value);}}
              className={`bg-surface-raised border rounded px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent cursor-pointer ${
                selectedUser ? "border-accent text-accent" : "border-border text-text-muted"
              }`}>
              <option value="">Who am I?</option>
              {drafters.map(d=><option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            {isAdmin ? (
              <button onClick={()=>{setIsAdmin(false);localStorage.removeItem("mm_admin");setEditMode(false);}}
                className="px-3 py-1.5 text-xs font-medium border border-accent text-accent rounded hover:bg-accent/10 transition-colors">
                Admin Mode
              </button>
            ) : (
              <button onClick={()=>{
                const pin = prompt("Enter admin PIN:");
                if(pin==="6847"){setIsAdmin(true);localStorage.setItem("mm_admin","1");}
              }}
                className="px-3 py-1.5 text-xs font-medium border border-border text-text-muted rounded hover:text-text-secondary hover:border-text-muted transition-colors">
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nav — underline tabs */}
      <nav className="sticky top-0 z-10 bg-surface-raised/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 flex gap-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab===t.id
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* ===== LEADERBOARD ===== */}
        {tab==="leaderboard" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Standings</h2>
              <div className="flex gap-4 text-xs text-text-muted font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent inline-block"/>PTS</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-ev inline-block"/>EV</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-positive/40 inline-block"/>MAX</span>
              </div>
            </div>
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {scores.map((d,i)=>{
                const total = d.pts + d.bracketMax;
                const barW = maxPossible > 0 ? (total/maxPossible*100) : 0;
                const ptsW = maxPossible > 0 ? (d.pts/maxPossible*100) : 0;
                const evW = maxPossible > 0 ? (d.ev/maxPossible*100) : 0;
                const penalty = d.naiveMax - d.bracketMax;
                const hasPicks = d.totalPicks > 0;
                const isMe = selectedUser && d.name === selectedUser;
                return (
                  <div key={d.name} className={`px-5 py-4 transition-colors ${
                    isMe ? "bg-accent/10 border-l-2 border-l-accent" : hasPicks ? "hover:bg-surface-hover" : "opacity-50"
                  }`}>
                    <div className="flex items-start gap-4">
                      {/* Rank */}
                      <span className={`font-mono text-lg font-bold w-8 text-right shrink-0 ${
                        !hasPicks ? "text-text-muted" : i===0 ? "text-accent" : "text-text-secondary"
                      }`}>
                        {hasPicks ? i+1 : "\u2014"}
                      </span>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold">{d.name}</span>
                          {DRAFT_PAID[d.name]===false && <span className="text-[10px] font-semibold uppercase tracking-wider text-negative bg-negative/10 px-1.5 py-0.5 rounded">Unpaid</span>}
                          {hasPicks ? (
                            <>
                              <span className="text-xs text-text-muted font-mono">{d.alive}/{d.totalPicks} alive</span>
                              <span className="text-xs text-text-muted font-mono">avg {d.avg}</span>
                              {d.conflicts.length > 0 && (
                                <span className="text-xs text-accent font-mono">
                                  {d.conflicts.length} conflict{d.conflicts.length>1?"s":""}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-text-muted">No picks yet</span>
                          )}
                        </div>
                        {hasPicks && (
                          <>
                            {/* Progress bar — thin */}
                            <div className="mt-2.5 h-1 bg-border rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-0 rounded-full bg-positive/25" style={{width:`${barW}%`}} />
                              <div className="absolute inset-y-0 left-0 rounded-full bg-ev/40" style={{width:`${evW}%`}} />
                              <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{width:`${ptsW}%`}} />
                            </div>
                            {/* Team badges with region left-border */}
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {d.picks.filter(p=>p).map((p,pi)=>{
                                const t=teamMap[p]; const s=teamState[p];
                                if(!t) return null;
                                const pts = t.seed * (s?.wins||0);
                                const regionColor = REGION_COLORS[t.region] || REGION_COLORS["N/A"];
                                return (
                                  <span key={pi}
                                    className={`inline-flex items-center gap-1 pl-2 pr-2 py-0.5 text-xs border-l-[3px] rounded-r-sm ${
                                      s?.eliminated
                                        ? "bg-surface-raised text-text-muted line-through opacity-60"
                                        : s?.wins > 0
                                          ? "bg-surface-raised text-text-primary"
                                          : "bg-surface-raised text-text-secondary"
                                    }`}
                                    style={{borderLeftColor: regionColor}}>
                                    <span className="font-mono text-text-muted">{t.seed}</span>
                                    <span>{t.name}</span>
                                    {s?.wins > 0 && !s?.eliminated && (
                                      <>
                                        <span className="font-mono font-semibold text-accent">+{pts}</span>
                                        {winDots(s.wins)}
                                      </>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Score column */}
                      <div className="text-right pl-4 shrink-0">
                        <div className="font-mono text-2xl font-bold text-accent">{d.pts}</div>
                        {hasPicks && <>
                          <div className="font-mono text-sm font-semibold text-ev">EV {d.ev}</div>
                          <div className="font-mono text-xs text-positive">max {d.bracketMax}</div>
                          {penalty > 0 && <div className="font-mono text-xs text-text-muted">naive {d.naiveMax}</div>}
                        </>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== DRAFT BOARD ===== */}
        {tab==="draft" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Draft Board</h2>
              <div className="flex gap-2 items-center">
                {locked ? (
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Picks Locked</span>
                ) : isAdmin ? (
                  <button onClick={()=>setEditMode(!editMode)}
                    className={`px-3 py-1.5 text-xs font-medium border rounded transition-colors ${
                      editMode
                        ? "bg-accent text-surface border-accent"
                        : "border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
                    }`}>
                    {editMode?"Done Editing":"Edit Picks"}
                  </button>
                ) : null}
              </div>
            </div>
            {editMode && !locked && (
              <div className="flex gap-2 mb-4">
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New player name..."
                  onKeyDown={e=>e.key==="Enter"&&addDrafter()}
                  className="flex-1 bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                <button onClick={addDrafter} className="bg-accent hover:bg-accent/90 text-surface px-4 py-2 rounded text-sm font-semibold">Add</button>
              </div>
            )}
            {/* Region Legend */}
            <div className="flex gap-4 mb-3 text-xs text-text-muted font-mono">
              {["East","South","West","Midwest"].map(r=>(
                <span key={r} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:REGION_COLORS[r]}}/>{r}</span>
              ))}
            </div>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-text-muted sticky left-0 bg-surface-raised z-10 w-[140px]">Player</th>
                    {editMode
                      ? [1,2,3,4,5,6,7,8].map(n=><th key={n} className="text-center py-2.5 px-2 w-[140px] text-xs font-medium uppercase tracking-wider text-text-muted">Pick {n}</th>)
                      : <>
                          <th colSpan="8" className="text-center py-2.5 px-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                            <span className="text-positive">Alive</span>
                            <span className="text-text-muted mx-2">(by seed)</span>
                            <span className="text-text-muted/50 ml-4">Eliminated</span>
                          </th>
                        </>
                    }
                    <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-text-muted">Pts</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-text-muted">EV</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider text-text-muted">Max</th>
                    {editMode && <th className="w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {drafters.map((d,di)=>{
                    const dScore = scores.find(s=>s.id===d.id);
                    const isEven = di % 2 === 0;
                    const isMe = selectedUser && d.name === selectedUser;
                    // Sort picks: alive by seed (ascending), then eliminated by seed
                    const sortedPicks = editMode ? d.picks : (()=>{
                      const alive = d.picks.filter(p=>p && !teamState[p]?.eliminated)
                        .sort((a,b)=>(teamMap[a]?.seed||99)-(teamMap[b]?.seed||99));
                      const elim = d.picks.filter(p=>p && teamState[p]?.eliminated)
                        .sort((a,b)=>(teamMap[a]?.seed||99)-(teamMap[b]?.seed||99));
                      const empty = d.picks.filter(p=>!p);
                      return [...alive, ...elim, ...empty].slice(0,8);
                    })();
                    return (
                      <tr key={d.id} className={`transition-colors hover:bg-surface-hover ${isMe ? "bg-accent/10" : isEven ? "" : "bg-surface-raised/30"}`}>
                        <td className={`py-2.5 px-3 font-semibold sticky left-0 z-10 w-[140px] truncate ${isMe ? "bg-accent/10 text-accent" : "bg-surface text-text-primary"}`}>{d.name}</td>
                        {sortedPicks.map((p,pi)=>{
                          const t=teamMap[p]; const s=teamState[p];
                          const elim=s?.eliminated;
                          const regionColor = t ? REGION_COLORS[t.region] : null;
                          return (
                            <td key={pi} className="py-2 px-1 text-center">
                              {editMode ? (
                                <TeamSelect value={p} onChange={v=>updatePick(di,pi,v)} teams={TEAMS.filter(t=>t.region!=="N/A")} />
                              ) : (
                                <div className={`px-2 py-1.5 text-xs rounded ${
                                  !p ? "text-text-muted"
                                  : elim ? "text-text-muted/50 bg-surface-raised/50"
                                  : "text-text-primary"
                                }`}>
                                  {t && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{backgroundColor: elim ? "#d1d5db" : regionColor}} />
                                  )}
                                  {t && <span className={`font-mono mr-1 ${elim ? "text-text-muted/40" : "text-text-muted"}`}>{t.seed}</span>}
                                  <span className={elim ? "line-through text-text-muted/40" : s?.wins>=2 ? "text-text-primary font-medium" : ""}>
                                    {p||"\u2014"}
                                  </span>
                                  {t && s && s.wins>0 && !elim && (
                                    <div className="font-mono font-semibold text-accent text-xs mt-0.5">+{t.seed*s.wins}{winDots(s.wins)}</div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-accent text-base">{dScore?.pts || 0}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-ev">{dScore?.ev || 0}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-positive">{dScore?.bracketMax || 0}</td>
                        {editMode && (
                          <td className="py-2.5 px-1">
                            <button onClick={()=>removeDrafter(di)} className="text-negative hover:text-red-300 text-xs font-mono">&times;</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== TEAMS ===== */}
        {tab==="teams" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Tournament Teams</h2>
              <div className="flex items-center gap-4">
                {isAdmin && <button onClick={()=>setShowOdds(!showOdds)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded transition-colors ${
                    showOdds
                      ? "bg-ev text-surface border-ev"
                      : "border-border text-text-secondary hover:text-text-primary hover:border-text-muted"
                  }`}>
                  {showOdds ? "Hide Odds" : "Show Odds"}
                </button>}
                {isAdmin && <p className="text-xs text-text-muted">Click wins to update</p>}
              </div>
            </div>
            {showOdds && (
              <div className="border border-ev/20 rounded px-4 py-2.5 text-xs text-ev/80 mb-4 font-mono">
                Win probabilities (1-99%) for Monte Carlo sim (3,000 runs). P(A beats B) = A% / (A% + B%).
              </div>
            )}
            {["East","South","West","Midwest"].map(region=>(
              <div key={region} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-0.5 rounded-full" style={{backgroundColor:REGION_COLORS[region]}} />
                  <h3 className="text-sm font-semibold uppercase tracking-wider" style={{color:REGION_COLORS[region]}}>{region}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
                  {TEAMS.filter(t=>t.region===region).sort((a,b)=>a.seed-b.seed).map(t=>{
                    const s=teamState[t.name];
                    const pts=t.seed*s.wins;
                    const draftedBy = drafters.filter(d=>d.picks.includes(t.name)).map(d=>d.name);
                    const avgWins = simResults[t.name] || 0;
                    const evPts = Math.round(t.seed * avgWins * 10) / 10;
                    const isMine = selectedUser && draftedBy.includes(selectedUser);
                    return (
                      <div key={t.name}
                        className={`p-3 transition-colors ${
                          s.eliminated ? "bg-surface opacity-50" : isMine ? "bg-accent/5 hover:bg-accent/10" : "bg-surface hover:bg-surface-hover"
                        }`}
                        style={{borderLeft: `3px solid ${REGION_COLORS[region]}22`}}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-text-muted w-5 text-right">{t.seed}</span>
                            <span className={`text-sm font-medium ${s.eliminated?"line-through text-text-muted":s.wins>=2?"text-text-primary":"text-text-primary"}`}>
                              {t.name}
                            </span>
                            {s.wins > 0 && !s.eliminated && winDots(s.wins)}
                            {draftedBy.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent/60" title={`Drafted by: ${draftedBy.join(", ")}`} />}
                          </div>
                          {isAdmin && <button onClick={()=>toggleElim(t.name)}
                            className={`text-xs px-1.5 py-0.5 rounded font-mono transition-colors ${
                              s.eliminated
                                ? "text-positive hover:bg-positive/10"
                                : "text-text-muted hover:text-negative hover:bg-negative/10"
                            }`}>
                            {s.eliminated?"\u21A9":"\u2715"}
                          </button>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-xs text-text-muted font-mono">W</span>
                          <div className="flex gap-0.5">
                            {[0,1,2,3,4,5,6].map(w=>(
                              isAdmin ? (
                              <button key={w} onClick={()=>setWins(t.name,w)}
                                className={`w-5 h-5 rounded-sm text-xs font-mono font-medium transition-all ${
                                  s.wins===w ? "bg-accent text-surface"
                                  : w <= s.wins ? "bg-accent/30 text-accent" : "bg-surface-raised text-text-muted hover:bg-surface-hover"
                                }`}>{w}</button>
                              ) : (
                              <span key={w}
                                className={`w-5 h-5 rounded-sm text-xs font-mono font-medium flex items-center justify-center ${
                                  s.wins===w ? "bg-accent text-surface"
                                  : w <= s.wins ? "bg-accent/30 text-accent" : "bg-surface-raised text-text-muted"
                                }`}>{w}</span>
                              )
                            ))}
                          </div>
                          {pts>0 && <span className="font-mono text-accent text-xs font-semibold ml-auto">{pts}</span>}
                        </div>
                        {showOdds && !s.eliminated && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-ev/60 font-mono">P</span>
                            <input type="number" min="1" max="99" step="1"
                              value={Math.round((s.win_prob ?? 0.5) * 100)}
                              onChange={e => setWinProb(t.name, parseInt(e.target.value || "50") / 100)}
                              className="w-12 bg-surface-raised text-ev text-xs text-center font-mono rounded px-1.5 py-1 border border-border focus:outline-none focus:border-ev/50" />
                            <span className="text-xs text-text-muted font-mono">%</span>
                            <span className="text-xs text-ev/50 ml-auto font-mono">EV {evPts}</span>
                          </div>
                        )}
                        {draftedBy.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {draftedBy.map(n=>(
                              <span key={n} className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${selectedUser&&n===selectedUser?"bg-accent/20 text-accent font-semibold":"text-text-muted bg-surface-raised"}`}>{n}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== PROJECTIONS ===== */}
        {tab==="projections" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Expected Value Projections</h2>
              <span className="text-xs text-text-muted font-mono">3,000 simulations</span>
            </div>
            <p className="text-xs text-text-muted mb-6">Set win probabilities in the Teams tab to adjust projections.</p>

            {/* EV Ranking */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ev mb-3">EV Ranking</h3>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {[...scores].filter(d=>d.totalPicks>0).sort((a,b)=>b.ev-a.ev).map((d,i)=>{
                  const maxEV = Math.max(...scores.filter(s=>s.totalPicks>0).map(s=>s.ev), 1);
                  const isMe = selectedUser && d.name === selectedUser;
                  return (
                    <div key={d.name} className={`px-5 py-3 transition-colors ${isMe ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-surface-hover"}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`font-mono text-sm font-bold w-6 text-right ${i===0?"text-ev":"text-text-muted"}`}>{i+1}</span>
                        <span className="font-semibold flex-1">{d.name}</span>
                        <span className="text-xs text-text-muted font-mono">PTS <span className="text-accent font-semibold">{d.pts}</span></span>
                        <span className="font-mono text-base font-bold text-ev">EV {d.ev}</span>
                        <span className="font-mono text-xs text-positive">max {d.bracketMax}</span>
                      </div>
                      <div className="ml-9 h-1 bg-border rounded-full overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-ev/60" style={{width:`${d.ev/maxEV*100}%`}} />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{width:`${d.pts/maxEV*100}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-team EV breakdown */}
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ev mb-3">Team-by-Team Breakdown</h3>
              <div className="space-y-4">
                {[...scores].filter(d=>d.totalPicks>0).sort((a,b)=>b.ev-a.ev).map(d=>(
                  <div key={d.name} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface-raised flex items-center justify-between border-b border-border">
                      <span className="font-semibold text-sm">{d.name}</span>
                      <span className="font-mono text-sm text-ev font-bold">EV {d.ev}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border-subtle">
                      {d.teamEVs.map(te=>{
                        const regionColor = REGION_COLORS[teamMap[te.name]?.region] || REGION_COLORS["N/A"];
                        return (
                          <div key={te.name} className={`p-3 text-xs ${
                            te.eliminated ? "bg-surface opacity-40" : "bg-surface"
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: regionColor}} />
                              <span className={`font-mono text-text-muted`}>{te.seed}</span>
                              <span className={`font-medium ${te.eliminated?"line-through text-text-muted":"text-text-primary"}`}>{te.name}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1.5 font-mono">
                              <span className="text-text-muted">P <span className="text-ev">{Math.round(te.win_prob*100)}%</span></span>
                              <span className="text-text-muted">avg <span className="text-text-secondary">{te.avgWins}W</span></span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5 font-mono">
                              <span className="text-accent">now {te.currentPts}</span>
                              <span className="text-ev font-semibold">EV {te.expectedPts}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Leaders */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ev mb-3">Highest EV Picks</h3>
              {(()=>{
                const allPicks = [];
                scores.forEach(d => d.teamEVs.forEach(te => {
                  if (!te.eliminated) allPicks.push({...te, drafter: d.name});
                }));
                allPicks.sort((a,b) => b.expectedPts - a.expectedPts);
                return (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {allPicks.slice(0,20).map((te,i)=>{
                      const regionColor = REGION_COLORS[teamMap[te.name]?.region] || REGION_COLORS["N/A"];
                      return (
                        <div key={`${te.drafter}-${te.name}`} className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                          <span className="font-mono text-text-muted text-xs w-5 text-right">{i+1}</span>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: regionColor}} />
                          <span className="font-mono text-text-muted text-xs">{te.seed}</span>
                          <span className="font-medium text-sm flex-1">{te.name}</span>
                          <span className="text-xs text-text-muted font-mono">P {Math.round(te.win_prob*100)}%</span>
                          <span className="text-xs text-text-muted font-mono">{te.avgWins}W</span>
                          <span className="text-xs text-text-muted font-mono">{te.drafter}</span>
                          <span className="font-mono text-ev font-bold text-sm w-16 text-right">EV {te.expectedPts}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ===== TIMELINE ===== */}
        {tab==="timeline" && (()=>{
          // Build chart data from timeline events
          const COLORS = ["#c45a20","#2563eb","#16a34a","#dc2626","#d97706","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1","#14b8a6","#f43f5e","#a855f7","#22d3ee","#eab308","#64748b","#10b981"];
          const activeDrafters = scores.filter(d=>d.totalPicks>0);
          const elimEvents = timeline.filter(e=>e.event_type==="elimination");

          // Points over time chart data
          const ptsData = [{label:"Start",...Object.fromEntries(activeDrafters.map(d=>[d.name,0]))}];
          if(elimEvents.length>0){
            elimEvents.forEach((e,i)=>{
              const row = {label: e.team_name};
              if(e.scores){
                activeDrafters.forEach(d=>{row[d.name]=e.scores[d.name]?.pts??0;});
              }
              ptsData.push(row);
            });
          } else {
            // No timeline yet — show current state as single point
            const row = {label:"Current"};
            activeDrafters.forEach(d=>{row[d.name]=d.pts;});
            ptsData.push(row);
          }

          // Teams remaining per drafter
          const aliveData = [{label:"Start",...Object.fromEntries(activeDrafters.map(d=>[d.name,d.totalPicks]))}];
          if(elimEvents.length>0){
            elimEvents.forEach(e=>{
              const row = {label:e.team_name};
              if(e.scores){
                activeDrafters.forEach(d=>{row[d.name]=e.scores[d.name]?.alive??d.totalPicks;});
              }
              aliveData.push(row);
            });
          } else {
            const row = {label:"Current"};
            activeDrafters.forEach(d=>{row[d.name]=d.alive;});
            aliveData.push(row);
          }

          return (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-6">Tournament Timeline</h2>

            {elimEvents.length===0 && (
              <div className="border border-border rounded-lg px-6 py-8 text-center mb-6">
                <p className="text-text-muted text-sm">No games have been played yet. Charts will populate as teams are eliminated.</p>
                <p className="text-text-muted text-xs mt-1 font-mono">When you mark a team as eliminated in the Teams tab, a snapshot is recorded.</p>
              </div>
            )}

            {/* Points Over Time */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Points Over Time</h3>
              <div className="border border-border rounded-lg p-4 bg-surface-raised">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={ptsData}>
                    <XAxis dataKey="label" tick={{fontSize:10}} angle={-30} textAnchor="end" height={60}/>
                    <YAxis tick={{fontSize:10}}/>
                    <Tooltip contentStyle={{backgroundColor:"#fff",border:"1px solid #e2e4e8",borderRadius:8,fontSize:12}}/>
                    <RLegend wrapperStyle={{fontSize:11}}/>
                    {activeDrafters.map((d,i)=>(
                      <Line key={d.name} type="monotone" dataKey={d.name} stroke={COLORS[i%COLORS.length]}
                        strokeWidth={selectedUser===d.name?3:1.5} dot={false}
                        opacity={selectedUser&&selectedUser!==d.name?0.3:1}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Teams Remaining */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Teams Remaining</h3>
              <div className="border border-border rounded-lg p-4 bg-surface-raised">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={aliveData}>
                    <XAxis dataKey="label" tick={{fontSize:10}} angle={-30} textAnchor="end" height={60}/>
                    <YAxis tick={{fontSize:10}} domain={[0,8]}/>
                    <Tooltip contentStyle={{backgroundColor:"#fff",border:"1px solid #e2e4e8",borderRadius:8,fontSize:12}}/>
                    <RLegend wrapperStyle={{fontSize:11}}/>
                    {activeDrafters.map((d,i)=>(
                      <Line key={d.name} type="stepAfter" dataKey={d.name} stroke={COLORS[i%COLORS.length]}
                        strokeWidth={selectedUser===d.name?3:1.5} dot={false}
                        opacity={selectedUser&&selectedUser!==d.name?0.3:1}/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Elimination Log */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Elimination Log</h3>
              {elimEvents.length>0 ? (
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {[...elimEvents].reverse().map((e,i)=>{
                    const t = teamMap[e.team_name];
                    const regionColor = REGION_COLORS[t?.region]||"#999";
                    const affectedDrafters = drafters.filter(d=>d.picks.includes(e.team_name)).map(d=>d.name);
                    return (
                      <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                        <span className="text-xs font-mono text-text-muted w-16 shrink-0">{new Date(e.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:regionColor}}/>
                        <span className="font-semibold text-sm">{e.team_name}</span>
                        <span className="text-xs font-mono text-text-muted">({t?.seed}) {t?.region}</span>
                        <div className="flex-1 flex gap-1 flex-wrap justify-end">
                          {affectedDrafters.map(n=>(
                            <span key={n} className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${selectedUser===n?"bg-accent/20 text-accent font-semibold":"bg-surface-raised text-text-muted"}`}>{n}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-muted font-mono">No eliminations recorded yet.</p>
              )}
            </section>

            {/* Power Rankings (current snapshot) */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Power Rankings</h3>
              <p className="text-xs text-text-muted mb-3">Current standings by points, with max potential and teams alive</p>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {[...scores].filter(d=>d.totalPicks>0).sort((a,b)=>b.pts-a.pts||b.bracketMax-a.bracketMax).map((d,i)=>{
                  const isMe = selectedUser && d.name===selectedUser;
                  const maxBar = Math.max(...scores.filter(s=>s.totalPicks>0).map(s=>s.pts+s.bracketMax),1);
                  return (
                    <div key={d.name} className={`px-5 py-3 transition-colors ${isMe?"bg-accent/10":""}`}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`font-mono text-sm font-bold w-6 text-right ${i===0?"text-accent":"text-text-muted"}`}>{i+1}</span>
                        <span className="font-semibold text-sm flex-1">{d.name}</span>
                        <span className="font-mono text-accent font-bold">{d.pts} pts</span>
                        <span className="font-mono text-xs text-text-muted">{d.alive}/{d.totalPicks} alive</span>
                        <span className="font-mono text-xs text-positive">max {d.bracketMax}</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-border ml-9">
                        <div className="bg-accent rounded-l-full" style={{width:`${d.pts/maxBar*100}%`}}/>
                        <div className="bg-positive/30" style={{width:`${d.bracketMax/maxBar*100}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          );
        })()}

        {/* ===== ANALYTICS ===== */}
        {tab==="analytics" && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-6">Draft Analytics</h2>

            {/* Bracket Conflicts */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Bracket Conflicts</h3>
              <p className="text-xs text-text-muted mb-3">When your picks face each other, only one advances. This caps your ceiling.</p>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {scores.filter(d=>d.totalPicks>0).map(d=>{
                  const penalty = d.naiveMax - d.bracketMax;
                  return (
                    <div key={d.name} className="px-5 py-3 hover:bg-surface-hover transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{d.name}</span>
                        <div className="flex gap-4 text-xs font-mono">
                          <span className="text-positive">max {d.bracketMax}</span>
                          {penalty > 0 && <span className="text-negative">-{penalty} conflicts</span>}
                          {penalty === 0 && <span className="text-text-muted">no penalty</span>}
                        </div>
                      </div>
                      {d.conflicts.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {d.conflicts.map((c,ci)=>(
                            <span key={ci} className={`text-xs font-mono px-2 py-1 rounded-sm border ${
                              c.round <= 2 ? "border-negative/30 text-negative bg-negative/5"
                              : c.round <= 4 ? "border-accent/30 text-accent bg-accent-muted"
                              : "border-border text-text-secondary bg-surface-raised"
                            }`}>
                              {c.seed1} {c.team1} vs {c.seed2} {c.team2}
                              <span className="ml-1.5 text-text-muted">{c.roundName}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted font-mono">Clean bracket path</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Seed Distribution */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Seed Distribution</h3>
              <div className="space-y-2">
                {scores.filter(d=>d.totalPicks>0).map(d=>{
                  const buckets = [
                    {label:"1-4",color:REGION_COLORS.East,count:0},
                    {label:"5-8",color:REGION_COLORS.West,count:0},
                    {label:"9-12",color:REGION_COLORS.Midwest,count:0},
                    {label:"13+",color:REGION_COLORS.South,count:0}
                  ];
                  d.seeds.forEach(s=>{ if(s<=4) buckets[0].count++; else if(s<=8) buckets[1].count++; else if(s<=12) buckets[2].count++; else buckets[3].count++; });
                  const total = d.seeds.length || 1;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-36 text-sm font-medium text-right truncate text-text-secondary shrink-0">{d.name}</span>
                      <div className="flex-1 flex h-5 rounded-sm overflow-hidden bg-border">
                        {buckets.filter(b=>b.count>0).map((b,i)=>(
                          <div key={i} className="flex items-center justify-center text-xs font-mono font-medium text-white/90"
                            style={{width:`${b.count/total*100}%`,backgroundColor:b.color}}>
                            {b.count}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-text-muted font-mono w-12">avg {d.avg}</span>
                    </div>
                  );
                })}
                <div className="flex gap-4 mt-2 text-xs text-text-muted font-mono">
                  {[
                    {l:"1-4 Safe",c:REGION_COLORS.East},
                    {l:"5-8 Mid",c:REGION_COLORS.West},
                    {l:"9-12 Upset",c:REGION_COLORS.Midwest},
                    {l:"13+ Long",c:REGION_COLORS.South}
                  ].map(x=>(
                    <span key={x.l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{backgroundColor:x.c}}/>{x.l}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* Most Drafted Teams */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">Most Drafted Teams</h3>
              {(()=>{
                const counts = {};
                drafters.forEach(d=>d.picks.forEach(p=>{if(p){counts[p]=(counts[p]||{count:0,by:[]});counts[p].count++;counts[p].by.push(d.name);}}));
                const sorted = Object.entries(counts).sort((a,b)=>b[1].count-a[1].count).slice(0,15);
                return (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {sorted.map(([team,data])=>{
                      const t=teamMap[team]; const s=teamState[team];
                      const regionColor = REGION_COLORS[t?.region] || REGION_COLORS["N/A"];
                      return (
                        <div key={team} className={`px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors ${
                          s?.eliminated ? "opacity-50" : ""
                        }`}>
                          <span className="font-mono text-xs text-text-muted w-5 text-right">{t?.seed||"?"}</span>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: regionColor}} />
                          <span className={`font-medium text-sm flex-1 ${s?.eliminated?"line-through text-text-muted":""}`}>
                            {team}
                            {s?.wins>0 && !s?.eliminated && winDots(s.wins)}
                          </span>
                          <span className="text-xs font-mono" style={{color: regionColor}}>{t?.region}</span>
                          <div className="flex gap-1 flex-wrap">
                            {data.by.map((name,i)=>(
                              <span key={i} className="text-xs font-mono text-text-muted bg-surface-raised px-1.5 py-0.5 rounded-sm">{name}</span>
                            ))}
                          </div>
                          <span className="font-mono text-accent font-bold">{data.count}x</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* Region Concentration */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Region Concentration</h3>
              <p className="text-xs text-text-muted mb-3">How each drafter's picks are distributed across regions</p>
              <div className="flex gap-4 mb-3 text-xs text-text-muted font-mono">
                {["East","South","West","Midwest"].map(r=>(
                  <span key={r} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:REGION_COLORS[r]}}/>{r}</span>
                ))}
              </div>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {scores.filter(d=>d.totalPicks>0).map(d=>{
                  const regionCounts = {East:0,South:0,West:0,Midwest:0};
                  d.picks.forEach(p=>{const t=teamMap[p]; if(t&&t.region!=="N/A") regionCounts[t.region]++;});
                  const total = d.totalPicks || 1;
                  return (
                    <div key={d.name} className="px-5 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                      <span className="w-36 text-sm font-medium truncate shrink-0">{d.name}</span>
                      <div className="flex-1 flex h-5 rounded-sm overflow-hidden bg-surface-raised">
                        {["East","South","West","Midwest"].filter(r=>regionCounts[r]>0).map(r=>(
                          <div key={r} className="flex items-center justify-center text-[10px] font-mono font-semibold text-white"
                            style={{width:`${regionCounts[r]/total*100}%`,backgroundColor:REGION_COLORS[r]}}>
                            {regionCounts[r]}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {["East","South","West","Midwest"].map(r=>(
                          <span key={r} className="text-[10px] font-mono font-medium w-4 text-center" style={{color:regionCounts[r]>0?REGION_COLORS[r]:"#d1d5db"}}>{regionCounts[r]}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Pick Overlap */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Pick Overlap</h3>
              <p className="text-xs text-text-muted mb-3">How many teams each pair of drafters share</p>
              {(()=>{
                const active = drafters.filter(d=>d.picks.filter(p=>p).length>0);
                const pairs = [];
                for(let i=0;i<active.length;i++){
                  for(let j=i+1;j<active.length;j++){
                    const shared = active[i].picks.filter(p=>p&&active[j].picks.includes(p));
                    if(shared.length>0) pairs.push({a:active[i].name,b:active[j].name,shared,count:shared.length});
                  }
                }
                pairs.sort((a,b)=>b.count-a.count);
                return (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {pairs.slice(0,20).map((p,i)=>(
                      <div key={i} className="px-5 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                        <span className="font-mono text-accent font-bold w-6 text-right">{p.count}</span>
                        <span className="text-sm"><span className="font-semibold">{p.a}</span> <span className="text-text-muted">&</span> <span className="font-semibold">{p.b}</span></span>
                        <div className="flex-1 flex gap-1 flex-wrap justify-end">
                          {p.shared.map((t,ti)=>{
                            const tm=teamMap[t];
                            return <span key={ti} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-raised text-text-muted" style={{borderLeft:`2px solid ${REGION_COLORS[tm?.region]||"#999"}`}}>{t}</span>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* Unique Picks */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Exclusive Picks</h3>
              <p className="text-xs text-text-muted mb-3">Teams only one drafter chose — all points go to them</p>
              {(()=>{
                const counts = {};
                drafters.forEach(d=>d.picks.forEach(p=>{if(p){if(!counts[p])counts[p]={count:0,by:[]};counts[p].count++;counts[p].by.push(d.name);}}));
                const exclusive = Object.entries(counts).filter(([,d])=>d.count===1).map(([team,d])=>({team,owner:d.by[0]}));
                const byOwner = {};
                exclusive.forEach(e=>{if(!byOwner[e.owner])byOwner[e.owner]=[];byOwner[e.owner].push(e.team);});
                const sorted = Object.entries(byOwner).sort((a,b)=>b[1].length-a[1].length);
                return (
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {sorted.map(([name,teams])=>(
                      <div key={name} className="px-5 py-2.5 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                        <span className="font-semibold text-sm w-36 truncate shrink-0">{name}</span>
                        <span className="font-mono text-accent font-bold w-4">{teams.length}</span>
                        <div className="flex-1 flex gap-1 flex-wrap">
                          {teams.map((t,ti)=>{
                            const tm=teamMap[t];
                            const pts = (tm?.seed||0) * 6;
                            return <span key={ti} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-surface-raised text-text-secondary" style={{borderLeft:`2px solid ${REGION_COLORS[tm?.region]||"#999"}`}}>{t} <span className="text-text-muted">({tm?.seed})</span></span>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* Cinderella Upside */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Cinderella Upside</h3>
              <p className="text-xs text-text-muted mb-3">If every double-digit seed wins 2 games</p>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {scores.filter(d=>d.totalPicks>0).map(d=>{
                  const dd = d.picks.filter(p=>(teamMap[p]?.seed||0)>=10).map(p=>teamMap[p]?.seed||0);
                  const cinPts = dd.reduce((s,v)=>s+v*2,0);
                  const safe = d.picks.filter(p=>(teamMap[p]?.seed||0)>=1&&(teamMap[p]?.seed||0)<=4).map(p=>teamMap[p]?.seed||0);
                  const safePts = safe.reduce((s,v)=>s+v*3,0);
                  const strat = dd.length>=6?"Full Chaos":dd.length>=4?"Upset Hunter":dd.length>=2?"Balanced":"Playing Safe";
                  const stratColor = dd.length>=6?"text-negative":dd.length>=4?"text-accent":dd.length>=2?"text-positive":"text-ev";
                  return (
                    <div key={d.name} className="px-5 py-3 flex items-center gap-4 flex-wrap hover:bg-surface-hover transition-colors">
                      <span className="font-semibold text-sm w-36 shrink-0">{d.name}</span>
                      <div className="flex-1 flex gap-6 text-xs font-mono flex-wrap">
                        <span className="text-text-muted">{dd.length} underdogs</span>
                        <span className="text-accent">{cinPts} upset pts</span>
                        <span className="text-ev">{safePts} safe pts</span>
                        <span className="text-text-primary font-semibold">{cinPts+safePts} total</span>
                      </div>
                      <span className={`text-xs font-semibold font-mono ${stratColor}`}>{strat}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
        {/* ===== CLASSIC ===== */}
        <div className="mt-10 pt-6 border-t border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Classic Bracket</h2>
          <p className="text-xs text-text-muted mb-3">Participants in the classic bracket competition only.</p>
          <div className="flex flex-wrap gap-2">
            {CLASSIC_ONLY.map(p=>(
              <span key={p.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border rounded text-sm text-text-secondary">
                {p.name}
                {p.paid ? <span className="w-1.5 h-1.5 rounded-full bg-positive" title="Paid"/> : <span className="text-[10px] font-semibold text-negative">UNPAID</span>}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-6 mt-8 border-t border-border">
        <p className="text-xs text-text-muted font-mono">Hunden Partners &middot; March Madness 2026 &middot; Points = Seed &times; Wins</p>
      </footer>
    </div>
  );
}
