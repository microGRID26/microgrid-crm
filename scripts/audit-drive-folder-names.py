#!/usr/bin/env python3
"""
Audit CRM↔Drive folder-name mismatches.

For each row in project_folders, fetch the current Drive folder metadata and
compare its name against legacy_projects.name (or projects.name as fallback).
Flags mismatches, trashed folders, no-access errors, and HTTP failures.

Three modes:

  --target <folder_id>       Single-folder spot check. Prints full metadata.
  --search <query>           Drive name search. Prints up to 20 matching folders.
  --count <folder_id>        Recursively count files + bytes inside a folder tree.
                             Pass --count multiple times to compare several candidates.
  --scan [--limit N]         Full sweep over project_folders. Writes CSV + summary.

Requires:
  - ~/gdrive_token_readonly.pkl (created by recover-orphan-folders.py first run)
  - Same client_secret JSON path used by the other scripts
  - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
    (source <(grep -v '^#' .env.local | sed 's/^/export /'))

Usage examples:
  python3 scripts/audit-drive-folder-names.py --target 1ioaBmXO0n5Uiv7ezXVweYedEonf6nLjO
  python3 scripts/audit-drive-folder-names.py --search "Denard"
  python3 scripts/audit-drive-folder-names.py --search "PROJ-28971"
  python3 scripts/audit-drive-folder-names.py --scan --limit 200     # dry test
  python3 scripts/audit-drive-folder-names.py --scan                  # full sweep
"""

from __future__ import annotations

import argparse
import csv
import os
import pickle
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests as req
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
TOKEN_FILE = os.path.expanduser('~/gdrive_token_readonly.pkl')
CLIENT_SECRET = os.path.expanduser(
    '~/Downloads/client_secret_628637774830-62uncp0jg51gq2ln17dvovgs18ac39cl.apps.googleusercontent.com.json'
)

OUT_DIR = os.path.expanduser('~/Desktop/MicroGRID-loose-files')
DATE = datetime.now().strftime('%Y-%m-%d')
OUT_CSV = os.path.join(OUT_DIR, f'drive-folder-audit-{DATE}.csv')

FOLDER_ID_RE = re.compile(r'/folders/([A-Za-z0-9_-]+)')
STOPWORDS = {'ii', 'iii', 'iv', 'jr', 'sr', 'mr', 'mrs', 'ms', 'and', 'the', 'llc',
             'inc', 'corp', 'lp', 'trust', 'family'}
TOKEN_RE = re.compile(r"[A-Za-z0-9]+")

# Concurrency + rate limit
MAX_WORKERS = 20
MAX_RETRIES = 5


def get_creds():
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as f:
            creds = pickle.load(f)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:
            creds = None
    if not creds or not creds.valid:
        if not os.path.exists(CLIENT_SECRET):
            print(f'ERROR: client secret not found at {CLIENT_SECRET}', file=sys.stderr)
            sys.exit(1)
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
    return creds


def supabase_get(path: str):
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if not url or not key or key.startswith('<'):
        print('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be exported.', file=sys.stderr)
        print('Try: source <(grep -v "^#" .env.local | sed "s/^/export /")', file=sys.stderr)
        sys.exit(1)
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    all_rows = []
    offset = 0
    page = 1000
    while True:
        range_hdr = {'Range-Unit': 'items', 'Range': f'{offset}-{offset + page - 1}'}
        resp = req.get(f'{url}/rest/v1/{path}', headers={**headers, **range_hdr})
        if resp.status_code not in (200, 206):
            print(f'ERROR from Supabase ({resp.status_code}): {resp.text}', file=sys.stderr)
            sys.exit(1)
        data = resp.json()
        if not isinstance(data, list):
            print(f'ERROR from Supabase: unexpected shape: {data}', file=sys.stderr)
            sys.exit(1)
        all_rows.extend(data)
        if len(data) < page:
            break
        offset += page
    return all_rows


