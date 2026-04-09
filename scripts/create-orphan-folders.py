#!/usr/bin/env python3
"""
Create blank folder structures in Google Drive for the 26 legacy projects
that have no project_folders row and no real BluDocs folder.

For each orphan, creates:
  PROJECTS/
    Orphan Recovery 2026-04-09/
      PROJ-XXXXX — Customer Name/
        01 Proposal/
        02 Lending Agreement/
        03 Installation Agreement/
        04 Welcome Call/
        ... (16 subfolders total)

Then writes INSERT SQL to project_folders so the new URLs are linked to
the legacy_projects rows.

REQUIRES drive.file scope (write access). Uses a SEPARATE token file
(~/gdrive_token_write.pkl) so it doesn't clobber the readonly token used
by audit/list/recover scripts. First run opens browser for OAuth.

Usage:
  python3 scripts/create-orphan-folders.py            # dry run, lists what would be created
  python3 scripts/create-orphan-folders.py --execute  # actually create folders
"""

import argparse
import os
import pickle
import sys

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import requests as req

SCOPES = ['https://www.googleapis.com/auth/drive']
TOKEN_FILE = os.path.expanduser('~/gdrive_token_write.pkl')
CLIENT_SECRET = os.path.expanduser(
    '~/Downloads/client_secret_628637774830-62uncp0jg51gq2ln17dvovgs18ac39cl.apps.googleusercontent.com.json'
)

OUT_SQL = os.path.expanduser('~/Downloads/create_orphan_folders.sql')

# Anchor folder — a known PROJ folder inside PROJECTS that we use to
# discover the PROJECTS folder ID. Was found by recover-orphan-folders.py.
ANCHOR_FOLDER_ID = '1v0zOFlH_cq5tdCqiQ2a0CfCzx-sb-gWS'  # PROJ-27870

RECOVERY_BUCKET_NAME = 'Orphan Recovery 2026-04-09'

# 26 orphan PROJ-IDs — same list as recover-orphan-folders.py
ORPHANS = [
    'PROJ-27870', 'PROJ-27609', 'PROJ-27410', 'PROJ-20479', 'PROJ-3415',
    'PROJ-3055',  'PROJ-3050',  'PROJ-11453', 'PROJ-11781', 'PROJ-9632',
    'PROJ-11538', 'PROJ-11053', 'PROJ-11286', 'PROJ-9560',  'PROJ-9646',
    'PROJ-8939',  'PROJ-9629',  'PROJ-9596',  'PROJ-8312',  'PROJ-8482',
    'PROJ-8102',  'PROJ-8169',  'PROJ-15873', 'PROJ-20933', 'PROJ-20818',
    'PROJ-28199',
]

# 16 standard subfolders per project_google_drive_folders.md memory
SUBFOLDERS = [
    '01 Proposal',
    '02 Lending Agreement',
    '03 Installation Agreement',
    '04 Welcome Call',
    '05 Utility Bill',
    '06 HOA',
    '07 Site Survey',
    '08 Design',
    '09 Permits',
    '10 Roof Install',
    '11 Electrical Install',
    '12 Battery',
    '13 PTO - Inspection',
    '14 Service',
    '15 Legacy',
    '20 Cases',
]


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
        print('First run with write scope — opening browser for OAuth.')
        print('IMPORTANT: pick gkelsch@trismartsolar.com (account that owns PROJECTS).\n')
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
    return creds


def supabase_get(path: str):
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if not url or not key or key.startswith('<'):
        print('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be exported.')
        sys.exit(1)
    headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
    resp = req.get(f'{url}/rest/v1/{path}', headers=headers)
    data = resp.json()
    if not isinstance(data, list):
        print(f'ERROR from Supabase ({resp.status_code}): {data}')
        sys.exit(1)
    return data


def get_parent_id(service, file_id: str) -> str:
    """Return the parent folder ID of a file/folder."""
    meta = service.files().get(
        fileId=file_id,
        fields='parents',
        supportsAllDrives=True,
    ).execute()
    parents = meta.get('parents', [])
    return parents[0] if parents else ''


