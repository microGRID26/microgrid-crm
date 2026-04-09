#!/usr/bin/env python3
"""
Recover Google Drive folders for legacy projects missing from project_folders.

For each PROJ-XXXX in the orphan list, queries Google Drive for any folder
whose name contains the PROJ-ID. Outputs:
  - ~/Downloads/recover_folders.sql  → INSERT statements for project_folders
  - ~/Downloads/still_missing.txt    → PROJ-IDs with no folder found in Drive

Usage:
  python3 scripts/recover-orphan-folders.py

Requires:
  - ~/gdrive_token_readonly.pkl (created by list-drive-files.py first run)
  - The same client_secret JSON file referenced in list-drive-files.py

After running, paste recover_folders.sql into Supabase SQL editor.
"""

import os
import pickle
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials  # noqa: F401
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
TOKEN_FILE = os.path.expanduser('~/gdrive_token_readonly.pkl')
CLIENT_SECRET = os.path.expanduser(
    '~/Downloads/client_secret_628637774830-62uncp0jg51gq2ln17dvovgs18ac39cl.apps.googleusercontent.com.json'
)

OUT_SQL = os.path.expanduser('~/Downloads/recover_folders.sql')
OUT_MISSING = os.path.expanduser('~/Downloads/still_missing.txt')

# 26 orphans pulled 2026-04-09 — legacy_projects with no project_folders row
ORPHANS = [
    'PROJ-27870', 'PROJ-27609', 'PROJ-27410', 'PROJ-20479', 'PROJ-3415',
    'PROJ-3055',  'PROJ-3050',  'PROJ-11453', 'PROJ-11781', 'PROJ-9632',
    'PROJ-11538', 'PROJ-11053', 'PROJ-11286', 'PROJ-9560',  'PROJ-9646',
    'PROJ-8939',  'PROJ-9629',  'PROJ-9596',  'PROJ-8312',  'PROJ-8482',
    'PROJ-8102',  'PROJ-8169',  'PROJ-15873', 'PROJ-20933', 'PROJ-20818',
    'PROJ-28199',
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
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
    return creds


def find_folder(service, proj_id: str):
    """
    Search Drive for any folder whose name contains the PROJ-ID.
    Returns (folder_id, folder_name, parent_name) or None.
    """
    # Drive name search uses 'contains' — matches "PROJ-3415" inside
    # "PROJ-3415 — Tom Graumann", "PROJ-3415 Tom Graumann", etc.
    query = (
        f"mimeType = 'application/vnd.google-apps.folder' "
        f"and name contains '{proj_id}' and trashed = false"
    )
    try:
        results = service.files().list(
            q=query,
            fields='files(id, name, parents)',
            pageSize=10,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='allDrives',
        ).execute()
    except Exception as e:
        print(f"  ERROR searching {proj_id}: {e}")
        return None

    candidates = results.get('files', [])
    if not candidates:
        return None

    # Prefer exact "starts with PROJ-XXXX" with a non-digit boundary
    # (avoid PROJ-3415 matching PROJ-34150).
    def is_exact_match(name: str) -> bool:
        if not name.startswith(proj_id):
            return False
        tail = name[len(proj_id):]
        return not tail or not tail[0].isdigit()

    exact = [f for f in candidates if is_exact_match(f['name'])]
    if not exact:
        return None  # name-contains hit but no clean match — skip rather than guess

    # Resolve parent name for each candidate, then prefer non-"Drive" parents.
    # A parent named "Drive" means My Drive root — usually an empty placeholder.
    # The real BluDocs folders live under a vendor/PROJECTS folder.
    enriched = []
    for c in exact:
        parent_name = ''
        if c.get('parents'):
            try:
                parent = service.files().get(
                    fileId=c['parents'][0],
                    fields='name',
                    supportsAllDrives=True,
                ).execute()
                parent_name = parent.get('name', '')
            except Exception:
                pass
        enriched.append((c, parent_name))

    # Prefer matches whose parent is NOT "Drive" (i.e., not at My Drive root)
    real = [e for e in enriched if e[1] and e[1] != 'Drive']
    chosen, parent_name = real[0] if real else enriched[0]

    return (chosen['id'], chosen['name'], parent_name)


def main():
    creds = get_creds()
    service = build('drive', 'v3', credentials=creds)

    found = []   # (proj_id, folder_id, folder_name, parent_name)
    missing = [] # proj_id

    print(f"Searching Drive for {len(ORPHANS)} orphan folders...\n")
    for i, proj_id in enumerate(ORPHANS, 1):
        result = find_folder(service, proj_id)
        if result:
            folder_id, folder_name, parent_name = result
            found.append((proj_id, folder_id, folder_name, parent_name))
            print(f"  [{i:2}/{len(ORPHANS)}] {proj_id} → FOUND: {folder_name} (in {parent_name or '?'})")
        else:
            missing.append(proj_id)
            print(f"  [{i:2}/{len(ORPHANS)}] {proj_id} → NOT FOUND")

    # Write SQL
    with open(OUT_SQL, 'w') as f:
        f.write("-- Recovery sweep: insert project_folders rows for orphan legacy projects\n")
        f.write(f"-- Generated by scripts/recover-orphan-folders.py\n")
        f.write(f"-- Found {len(found)} of {len(ORPHANS)} orphans\n\n")
        for proj_id, folder_id, folder_name, parent_name in found:
            url = f"https://drive.google.com/drive/folders/{folder_id}"
            f.write(
                f"-- {proj_id}: {folder_name} (parent: {parent_name})\n"
                f"INSERT INTO project_folders (project_id, folder_id, folder_url) "
                f"VALUES ('{proj_id}', '{folder_id}', '{url}') "
                f"ON CONFLICT (project_id) DO UPDATE SET folder_id = EXCLUDED.folder_id, folder_url = EXCLUDED.folder_url;\n\n"
            )

    # Write missing list
    with open(OUT_MISSING, 'w') as f:
        f.write(f"# {len(missing)} legacy projects with no Google Drive folder found\n")
        f.write(f"# These either need manual creation OR they truly never had docs\n\n")
        for proj_id in missing:
            f.write(f"{proj_id}\n")

    print(f"\nSummary:")
    print(f"  Found:   {len(found)}")
    print(f"  Missing: {len(missing)}")
    print(f"\nOutput files:")
    print(f"  SQL:     {OUT_SQL}")
    print(f"  Missing: {OUT_MISSING}")

    if found:
        print(f"\nNext step: paste {OUT_SQL} into the Supabase SQL editor.")


if __name__ == '__main__':
    main()