def parse_folder_id(url: str):
    if not url:
        return None
    m = FOLDER_ID_RE.search(url)
    return m.group(1) if m else None


def name_tokens(name: str):
    """Lowercase significant tokens (len>=3, not stopwords, not pure digits)."""
    if not name:
        return set()
    tokens = set()
    for raw in TOKEN_RE.findall(name.lower()):
        if len(raw) < 3:
            continue
        if raw in STOPWORDS:
            continue
        if raw.isdigit():
            continue
        tokens.add(raw)
    return tokens


def classify(expected_name: str, drive_name: str) -> tuple[str, str]:
    """
    Returns (status, note). status in {ok, mismatch, weak_match}.
    Matching rule: at least one expected-name token appears in the Drive name.
    """
    expected = name_tokens(expected_name)
    actual = name_tokens(drive_name)
    if not expected:
        return ('ok', 'no expected name tokens (skipped compare)')
    overlap = expected & actual
    if overlap:
        if len(overlap) == 1 and len(expected) >= 3:
            return ('weak_match', f'only 1 of {len(expected)} tokens matched: {",".join(overlap)}')
        return ('ok', '')
    return ('mismatch', f'expected={sorted(expected)} drive={sorted(actual) or "[]"}')


def drive_get(service, folder_id: str):
    """Fetch folder metadata with retry/backoff. Returns dict or raises."""
    for attempt in range(MAX_RETRIES):
        try:
            return service.files().get(
                fileId=folder_id,
                fields='id,name,mimeType,trashed,parents,driveId,createdTime,modifiedTime,owners(emailAddress,displayName)',
                supportsAllDrives=True,
            ).execute()
        except HttpError as e:
            code = e.resp.status if hasattr(e, 'resp') else 0
            if code == 404:
                raise
            if code in (403, 429, 500, 503):
                # Backoff and retry
                sleep = (2 ** attempt) + random.random()
                time.sleep(min(sleep, 30))
                continue
            raise
    raise RuntimeError(f'{folder_id}: exceeded {MAX_RETRIES} retries')


def fetch_one(service, row):
    """Worker: fetch one folder and classify. Never raises."""
    project_id = row['project_id']
    expected = row.get('expected_name') or ''
    folder_id = parse_folder_id(row.get('folder_url') or '')
    if not folder_id:
        return {
            'project_id': project_id,
            'expected_name': expected,
            'drive_name': '',
            'folder_id': '',
            'status': 'bad_url',
            'note': row.get('folder_url') or '',
        }
    try:
        meta = drive_get(service, folder_id)
    except HttpError as e:
        code = e.resp.status if hasattr(e, 'resp') else 0
        status = 'not_found' if code == 404 else ('no_access' if code == 403 else 'http_error')
        return {
            'project_id': project_id,
            'expected_name': expected,
            'drive_name': '',
            'folder_id': folder_id,
            'status': status,
            'note': f'HTTP {code}',
        }
    except Exception as e:
        return {
            'project_id': project_id,
            'expected_name': expected,
            'drive_name': '',
            'folder_id': folder_id,
            'status': 'http_error',
            'note': str(e)[:200],
        }

    drive_name = meta.get('name', '')
    if meta.get('trashed'):
        return {
            'project_id': project_id,
            'expected_name': expected,
            'drive_name': drive_name,
            'folder_id': folder_id,
            'status': 'trashed',
            'note': '',
        }
    status, note = classify(expected, drive_name)
    return {
        'project_id': project_id,
        'expected_name': expected,
        'drive_name': drive_name,
        'folder_id': folder_id,
        'status': status,
        'note': note,
    }


# ---------- modes ----------

