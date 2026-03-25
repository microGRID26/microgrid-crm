#!/usr/bin/env python3
"""
Sync Google Drive file metadata into the project_files Supabase table.

For each project with a linked Google Drive folder (in project_folders),
recursively lists all files and upserts metadata into project_files.

Usage:
  python3 scripts/sync-drive-files.py                    # sync all projects
  python3 scripts/sync-drive-files.py --project PROJ-12345  # sync one project
  python3 scripts/sync-drive-files.py --limit 50         # sync first 50 projects
  python3 scripts/sync-drive-files.py --dry-run           # output JSON, no DB writes
  python3 scripts/sync-drive-files.py --dry-run --output /tmp/drive_files.json

Requires:
  pip install google-api-python-client google-auth google-auth-oauthlib requests
"""

import argparse
import json
import os
import pickle
import sys
import time
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

warnings.filterwarnings('ignore')

import requests
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# --- Configuration ---
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDS_FILE = '/Users/gregkelsch/trismart-crm/gdrive_credentials.json'
TOKEN_FILE = '/Users/gregkelsch/trismart-crm/gdrive_token.pkl'

# Google Drive shared drive ID for MicroGRID Projects
SHARED_DRIVE_ID = '0AOfR6a15VRrDUk9PVA'

# Rate limiting
API_DELAY = 0.05  # 50ms between API calls
MAX_RETRIES = 5
RETRY_BACKOFF = 2  # exponential backoff multiplier

# Supabase batch size
UPSERT_BATCH_SIZE = 200

# Skip projects synced within this many hours
SKIP_IF_SYNCED_WITHIN_HOURS = 24


def load_env():
    """Load .env.local from project root."""
    env_path = Path(__file__).resolve().parent.parent / '.env.local'
    if not env_path.exists():
        print(f"ERROR: {env_path} not found")
        sys.exit(1)
    env = {}
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            env[key.strip()] = val.strip()
    return env


def authenticate_google():
    """Authenticate to Google Drive API with token caching."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as f:
            creds = pickle.load(f)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired Google token...")
            creds.refresh(GoogleRequest())
        else:
            if not os.path.exists(CREDS_FILE):
                print(f"ERROR: {CREDS_FILE} not found.")
                print("Need Google OAuth credentials file to authenticate.")
                sys.exit(1)
            print("Opening browser for Google OAuth...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)
        print("Google token saved.")

    return build('drive', 'v3', credentials=creds)


def api_call_with_retry(func, *args, **kwargs):
    """Execute a Google API call with exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(API_DELAY)
            return func(*args, **kwargs).execute()
        except HttpError as e:
            status = e.resp.status
            if status in (429, 500, 502, 503):
                wait = RETRY_BACKOFF ** (attempt + 1)
                print(f"    API {status}, retry {attempt+1}/{MAX_RETRIES} in {wait}s...")
                time.sleep(wait)
            elif status == 404:
                return None
            elif status == 403:
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BACKOFF ** (attempt + 1)
                    print(f"    API 403, retry {attempt+1}/{MAX_RETRIES} in {wait}s...")
                    time.sleep(wait)
                else:
                    raise
            else:
                raise
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF ** (attempt + 1)
                print(f"    Error: {e}, retry {attempt+1}/{MAX_RETRIES} in {wait}s...")
                time.sleep(wait)
            else:
                raise
    return None


