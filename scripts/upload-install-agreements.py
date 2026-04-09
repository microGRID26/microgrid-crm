#!/usr/bin/env python3
"""
Upload recovered install agreement PDFs to their project's Drive folder.

Reads ~/Downloads/install_agreement_urls.csv (output of recover-install-agreements.py),
then for each (project_id, agreement_url):
  1. Look up the project's folder_id from project_folders (Supabase)
  2. List children of that folder, find "03 Installation Agreement" subfolder
  3. Download PDF from the Enerflo S3 URL
  4. Upload to the install agreement subfolder

Uses ~/gdrive_token_write.pkl (same write-scope token as create-orphan-folders.py).

Usage:
  python3 scripts/upload-install-agreements.py            # dry run
  python3 scripts/upload-install-agreements.py --execute  # actually upload
  python3 scripts/upload-install-agreements.py --execute --limit 5  # test with 5 first
"""

import argparse
import csv
import io
import os
import pickle
import sys

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
import requests as req

SCOPES = ['https://www.googleapis.com/auth/drive']
TOKEN_FILE = os.path.expanduser('~/gdrive_token_write.pkl')
CLIENT_SECRET = os.path.expanduser(
    '~/Downloads/client_secret_628637774830-62uncp0jg51gq2ln17dvovgs18ac39cl.apps.googleusercontent.com.json'
)

INPUT_CSV = os.path.expanduser('~/Downloads/install_agreement_urls.csv')
OUT_LOG = os.path.expanduser('~/Downloads/upload_install_agreements_log.csv')

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
        print('Need write scope — opening browser for OAuth.')
        print('Pick gkelsch@trismartsolar.com.\n')
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
    return creds


# Hardcoded publishable key — project_folders has an anon_read RLS policy so
# this is enough to fetch folder mappings. Avoids env-var fumbling.
SUPABASE_URL = 'https://hzymsezqfxzpbcqryeim.supabase.co'
SUPABASE_ANON_KEY = 'sb_publishable_9yPXBcL2QGdKrYgHHWUKfg_kBKznGQT'


def supabase_get(path: str):
    headers = {'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {SUPABASE_ANON_KEY}'}
    resp = req.get(f'{SUPABASE_URL}/rest/v1/{path}', headers=headers)
    data = resp.json()
    if not isinstance(data, list):
        print(f'ERROR from Supabase ({resp.status_code}): {data}')
        sys.exit(1)
    return data


def list_children(service, folder_id: str):
    children = []
    page_token = None
    while True:
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields='nextPageToken, files(id, name, mimeType)',
            pageSize=1000,
            pageToken=page_token,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora='allDrives',
        ).execute()
        children.extend(results.get('files', []))
        page_token = results.get('nextPageToken')
        if not page_token:
            break
    return children


def find_install_agreement_folder(service, parent_folder_id: str):
    for c in list_children(service, parent_folder_id):
        if (c['mimeType'] == 'application/vnd.google-apps.folder'
                and INSTALL_AGREEMENT_NAME.lower() in c['name'].lower()):
            return c['id']
    return None


def create_install_agreement_folder(service, parent_folder_id: str) -> str:
    """Create the "03 Installation Agreement" subfolder under parent. Returns its ID."""
    body = {
        'name': INSTALL_AGREEMENT_NAME,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_folder_id],
    }
    created = service.files().create(
        body=body,
        fields='id',
        supportsAllDrives=True,
    ).execute()
    return created['id']


