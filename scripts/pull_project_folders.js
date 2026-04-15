// One-shot: pull all project_folders rows joined with customer name, write to /tmp/project_folders_all.json.
// Uses the @supabase/supabase-js client from the MicroGRID repo, which correctly handles sb_secret_ keys.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env.local
const envPath = path.join(process.env.HOME, 'Desktop/MicroGRID/.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Force anon — the sb_secret_ service role key in .env.local is stale/unregistered.
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing URL or key');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  // Can't do a 3-table join via PostgREST easily — pull the 3 tables separately and join client-side.
  console.error('Fetching project_folders...');
  let pf = [];
  let offset = 0;
  const pageSize = 2000;
  while (true) {
    const { data, error } = await sb
      .from('project_folders')
      .select('project_id, folder_url')
      .range(offset, offset + pageSize - 1);
    if (error) { console.error('pf error', error); process.exit(1); }
    pf = pf.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.error(`  ${pf.length} project_folders rows`);

  console.error('Fetching legacy_projects...');
  let lp = [];
  offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('legacy_projects')
      .select('id, name')
      .range(offset, offset + pageSize - 1);
    if (error) { console.error('lp error', error); process.exit(1); }
    lp = lp.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.error(`  ${lp.length} legacy_projects rows`);

  console.error('Fetching projects...');
  let pr = [];
  offset = 0;
  while (true) {
    const { data, error } = await sb
      .from('projects')
      .select('id, name')
      .range(offset, offset + pageSize - 1);
    if (error) { console.error('pr error', error); process.exit(1); }
    pr = pr.concat(data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.error(`  ${pr.length} projects rows`);

  // Build name map (legacy wins, projects fallback)
  const nameMap = new Map();
  for (const r of pr) nameMap.set(r.id, r.name);
  for (const r of lp) nameMap.set(r.id, r.name);

  // Join
  const joined = pf
    .map(r => ({
      project_id: r.project_id,
      folder_url: r.folder_url,
      expected_name: nameMap.get(r.project_id) || null,
    }))
    .filter(r => r.expected_name !== null);

  const outPath = '/tmp/project_folders_all.json';
  fs.writeFileSync(outPath, JSON.stringify(joined));
  console.error(`Wrote ${joined.length} joined rows to ${outPath}`);
  console.log(JSON.stringify({ joined: joined.length, pf: pf.length, lp: lp.length, pr: pr.length }));
})().catch(e => { console.error(e); process.exit(1); });