def find_or_create_folder(service, name: str, parent_id: str, dry_run: bool):
    """Find a folder by name+parent, or create if missing. Returns folder_id."""
    query = (
        f"name = '{name}' and '{parent_id}' in parents "
        f"and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    results = service.files().list(
        q=query,
        fields='files(id, name)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora='allDrives',
    ).execute()
    found = results.get('files', [])
    if found:
        return found[0]['id'], False  # (id, was_created)
    if dry_run:
        return '<DRY-RUN>', True
    body = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id],
    }
    created = service.files().create(
        body=body,
        fields='id',
        supportsAllDrives=True,
    ).execute()
    return created['id'], True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true', help='Actually create folders (default: dry run)')
    args = parser.parse_args()

    creds = get_creds()
    service = build('drive', 'v3', credentials=creds, cache_discovery=False)
    dry = not args.execute

    # Step 1: discover the PROJECTS folder ID by following parent chain from anchor
    print(f'Step 1: discovering PROJECTS folder via anchor {ANCHOR_FOLDER_ID}...')
    try:
        projects_folder_id = get_parent_id(service, ANCHOR_FOLDER_ID)
    except HttpError as e:
        print(f'  ERROR: {e}')
        print('  The token user may not have access to PROJECTS. Re-auth as gkelsch@trismartsolar.com.')
        sys.exit(1)
    print(f'  PROJECTS folder ID: {projects_folder_id}')

    # Step 2: find or create the recovery bucket folder
    print(f'\nStep 2: ensuring "{RECOVERY_BUCKET_NAME}" exists under PROJECTS...')
    bucket_id, bucket_created = find_or_create_folder(
        service, RECOVERY_BUCKET_NAME, projects_folder_id, dry,
    )
    print(f'  Bucket ID: {bucket_id} ({"CREATED" if bucket_created else "found"})')

    # Step 3: pull customer names from legacy_projects
    print(f'\nStep 3: fetching customer names from legacy_projects...')
    in_filter = ','.join(ORPHANS)
    rows = supabase_get(f'legacy_projects?select=id,name&id=in.({in_filter})')
    name_map = {r['id']: (r.get('name') or 'Unknown') for r in rows}
    print(f'  Got {len(name_map)} names')

    # Step 4: for each orphan, create folder + 16 subfolders
    print(f'\nStep 4: creating {len(ORPHANS)} project folders + 16 subfolders each...')
    if dry:
        print('  (DRY RUN — nothing will actually be created)')

    sql_inserts = []
    for i, proj_id in enumerate(ORPHANS, 1):
        cust = name_map.get(proj_id, 'Unknown')
        folder_name = f'{proj_id} — {cust}'
        proj_folder_id, created = find_or_create_folder(service, folder_name, bucket_id, dry)
        marker = 'CREATED' if created else 'exists'
        print(f'  [{i:2}/{len(ORPHANS)}] {folder_name} → {marker} ({proj_folder_id})')

        # 16 subfolders
        for sub in SUBFOLDERS:
            sub_id, sub_created = find_or_create_folder(service, sub, proj_folder_id, dry)
            if sub_created and not dry:
                pass  # silent on success to keep output clean

        if not dry:
            url = f'https://drive.google.com/drive/folders/{proj_folder_id}'
            sql_inserts.append(
                f"INSERT INTO project_folders (project_id, folder_id, folder_url) VALUES "
                f"('{proj_id}', '{proj_folder_id}', '{url}') "
                f"ON CONFLICT (project_id) DO UPDATE SET folder_id = EXCLUDED.folder_id, folder_url = EXCLUDED.folder_url;"
            )

    if not dry and sql_inserts:
        with open(OUT_SQL, 'w') as f:
            f.write('-- Insert recovery folders for 26 orphan legacy projects\n')
            f.write(f'-- Generated by scripts/create-orphan-folders.py\n\n')
            f.write('\n'.join(sql_inserts))
            f.write('\n')
        print(f'\nSQL written to {OUT_SQL}')

    print(f'\nDone. {"DRY RUN — re-run with --execute to create." if dry else "Folders created."}')


if __name__ == '__main__':
    main()