def already_uploaded(service, folder_id: str, filename: str) -> bool:
    """Check if a file with this name already exists in the folder."""
    for c in list_children(service, folder_id):
        if c['name'] == filename and c['mimeType'] != 'application/vnd.google-apps.folder':
            return True
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true', help='Actually upload (default: dry run)')
    parser.add_argument('--limit', type=int, default=0, help='Process only N rows (for testing)')
    args = parser.parse_args()

    if not os.path.exists(INPUT_CSV):
        print(f'ERROR: {INPUT_CSV} not found. Run recover-install-agreements.py first.')
        sys.exit(1)

    creds = get_creds()
    service = build('drive', 'v3', credentials=creds, cache_discovery=False)
    dry = not args.execute

    # Load all input rows
    with open(INPUT_CSV) as f:
        rows = list(csv.DictReader(f))
    if args.limit:
        rows = rows[:args.limit]
    print(f'Loaded {len(rows)} install agreement URLs from {INPUT_CSV}')

    # Bulk-fetch folder mappings from Supabase
    proj_ids = [r['project_id'] for r in rows]
    print(f'Fetching folder mappings for {len(proj_ids)} projects...')
    in_filter = ','.join(proj_ids)
    folder_rows = supabase_get(
        f'project_folders?select=project_id,folder_url&project_id=in.({in_filter})'
    )
    folder_map = {}
    for r in folder_rows:
        url = r['folder_url'] or ''
        fid = url.split('/folders/')[-1].split('/')[0].split('?')[0] if '/folders/' in url else ''
        if fid:
            folder_map[r['project_id']] = fid
    print(f'  Found folder mappings for {len(folder_map)} of {len(proj_ids)}')

    log_rows = []
    uploaded = 0
    skipped = 0
    errors = 0

    for i, row in enumerate(rows, 1):
        proj_id = row['project_id']
        url = row['agreement_url']
        customer = row.get('customer_name', '')

        parent_folder_id = folder_map.get(proj_id)
        if not parent_folder_id:
            print(f'  [{i:4}/{len(rows)}] {proj_id} → SKIP (no folder mapping)')
            log_rows.append({'project_id': proj_id, 'status': 'no_folder_mapping', 'detail': ''})
            skipped += 1
            continue

        try:
            ia_folder_id = find_install_agreement_folder(service, parent_folder_id)
        except HttpError as e:
            print(f'  [{i:4}/{len(rows)}] {proj_id} → ERROR listing parent: {e}')
            log_rows.append({'project_id': proj_id, 'status': 'list_error', 'detail': str(e)[:200]})
            errors += 1
            continue

        if not ia_folder_id:
            if dry:
                print(f'  [{i:4}/{len(rows)}] {proj_id} → would create "03 Installation Agreement" subfolder + upload')
                log_rows.append({'project_id': proj_id, 'status': 'dry_run_would_create_sub', 'detail': ''})
                continue
            try:
                ia_folder_id = create_install_agreement_folder(service, parent_folder_id)
                print(f'  [{i:4}/{len(rows)}] {proj_id} → created subfolder {ia_folder_id}')
            except HttpError as e:
                print(f'  [{i:4}/{len(rows)}] {proj_id} → ERROR creating subfolder: {e}')
                log_rows.append({'project_id': proj_id, 'status': 'subfolder_create_error', 'detail': str(e)[:200]})
                errors += 1
                continue

        # Build a clean filename
        s3_filename = url.split('/')[-1].split('?')[0]
        target_name = f'{proj_id} {customer} - Install Agreement.pdf' if customer else f'{proj_id} - Install Agreement.pdf'
        target_name = target_name.replace('/', '_')

        if not dry and already_uploaded(service, ia_folder_id, target_name):
            print(f'  [{i:4}/{len(rows)}] {proj_id} → SKIP (already uploaded)')
            log_rows.append({'project_id': proj_id, 'status': 'already_uploaded', 'detail': target_name})
            skipped += 1
            continue

        if dry:
            print(f'  [{i:4}/{len(rows)}] {proj_id} → would upload "{target_name}" to {ia_folder_id}')
            log_rows.append({'project_id': proj_id, 'status': 'dry_run', 'detail': target_name})
            continue

        # Download from S3
        try:
            resp = req.get(url, timeout=30)
            resp.raise_for_status()
            pdf_bytes = resp.content
        except Exception as e:
            print(f'  [{i:4}/{len(rows)}] {proj_id} → ERROR downloading: {e}')
            log_rows.append({'project_id': proj_id, 'status': 'download_error', 'detail': str(e)[:200]})
            errors += 1
            continue

        # Upload to Drive
        try:
            media = MediaIoBaseUpload(io.BytesIO(pdf_bytes), mimetype='application/pdf', resumable=False)
            body = {'name': target_name, 'parents': [ia_folder_id]}
            created = service.files().create(
                body=body,
                media_body=media,
                fields='id, name',
                supportsAllDrives=True,
            ).execute()
            print(f'  [{i:4}/{len(rows)}] {proj_id} → UPLOADED ({len(pdf_bytes):,} bytes) {created["id"]}')
            log_rows.append({'project_id': proj_id, 'status': 'uploaded', 'detail': created['id']})
            uploaded += 1
        except Exception as e:
            print(f'  [{i:4}/{len(rows)}] {proj_id} → ERROR uploading: {e}')
            log_rows.append({'project_id': proj_id, 'status': 'upload_error', 'detail': str(e)[:200]})
            errors += 1

    # Write log
    with open(OUT_LOG, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['project_id', 'status', 'detail'])
        w.writeheader()
        w.writerows(log_rows)

    print(f'\nSummary:')
    print(f'  Uploaded: {uploaded}')
    print(f'  Skipped:  {skipped}')
    print(f'  Errors:   {errors}')
    print(f'  Log:      {OUT_LOG}')
    if dry:
        print('\n  DRY RUN — re-run with --execute to actually upload.')


if __name__ == '__main__':
    main()