def list_files_recursive(service, folder_id, folder_name='root'):
    """
    Recursively list all files in a folder on a shared drive.
    Returns list of dicts with file metadata + parent folder name.
    """
    all_files = []
    page_token = None

    query = f"'{folder_id}' in parents and trashed = false"
    kwargs = {
        'q': query,
        'fields': 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
        'pageSize': 1000,
        'supportsAllDrives': True,
        'includeItemsFromAllDrives': True,
    }

    while True:
        if page_token:
            kwargs['pageToken'] = page_token

        result = api_call_with_retry(service.files().list, **kwargs)
        if result is None:
            break

        for item in result.get('files', []):
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                # Recurse into subfolder
                subfolder_files = list_files_recursive(
                    service, item['id'], item['name']
                )
                all_files.extend(subfolder_files)
            else:
                all_files.append({
                    'file_id': item['id'],
                    'file_name': item['name'],
                    'folder_name': folder_name,
                    'file_url': f"https://drive.google.com/file/d/{item['id']}/view",
                    'mime_type': item.get('mimeType'),
                    'file_size': int(item.get('size', 0)),
                    'created_at': item.get('createdTime'),
                    'updated_at': item.get('modifiedTime'),
                })

        page_token = result.get('nextPageToken')
        if not page_token:
            break

    return all_files


def load_project_folders(env, project_id=None):
    """Fetch project_folders from Supabase."""
    url = env['NEXT_PUBLIC_SUPABASE_URL']
    key = env.get('SUPABASE_SERVICE_ROLE_KEY', env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

    endpoint = f"{url}/rest/v1/project_folders?select=project_id,folder_id"
    if project_id:
        endpoint += f"&project_id=eq.{project_id}"

    # Filter out null folder_ids
    endpoint += "&folder_id=not.is.null"

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }

    resp = requests.get(endpoint, headers=headers)
    if resp.status_code != 200:
        print(f"ERROR fetching project_folders: {resp.status_code} {resp.text}")
        sys.exit(1)

    return resp.json()


def load_last_synced(env, project_ids):
    """
    For each project_id, get the max(synced_at) from project_files.
    Returns dict: project_id -> last_synced datetime or None.
    """
    if not project_ids:
        return {}

    url = env['NEXT_PUBLIC_SUPABASE_URL']
    key = env.get('SUPABASE_SERVICE_ROLE_KEY', env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }

    # Query project_files for these project_ids, get max synced_at per project
    # We'll use a simple approach: get distinct project_ids with their max synced_at
    # by ordering and taking the first per group
    result = {}

    # Batch the project IDs to avoid URL length issues
    batch_size = 50
    for i in range(0, len(project_ids), batch_size):
        batch = project_ids[i:i + batch_size]
        ids_param = ','.join(batch)
        endpoint = (
            f"{url}/rest/v1/project_files"
            f"?select=project_id,synced_at"
            f"&project_id=in.({ids_param})"
            f"&order=synced_at.desc"
            f"&limit=5000"
        )

        resp = requests.get(endpoint, headers=headers)
        if resp.status_code == 200:
            rows = resp.json()
            for row in rows:
                pid = row['project_id']
                synced = row.get('synced_at')
                if synced and (pid not in result or synced > result[pid]):
                    result[pid] = synced
        elif resp.status_code == 404:
            # Table doesn't exist yet, that's fine
            pass
        else:
            print(f"  Warning: could not check synced_at: {resp.status_code}")

    return result


def upsert_project_files(env, records):
    """Upsert file records into project_files via Supabase REST API."""
    if not records:
        return 0, 0

    url = env['NEXT_PUBLIC_SUPABASE_URL']
    key = env.get('SUPABASE_SERVICE_ROLE_KEY', env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
    }

    inserted = 0
    errors = 0

    for i in range(0, len(records), UPSERT_BATCH_SIZE):
        batch = records[i:i + UPSERT_BATCH_SIZE]
        endpoint = f"{url}/rest/v1/project_files"

        resp = requests.post(endpoint, headers=headers, json=batch)
        if resp.status_code in (200, 201):
            inserted += len(batch)
        else:
            errors += len(batch)
            if errors <= 5:
                print(f"    Upsert error: {resp.status_code} {resp.text[:200]}")

    return inserted, errors


