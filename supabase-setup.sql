-- =============================================
-- March Madness 2026 - Supabase Setup
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================

-- Team states (wins & elimination tracking)
create table team_states (
  team_name text primary key,
  wins integer not null default 0 check (wins >= 0 and wins <= 6),
  eliminated boolean not null default false,
  win_prob real not null default 0.5 check (win_prob >= 0 and win_prob <= 1)
);

-- Drafters and their picks
create table drafters (
  id serial primary key,
  name text unique not null,
  picks text[] not null default '{}'
);

-- Enable Row Level Security (required by Supabase)
alter table team_states enable row level security;
alter table drafters enable row level security;

-- Allow public read/write (no auth for this simple app)
create policy "Allow public read team_states" on team_states for select using (true);
create policy "Allow public write team_states" on team_states for insert with check (true);
create policy "Allow public update team_states" on team_states for update using (true);

create policy "Allow public read drafters" on drafters for select using (true);
create policy "Allow public write drafters" on drafters for insert with check (true);
create policy "Allow public update drafters" on drafters for update using (true);
create policy "Allow public delete drafters" on drafters for delete using (true);

-- Enable Realtime for both tables
alter publication supabase_realtime add table team_states;
alter publication supabase_realtime add table drafters;

-- =============================================
-- Seed initial data
-- =============================================

-- Seed all 68 teams with 0 wins
insert into team_states (team_name, wins, eliminated) values
  ('Duke',0,false),('Siena',0,false),('Ohio State',0,false),('TCU',0,false),
  ('St. John''s',0,false),('Northern Iowa',0,false),('Kansas',0,false),('CA Baptist',0,false),
  ('Louisville',0,false),('South Florida',0,false),('Michigan State',0,false),('North Dakota State',0,false),
  ('UCLA',0,false),('UCF',0,false),('UConn',0,false),('Furman',0,false),
  ('Florida',0,false),('PV A&M/Lehigh',0,false),('Clemson',0,false),('Iowa',0,false),
  ('Vanderbilt',0,false),('McNeese',0,false),('Nebraska',0,false),('Troy',0,false),
  ('North Carolina',0,false),('VCU',0,false),('Illinois',0,false),('Penn',0,false),
  ('Saint Mary''s',0,false),('Texas A&M',0,false),('Houston',0,false),('Idaho',0,false),
  ('Arizona',0,false),('Long Island',0,false),('Villanova',0,false),('Utah State',0,false),
  ('Wisconsin',0,false),('High Point',0,false),('Arkansas',0,false),('Hawai''i',0,false),
  ('BYU',0,false),('Texas',0,false),('Gonzaga',0,false),('Kennesaw State',0,false),
  ('Miami',0,false),('Missouri',0,false),('Purdue',0,false),('Queens',0,false),
  ('Michigan',0,false),('Howard',0,false),('Georgia',0,false),('Saint Louis',0,false),
  ('Texas Tech',0,false),('Akron',0,false),('Alabama',0,false),('Hofstra',0,false),
  ('Tennessee',0,false),('M-OH/SMU',0,false),('Virginia',0,false),('Wright State',0,false),
  ('Kentucky',0,false),('Santa Clara',0,false),('Iowa State',0,false),('Tennessee State',0,false),
  ('New Mexico',0,false),('Xavier',0,false),('Drake',0,false),('Liberty',0,false);

