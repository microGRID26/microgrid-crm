#!/usr/bin/env python3
"""
Audit Google Drive project folders linked from project_folders.

For each project folder, walks one level in to find "03 Installation Agreement"
(and the other 15 subfolders) and counts files in each. Flags:
  - empty parent folder
  - missing "03 Installation Agreement" subfolder
  - empty "03 Installation Agreement" subfolder

Usage:
  # Quick samples (default: 12 just-recovered + 20 random)
  python3 scripts/audit-project-folders.py

  # Specific projects
  python3 scripts/audit-project-folders.py --proj PROJ-27609,PROJ-9632

  # Larger random sample
  python3 scripts/audit-project-folders.py --random 100

  # Full audit (15,571 folders, ~30+ min)
  python3 scripts/audit-project-folders.py --all

Output:
  ~/Downloads/folder_audit.csv  — full results
  ~/Downloads/folder_problems.txt — projects flagged as broken
  Console summary at end
"""

import argparse
import csv
import os
import pickle
import sys

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import requests as req

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
TOKEN_FILE = os.path.expanduser('~/gdrive_token_readonly.pkl')
CLIENT_SECRET = os.path.expanduser(
    '~/Downloads/client_secret_628637774830-62uncp0jg51gq2ln17dvovgs18ac39cl.apps.googleusercontent.com.json'
)

OUT_CSV = os.path.expanduser('~/Downloads/folder_audit.csv')
OUT_PROBLEMS = os.path.expanduser('~/Downloads/folder_problems.txt')

# 19 projects most recently recovered by recover-orphan-folders.py
# (the @trismartsolar re-run with prefer-non-Drive-parent logic)
JUST_RECOVERED = [
    'PROJ-27870', 'PROJ-27609', 'PROJ-27410', 'PROJ-20479', 'PROJ-3415',
    'PROJ-9632',  'PROJ-11053', 'PROJ-11286', 'PROJ-9560', 'PROJ-9646',
    'PROJ-9629',  'PROJ-9596',  'PROJ-8312',  'PROJ-8482', 'PROJ-8102',
    'PROJ-8169',  'PROJ-20933', 'PROJ-20818', 'PROJ-28199',
]

INSTALL_AGREEMENT_NAME = '03 Installation Agreement'


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
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
    return creds


def supabase_get(path: str):
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if not url or not key or key.startswith('<') or key == 'your service role key':
        print('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing/placeholder.')
        print('       export the real values before running.')
        sys.exit(1)
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    resp = req.get(f'{url}/rest/v1/{path}', headers=headers)
    data = resp.json()
    if not isinstance(data, list):
        print(f'ERROR from Supabase ({resp.status_code}): {data}')
        sys.exit(1)
    return data


def list_children(service, folder_id: str):
    """List immediate children of a folder. Returns list of {id, name, mimeType}.

    corpora='allDrives' is REQUIRED to see contents of folders living in
    Shared Drives — the API defaults to 'user' which only returns the
    OAuth user's own My Drive items.
    """
    children = []
    page_token = None
    while True:
        try:
            results = service.files().list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields='nextPageToken, files(id, name, mimeType)',
                pageSize=1000,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                corpora='allDrives',
            ).execute()
        except Exception as e:
            print(f'  ERROR listing {folder_id}: {e}')
            return []
        children.extend(results.get('files', []))
        page_token = results.get('nextPageToken')
        if not page_token:
            break
    return children


def count_files_recursive(service, folder_id: str, max_depth: int = 4, depth: int = 0) -> int:
    """Count files (not folders) under a folder, recursively to max_depth."""
    if depth > max_depth:
        return 0
    children = list_children(service, folder_id)
    count = 0
    for c in children:
        if c['mimeType'] == 'application/vnd.google-apps.folder':
            count += count_files_recursive(service, c['id'], max_depth, depth + 1)
        else:
            count += 1
    return count


def folder_id_from_url(url: str) -> str:
    """Extract the folder ID from a Drive folder URL."""
    if not url:
        return ''
    if '/folders/' in url:
        return url.split('/folders/')[-1].split('/')[0].split('?')[0]
    return url