def main():
    parser = argparse.ArgumentParser(description='Sync Google Drive file metadata to Supabase')
    parser.add_argument('--project', type=str, help='Sync a single project (e.g. PROJ-12345)')
    parser.add_argument('--limit', type=int, help='Only process N projects')
    parser.add_argument('--dry-run', action='store_true', help='Output JSON instead of upserting')
    parser.add_argument('--output', type=str, default='/tmp/drive_files.json',
                        help='Output path for --dry-run JSON (default: /tmp/drive_files.json)')
    parser.add_argument('--force', action='store_true',
                        help='Ignore 24-hour skip window, re-sync all')
    args = parser.parse_args()

    print("=" * 60)
    print("Google Drive -> project_files Sync")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 60)

    # Load environment
    env = load_env()
    print(f"Supabase: {env['NEXT_PUBLIC_SUPABASE_URL']}")

    # Authenticate Google
    service = authenticate_google()
    print("Google Drive API authenticated.\n")

    # Load project folders
    folders = load_project_folders(env, project_id=args.project)
    print(f"Found {len(folders)} project folders in Supabase.")

    if not folders:
        print("No project folders to sync.")
        return

    # Apply --limit
    if args.limit:
        folders = folders[:args.limit]
        print(f"Limited to {args.limit} projects.")

    # Check last synced times (skip recently synced unless --force)
    project_ids = [f['project_id'] for f in folders]
    if not args.force and not args.project:
        print("Checking last sync times...")
        last_synced = load_last_synced(env, project_ids)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=SKIP_IF_SYNCED_WITHIN_HOURS)).isoformat()

        original_count = len(folders)
        folders = [
            f for f in folders
            if f['project_id'] not in last_synced or last_synced[f['project_id']] < cutoff
        ]
        skipped = original_count - len(folders)
        if skipped > 0:
            print(f"Skipping {skipped} projects synced within last {SKIP_IF_SYNCED_WITHIN_HOURS}h.")
    else:
        last_synced = {}

    print(f"\nProcessing {len(folders)} projects...\n")

    # Process each project
    all_records = []
    total_files = 0
    total_errors = 0
    synced_projects = 0
    failed_projects = 0
    start_time = time.time()

    for idx, folder in enumerate(folders):
        project_id = folder['project_id']
        folder_id = folder['folder_id']

        if not folder_id:
            continue

        try:
            files = list_files_recursive(service, folder_id, 'root')

            now_iso = datetime.now(timezone.utc).isoformat()
            records = []
            for f in files:
                records.append({
                    'project_id': project_id,
                    'file_id': f['file_id'],
                    'file_name': f['file_name'],
                    'folder_name': f['folder_name'],
                    'file_url': f['file_url'],
                    'mime_type': f['mime_type'],
                    'file_size': f['file_size'],
                    'created_at': f['created_at'],
                    'updated_at': f['updated_at'],
                    'synced_at': now_iso,
                })

            if args.dry_run:
                all_records.extend(records)
            else:
                ins, err = upsert_project_files(env, records)
                total_errors += err

            total_files += len(files)
            synced_projects += 1

        except Exception as e:
            print(f"  ERROR {project_id}: {e}")
            failed_projects += 1

        # Progress every 10 projects
        if (idx + 1) % 10 == 0 or idx == len(folders) - 1:
            elapsed = time.time() - start_time
            rate = (idx + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(folders) - idx - 1) / rate if rate > 0 else 0
            print(
                f"  [{idx+1}/{len(folders)}] "
                f"{synced_projects} synced, {total_files} files, "
                f"{failed_projects} failed "
                f"({elapsed:.0f}s elapsed, ~{remaining:.0f}s remaining)"
            )

    # Output
    if args.dry_run:
        output_path = args.output
        with open(output_path, 'w') as f:
            json.dump(all_records, f, indent=2, default=str)
        print(f"\nDry run: wrote {len(all_records)} records to {output_path}")
    else:
        print(f"\nUpserted to Supabase. Errors: {total_errors}")

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"SYNC COMPLETE")
    print(f"{'='*60}")
    print(f"Projects processed: {synced_projects}")
    print(f"Projects failed:    {failed_projects}")
    print(f"Total files found:  {total_files}")
    print(f"Time:               {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"Finished:           {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