-- Seed drafters (updated roster as of 2026-03-18)
insert into drafters (name, picks) values
  ('Lucas', '{"South Florida","M-OH/SMU","Texas A&M","Santa Clara","Akron","VCU","BYU","TCU"}'),
  ('Bethanie', '{"Duke","Arizona","UConn","Illinois","St. John''s","Vanderbilt","Louisville","Penn"}'),
  ('Derek', '{"St. John''s","VCU","Akron","Iowa State","Vanderbilt","South Florida","Arizona","UCLA"}'),
  ('Gwen', '{"Duke","Houston","Akron","Vanderbilt","VCU","McNeese","Texas A&M","Ohio State"}'),
  ('Charlie', '{"Duke","St. John''s","Penn","Houston","Florida","Wisconsin","Texas","Georgia"}'),
  ('Katie', '{"M-OH/SMU","Akron","Vanderbilt","North Carolina","Texas A&M","Kansas","Wisconsin","Gonzaga"}'),
  ('Billy Jenkins', '{"Michigan","Arizona","Houston","UConn","St. John''s","BYU","South Florida","Akron"}'),
  ('Matthew Avila', '{"VCU","South Florida","Vanderbilt","Texas A&M","Akron","Iowa","Arkansas","Tennessee"}'),
  ('Laura Vidal', '{"Houston","VCU","Gonzaga","Northern Iowa","Clemson","Long Island","Kansas","Wright State"}'),
  ('Mike Thiessen', '{"Vanderbilt","Tennessee","Arkansas","BYU","UConn","Michigan State","Illinois","Miami"}'),
  ('Franco Matty', '{"Iowa State","St. John''s","Saint Mary''s","VCU","Akron","Troy","Florida","M-OH/SMU"}'),
  ('Tanay Desai', '{"","","","","","","",""}'),
  ('Kalvin Kerwin', '{"Houston","St. John''s","BYU","Louisville","VCU","M-OH/SMU","Akron","Hofstra"}'),
  ('Rob Hunden', '{"","","","","","","",""}'),
  ('Steve Haemmerle', '{"","","","","","","",""}'),
  ('Sarah Jenkins', '{"St. John''s","UConn","Nebraska","Illinois","Arizona","Miami","M-OH/SMU","Michigan"}'),
  ('Claude', '{"Akron","McNeese","VCU","Penn","Northern Iowa","South Florida","Texas","High Point"}'),
  ('ChatGPT', '{"New Mexico","Xavier","Drake","Liberty","McNeese","BYU","Illinois","Saint Mary''s"}');

-- =============================================
-- Migration from old roster (run if updating existing DB)
-- =============================================
-- ALTER TABLE team_states ADD COLUMN win_prob real NOT NULL DEFAULT 0.5 CHECK (win_prob >= 0 AND win_prob <= 1);
-- DELETE FROM drafters WHERE name = 'Sarah';
-- UPDATE drafters SET picks = '{"South Florida","M-OH/SMU","Texas A&M","Santa Clara","Akron","VCU","BYU","TCU"}' WHERE name = 'Lucas';
-- UPDATE drafters SET picks = '{"St. John''s","VCU","Akron","Iowa State","Vanderbilt","South Florida","Arizona","UCLA"}' WHERE name = 'Derek';
-- INSERT INTO drafters (name, picks) VALUES
--   ('Billy Jenkins', '{"Michigan","Arizona","Houston","UConn","St. John''s","BYU","South Florida","Akron"}'),
--   ('Matthew Avila', '{"VCU","South Florida","Vanderbilt","Texas A&M","Akron","Iowa","Arkansas","Tennessee"}'),
--   ('Laura Vidal', '{"Houston","VCU","Gonzaga","Northern Iowa","Clemson","Long Island","Kansas","Wright State"}'),
--   ('Mike Thiessen', '{"Vanderbilt","Tennessee","Arkansas","BYU","UConn","Michigan State","Illinois","Miami"}'),
--   ('Franco Matty', '{"Iowa State","St. John''s","Saint Mary''s","VCU","Akron","Troy","Florida","M-OH/SMU"}'),
--   ('Tanay Desai', '{"","","","","","","",""}'),
--   ('Kalvin Kerwin', '{"Houston","St. John''s","BYU","Louisville","VCU","M-OH/SMU","Akron","Hofstra"}'),
--   ('Sarah Jenkins', '{"St. John''s","UConn","Nebraska","Illinois","Arizona","Miami","M-OH/SMU","Michigan"}'),
--   ('Rob Hunden', '{"","","","","","","",""}');