def audit_one(service, project_id: str, folder_id: str, fast: bool = False):
    """Audit one project folder. Returns dict with all the metrics.

    Fast mode skips the deep recursive total file count — uses 2 API calls
    per project instead of ~17. Used by --all to keep runtime reasonable.
    """
    children = list_children(service, folder_id)
    subfolders = [c for c in children if c['mimeType'] == 'application/vnd.google-apps.folder']
    files_at_root = [c for c in children if c['mimeType'] != 'application/vnd.google-apps.folder']

    install_agreement_subfolder = next(
        (c for c in subfolders if INSTALL_AGREEMENT_NAME.lower() in c['name'].lower()),
        None,
    )

    install_agreement_files = 0
    if install_agreement_subfolder:
        if fast:
            ia_children = list_children(service, install_agreement_subfolder['id'])
            install_agreement_files = sum(
                1 for c in ia_children
                if c['mimeType'] != 'application/vnd.google-apps.folder'
            )
        else:
            install_agreement_files = count_files_recursive(service, install_agreement_subfolder['id'])

    if fast:
        total_count = len(files_at_root) + len(subfolders)  # rough proxy
    else:
        total_count = len(files_at_root)
        for sf in subfolders:
            total_count += count_files_recursive(service, sf['id'])

    return {
        'project_id': project_id,
        'folder_id': folder_id,
        'total_files': total_count,
        'subfolder_count': len(subfolders),
        'has_install_agreement_folder': bool(install_agreement_subfolder),
        'install_agreement_files': install_agreement_files,
        'subfolder_names': '|'.join(sorted(c['name'] for c in subfolders))[:300],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--proj', help='Comma-separated PROJ-IDs to audit')
    parser.add_argument('--random', type=int, default=20, help='Random sample size (default 20)')
    parser.add_argument('--all', action='store_true', help='Audit ALL ~15,571 linked folders')
    parser.add_argument('--recovered', action='store_true',
                        help='Audit ONLY the 19 just-recovered projects (no random sample)')
    parser.add_argument('--include-recovered', action='store_true', default=True,
                        help='Include the just-recovered projects in default mode (default true)')
    args = parser.parse_args()

    creds = get_creds()
    service = build('drive', 'v3', credentials=creds)

    targets = []  # list of (project_id, folder_url)

    if args.recovered:
        rows = supabase_get(
            f'project_folders?select=project_id,folder_url&project_id=in.({",".join(JUST_RECOVERED)})'
        )
        targets.extend([(r['project_id'], r['folder_url']) for r in rows])
    elif args.proj:
        ids = [p.strip() for p in args.proj.split(',')]
        rows = supabase_get(
            f'project_folders?select=project_id,folder_url&project_id=in.({",".join(ids)})'
        )
        targets.extend([(r['project_id'], r['folder_url']) for r in rows])
    elif args.all:
        # Pull all legacy project IDs first, then join to project_folders
        legacy_rows = supabase_get('legacy_projects?select=id&limit=20000')
        legacy_ids = {r['id'] for r in legacy_rows}
        rows = supabase_get('project_folders?select=project_id,folder_url&limit=30000')
        for r in rows:
            if r['project_id'] in legacy_ids:
                targets.append((r['project_id'], r['folder_url']))
    else:
        # Default: just-recovered + random sample
        if args.include_recovered:
            rows = supabase_get(
                f'project_folders?select=project_id,folder_url&project_id=in.({",".join(JUST_RECOVERED)})'
            )
            targets.extend([(r['project_id'], r['folder_url']) for r in rows])

        # Random sample using OFFSET on a count-based sample
        import random
        rows = supabase_get('project_folders?select=project_id,folder_url&limit=20000')
        sample = random.sample(rows, min(args.random, len(rows)))
        # Avoid duplicating recovered ones in the sample
        recovered_set = set(JUST_RECOVERED)
        for r in sample:
            if r['project_id'] not in recovered_set:
                targets.append((r['project_id'], r['folder_url']))

    fast_mode = args.all
    print(f'Auditing {len(targets)} project folders{" (fast mode, 10 workers)" if fast_mode else ""}...\n')

    results = []
    problems = []

    def process(item):
        i, (proj_id, folder_url) = item
        folder_id = folder_id_from_url(folder_url)
        if not folder_id:
            return None
        # Each thread needs its own service object — credentials are thread-safe but
        # the service object is not.
        local_service = build('drive', 'v3', credentials=creds, cache_discovery=False)
        result = audit_one(local_service, proj_id, folder_id, fast=fast_mode)
        flags = []
        if result['total_files'] == 0:
            flags.append('EMPTY')
        if not result['has_install_agreement_folder']:
            flags.append('NO_INSTALL_AGREEMENT_FOLDER')
        elif result['install_agreement_files'] == 0:
            flags.append('EMPTY_INSTALL_AGREEMENT')
        return (i, proj_id, result, flags)

    if fast_mode:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        items = list(enumerate(targets, 1))
        with ThreadPoolExecutor(max_workers=10) as ex:
            futures = [ex.submit(process, item) for item in items]
            done = 0
            for future in as_completed(futures):
                done += 1
                out = future.result()
                if out is None:
                    continue
                _, proj_id, result, flags = out
                results.append(result)
                if flags:
                    problems.append((proj_id, ', '.join(flags), result))
                if done % 100 == 0 or done == len(targets):
                    print(f'  [{done:5}/{len(targets)}] processed — {len(problems)} problems so far')
    else:
        for i, (proj_id, folder_url) in enumerate(targets, 1):
            folder_id = folder_id_from_url(folder_url)
            if not folder_id:
                print(f'  [{i:3}/{len(targets)}] {proj_id} → SKIP (no folder_id)')
                continue
            result = audit_one(service, proj_id, folder_id, fast=False)
            results.append(result)
            flags = []
            if result['total_files'] == 0:
                flags.append('EMPTY')
            if not result['has_install_agreement_folder']:
                flags.append('NO_INSTALL_AGREEMENT_FOLDER')
            elif result['install_agreement_files'] == 0:
                flags.append('EMPTY_INSTALL_AGREEMENT')
            status = ', '.join(flags) if flags else 'OK'
            if flags:
                problems.append((proj_id, status, result))
            print(
                f"  [{i:3}/{len(targets)}] {proj_id} → "
                f"total={result['total_files']:>4}  "
                f"subfolders={result['subfolder_count']:>2}  "
                f"install_agreement={result['install_agreement_files']:>3}  "
                f"[{status}]"
            )

    # Write CSV
    if results:
        with open(OUT_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            writer.writeheader()
            writer.writerows(results)

    # Write problems summary
    with open(OUT_PROBLEMS, 'w') as f:
        f.write(f'# {len(problems)} of {len(results)} project folders flagged\n\n')
        for proj_id, status, r in problems:
            f.write(
                f"{proj_id}\t{status}\t"
                f"total_files={r['total_files']}  install_agreement={r['install_agreement_files']}\n"
            )

    print(f'\nSummary:')
    print(f'  Audited:  {len(results)}')
    print(f'  Problems: {len(problems)}')
    print(f"  CSV:      {OUT_CSV}")
    print(f"  Problems: {OUT_PROBLEMS}")


if __name__ == '__main__':
    main()