def mode_target(service, folder_id: str):
    print(f'Fetching metadata for {folder_id}...\n')
    try:
        meta = service.files().get(
            fileId=folder_id,
            fields='id,name,mimeType,trashed,parents,driveId,createdTime,modifiedTime,owners,lastModifyingUser,size',
            supportsAllDrives=True,
        ).execute()
    except HttpError as e:
        print(f'HTTP error: {e}', file=sys.stderr)
        sys.exit(1)
    for k, v in meta.items():
        print(f'  {k}: {v}')

    # List immediate children
    print('\nImmediate children:')
    try:
        res = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields='files(id,name,mimeType,size,modifiedTime)',
            pageSize=200,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='allDrives',
        ).execute()
        children = res.get('files', [])
        if not children:
            print('  (empty)')
        else:
            for c in children:
                kind = 'FOLDER' if c['mimeType'] == 'application/vnd.google-apps.folder' else c['mimeType']
                print(f"  {c['name']!r:50}  {kind:45}  {c.get('size','-')}")
    except HttpError as e:
        print(f'  list failed: {e}', file=sys.stderr)


def mode_count(service, folder_ids: list):
    """Recursively count files + sum bytes in each candidate folder tree.
    Prints a comparison table."""
    def walk(fid, depth=0):
        files = 0
        subs = 0
        total_bytes = 0
        page_token = None
        while True:
            try:
                res = service.files().list(
                    q=f"'{fid}' in parents and trashed = false",
                    fields='nextPageToken, files(id,name,mimeType,size)',
                    pageSize=200,
                    pageToken=page_token,
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    corpora='allDrives',
                ).execute()
            except HttpError as e:
                print(f'  [depth {depth}] list failed on {fid}: {e}', file=sys.stderr)
                break
            for c in res.get('files', []):
                if c['mimeType'] == 'application/vnd.google-apps.folder':
                    subs += 1
                    sf, ssubs, sb = walk(c['id'], depth + 1)
                    files += sf
                    subs += ssubs
                    total_bytes += sb
                else:
                    files += 1
                    try:
                        total_bytes += int(c.get('size', 0) or 0)
                    except ValueError:
                        pass
            page_token = res.get('nextPageToken')
            if not page_token:
                break
        return files, subs, total_bytes

    print(f'\n{"folder_id":38}  {"files":>7}  {"subfolders":>11}  {"total_bytes":>14}  {"top_name":40}')
    print('-' * 120)
    results = []
    for fid in folder_ids:
        # Get the top-level folder name for display
        try:
            meta = service.files().get(
                fileId=fid, fields='name,trashed',
                supportsAllDrives=True,
            ).execute()
            name = meta.get('name', '?')
            trashed = meta.get('trashed', False)
        except HttpError as e:
            print(f'{fid:38}  ERROR: {e}', file=sys.stderr)
            continue
        files, subs, total_bytes = walk(fid)
        results.append((fid, name, files, subs, total_bytes))
        mb = total_bytes / (1024 * 1024)
        trash_tag = '  [TRASHED]' if trashed else ''
        print(f'{fid:38}  {files:>7}  {subs:>11}  {total_bytes:>14,}  {name[:40]}{trash_tag}')
    if results:
        # Winner = most files (tiebreaker = most bytes)
        winner = max(results, key=lambda r: (r[2], r[4]))
        print(f'\nWinner: {winner[0]}  ({winner[1]})  — {winner[2]} files, {winner[4]/1024/1024:.1f} MB')


def mode_search(service, query: str):
    print(f'Searching Drive for folders containing {query!r}...\n')
    q = (
        f"mimeType = 'application/vnd.google-apps.folder' "
        f"and name contains '{query}' and trashed = false"
    )
    try:
        res = service.files().list(
            q=q,
            fields='files(id,name,parents,driveId,createdTime,modifiedTime)',
            pageSize=50,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='allDrives',
        ).execute()
    except HttpError as e:
        print(f'search failed: {e}', file=sys.stderr)
        sys.exit(1)
    files = res.get('files', [])
    print(f'{len(files)} result(s):\n')
    for f in files:
        print(f"  id={f['id']}")
        print(f"  name={f['name']!r}")
        print(f"  parents={f.get('parents', [])}")
        print(f"  created={f.get('createdTime', '-')}  modified={f.get('modifiedTime','-')}")
        print()


def mode_scan(service, limit: int | None):
    os.makedirs(OUT_DIR, exist_ok=True)
    print('Fetching project_folders rows...')
    folders = supabase_get('project_folders?select=project_id,folder_url')
    print(f'  {len(folders)} project_folders rows')

    # Pull expected names from legacy_projects first, then projects as fallback.
    print('Fetching legacy_projects names...')
    legacy_rows = supabase_get('legacy_projects?select=id,name')
    legacy_map = {r['id']: (r.get('name') or '').strip() for r in legacy_rows}

    print('Fetching projects names...')
    project_rows = supabase_get('projects?select=id,name')
    projects_map = {r['id']: (r.get('name') or '').strip() for r in project_rows}

    # Join
    rows = []
    for f in folders:
        pid = f['project_id']
        expected = legacy_map.get(pid) or projects_map.get(pid) or ''
        rows.append({
            'project_id': pid,
            'folder_url': f.get('folder_url'),
            'expected_name': expected,
        })
    if limit:
        rows = rows[:limit]
    print(f'Auditing {len(rows)} rows with {MAX_WORKERS} workers...\n')

    results = []
    counts = {}
    mismatches = []
    start = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_one, service, r): r['project_id'] for r in rows}
        done = 0
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            counts[res['status']] = counts.get(res['status'], 0) + 1
            if res['status'] == 'mismatch' and len(mismatches) < 50:
                mismatches.append(res)
            done += 1
            if done % 500 == 0 or done == len(rows):
                elapsed = time.time() - start
                rate = done / elapsed if elapsed > 0 else 0
                remaining = (len(rows) - done) / rate if rate > 0 else 0
                print(f'  [{done}/{len(rows)}] elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={remaining:.0f}s', flush=True)

    # Write CSV (sort: mismatch > weak_match > not_found > trashed > no_access > http_error > ok)
    order = {'mismatch': 0, 'weak_match': 1, 'not_found': 2, 'trashed': 3,
             'no_access': 4, 'http_error': 5, 'bad_url': 6, 'ok': 7}
    results.sort(key=lambda r: (order.get(r['status'], 99), r['project_id']))
    with open(OUT_CSV, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['project_id', 'expected_name', 'drive_name', 'folder_id', 'status', 'note'])
        w.writeheader()
        w.writerows(results)

    print('\n=== Summary ===')
    for status in ['ok', 'mismatch', 'weak_match', 'not_found', 'trashed', 'no_access', 'http_error', 'bad_url']:
        n = counts.get(status, 0)
        if n:
            print(f'  {status:12} {n:6}')
    print(f'\nCSV written to {OUT_CSV}')

    if mismatches:
        print(f'\n=== First {len(mismatches)} mismatches ===')
        for m in mismatches:
            print(f"  {m['project_id']:12} expected={m['expected_name']!r:40} drive={m['drive_name']!r}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', help='Single-folder spot check (Drive folder ID)')
    parser.add_argument('--search', help='Drive name contains search')
    parser.add_argument('--count', action='append', default=[],
                        help='Recursive file count. Repeat flag to compare multiple folders.')
    parser.add_argument('--scan', action='store_true', help='Full sweep')
    parser.add_argument('--limit', type=int, help='Limit rows in --scan mode')
    args = parser.parse_args()
    if not any([args.target, args.search, args.count, args.scan]):
        parser.error('pick one of --target, --search, --count, --scan')

    creds = get_creds()
    service = build('drive', 'v3', credentials=creds, cache_discovery=False)

    if args.target:
        mode_target(service, args.target)
    elif args.search:
        mode_search(service, args.search)
    elif args.count:
        mode_count(service, args.count)
    elif args.scan:
        mode_scan(service, args.limit)


if __name__ == '__main__':
    main()
