#!/usr/bin/env python3
"""
One-shot ESID repair bot for greg_actions #127.

Queries the ElectricityPlans.com ESI ID lookup AJAX endpoint (same data as the
ERCOT TDSP ESIID extract, public nonce-gated, no login) for each project whose
esid column is scientifically-notated garbage (e.g. "1.0089E+21"). Writes a
review CSV keyed by project_id that a human approves before UPDATE.

Creds from ~/.claude/secrets/.env (matches greg_actions.py).

Usage:
  python3 scripts/esid-repair/fetch_esids.py                 # all corrupted rows
  python3 scripts/esid-repair/fetch_esids.py --limit 5       # smoke test
  python3 scripts/esid-repair/fetch_esids.py --sleep 0.5     # tighter rate
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

SECRETS_ENV = Path.home() / ".claude" / "secrets" / ".env"
LOOKUP_PAGE = "https://electricityplans.com/texas/esid-lookup/"
AJAX_BASE = "https://electricityplans.com/texas/wp-admin/admin-ajax.php"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
OUT_CSV = Path(__file__).parent / "esid_repair_matches.csv"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if not SECRETS_ENV.exists():
        sys.exit(f"missing {SECRETS_ENV}")
    for line in SECRETS_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def pg_select(env: dict[str, str], path: str) -> list[dict[str, Any]]:
    url = f"{env['MICROGRID_SUPABASE_URL']}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": env["MICROGRID_SUPABASE_SERVICE_KEY"],
        "Authorization": f"Bearer {env['MICROGRID_SUPABASE_SERVICE_KEY']}",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_nonce() -> str:
    """Scrape the lookup page for the `code` nonce that gates esisearch."""
    req = urllib.request.Request(LOOKUP_PAGE, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        html = resp.read().decode("utf-8", errors="replace")
    # Rendered as <input type="hidden" id="ps-esisearch-nonce" value="<hex>">
    for pat in (r'id=["\']ps-esisearch-nonce["\']\s+value=["\']([a-f0-9]{8,})["\']',
                r'["\']code["\']\s*:\s*["\']([a-f0-9]{8,})["\']',
                r'code=([a-f0-9]{8,})'):
        m = re.search(pat, html)
        if m:
            return m.group(1)
    raise RuntimeError("could not extract `code` nonce from lookup page HTML")


def lookup(nonce: str, address: str, zipcode: str = "") -> list[dict[str, Any]]:
    q = urllib.parse.urlencode({
        "action": "esisearch",
        "code": nonce,
        "address": address,
        "zipcode": zipcode,
    })
    req = urllib.request.Request(
        f"{AJAX_BASE}?{q}",
        headers={
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "Referer": LOOKUP_PAGE,
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read())
    return payload.get("results", []) if isinstance(payload, dict) else payload


_STREET_SUBS = [
    (r"\bstreet\b", "st"), (r"\bdrive\b", "dr"), (r"\broad\b", "rd"),
    (r"\bavenue\b", "ave"), (r"\bcourt\b", "ct"), (r"\blane\b", "ln"),
    (r"\btrail\b", "trl"), (r"\bboulevard\b", "blvd"), (r"\bcircle\b", "cir"),
    (r"\bhighway\b", "hwy"), (r"\bparkway\b", "pkwy"), (r"\bplace\b", "pl"),
    (r"\bnorth\b", "n"), (r"\bsouth\b", "s"), (r"\beast\b", "e"), (r"\bwest\b", "w"),
]

# Suffix tokens that, when they're the only difference between two normalized
# street strings, indicate a Dr/St/Ln-style variant of the same address.
_SUFFIX_TOKENS = {
    "st", "dr", "ln", "rd", "ave", "ct", "blvd", "cir", "trl", "pkwy",
    "pl", "way", "ter", "loop", "hwy",
}

# Map raw DB utility strings → canonical TDU slugs used by ElectricityPlans.com.
# Keys are normalized (lowercase, punctuation stripped, single-spaced).
_TDU_NORMALIZE = {
    "oncor": "oncor",
    "oncor electric delivery": "oncor",
    "oncor electric delivery company": "oncor",
    "aep texas": "aep_central",
    "aep central": "aep_central",
    "aep texas central": "aep_central",
    "aep texas central company": "aep_central",
    "aep north": "aep_north",
    "aep texas north": "aep_north",
    "aep texas north company": "aep_north",
    "centerpoint": "centerpoint",
    "centerpoint energy": "centerpoint",
    "centerpoint energy houston electric": "centerpoint",
    "centerpoint energy houston electric llc": "centerpoint",
    "tnmp": "tnmp",
    "texas new mexico power": "tnmp",
    "texas new mexico power company": "tnmp",
}

# Utilities whose service territory is off the ERCOT grid — ElectricityPlans
# only indexes ERCOT meters, so a lookup will never resolve. Skip without
# burning a request.
_OFF_ERCOT_PATTERNS = [r"\bentergy\b"]


def _strip_trailing_suffix(street: str) -> str:
    """Drop the last token from `street` if it's a known road-type suffix."""
    parts = street.split()
    if len(parts) >= 2 and parts[-1] in _SUFFIX_TOKENS:
        return " ".join(parts[:-1])
    return street


def normalize_tdu(raw: str) -> str:
    s = (raw or "").lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return _TDU_NORMALIZE.get(s, s)


def is_off_ercot(utility: str) -> bool:
    s = (utility or "").lower()
    return any(re.search(p, s) for p in _OFF_ERCOT_PATTERNS)


def normalize_street(raw: str) -> str:
    s = raw.lower().strip()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for pat, rep in _STREET_SUBS:
        s = re.sub(pat, rep, s)
    return re.sub(r"\s+", " ", s).strip()


def score(db_addr: str, candidate: str) -> float:
    """0.0 – 1.0 confidence that `candidate` is the same street address as `db_addr`."""
    a = normalize_street(db_addr)
    b = normalize_street(candidate)
    if a == b:
        return 1.0
    a_num = re.match(r"(\d+)", a)
    b_num = re.match(r"(\d+)", b)
    if not a_num or not b_num or a_num.group(1) != b_num.group(1):
        return 0.0
    a_street = re.sub(r"^\d+\s+", "", a)
    b_street = re.sub(r"^\d+\s+", "", b)
    if a_street == b_street:
        return 0.97
    # Strip trailing suffix tokens (st/dr/ln/...) from both sides and compare
    # the cores. Catches "driftwood" vs "driftwood st" (suffix-only) AND
    # "yosemite dr" vs "yosemite st" (suffix-swap). The TDU mismatch penalty in
    # pick_best() is what makes this safe — same number on different TDUs still
    # gets surfaced for review.
    a_core = _strip_trailing_suffix(a_street)
    b_core = _strip_trailing_suffix(b_street)
    if a_core and a_core == b_core:
        return 0.97
    if a_street in b_street or b_street in a_street:
        return 0.85
    aw, bw = set(a_street.split()), set(b_street.split())
    if not aw or not bw:
        return 0.0
    return round(0.75 * len(aw & bw) / max(len(aw), len(bw)), 2)


def pick_best(
    db_addr: str,
    candidates: list[dict[str, Any]],
    db_utility: str = "",
) -> tuple[dict[str, Any] | None, float]:
    """Pick the highest-scoring candidate, breaking ties toward Active non-TEMP meters."""
    db_tdu = normalize_tdu(db_utility) if db_utility else ""
    scored = []
    for c in candidates:
        s = score(db_addr, c.get("address", ""))
        if s == 0.0:
            continue
        # Penalties: De-Energized/Inactive = -0.2, TEMP suffix = -0.1
        st = (c.get("status") or "").lower()
        if "energ" in st or "inact" in st:
            s -= 0.20
        if re.search(r"\btemp\b", (c.get("address") or "").lower()):
            s -= 0.10
        # TDU mismatch: drop hard so the row falls into deferred with a clear
        # reason instead of being auto-applied. Only penalize when we have a
        # DB utility to compare against AND a candidate TDU.
        cand_tdu = normalize_tdu(c.get("tdu") or "")
        if db_tdu and cand_tdu and db_tdu != cand_tdu:
            s -= 0.50
        scored.append((c, round(max(s, 0.0), 2)))
    if not scored:
        return (None, 0.0)
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="smoke-test on first N rows")
    ap.add_argument("--sleep", type=float, default=1.0, help="seconds between requests (default 1.0)")
    ap.add_argument("--out", type=Path, default=OUT_CSV, help="output CSV path")
    args = ap.parse_args()

    env = load_env()
    print(f"→ fetching nonce from {LOOKUP_PAGE}", file=sys.stderr)
    nonce = fetch_nonce()
    print(f"✓ nonce = {nonce}", file=sys.stderr)

    # Pull corrupted projects. PostgREST wants `esid=like.*E+*` but + is a space,
    # so route through a postgrest-friendly pattern — `esid=like.*E%2B*`
    # Simpler: fetch all projects that have any esid and filter in-process.
    rows = pg_select(
        env,
        "projects?select=id,name,address,city,utility,esid&esid=not.is.null&order=id",
    )
    corrupted = [r for r in rows if r.get("esid") and re.match(r"^-?\d+(\.\d+)?[eE][+-]?\d+$", str(r["esid"]).strip())]
    print(f"✓ {len(corrupted)} corrupted esid rows", file=sys.stderr)

    # Partition off-ERCOT utilities (Entergy etc.) — ElectricityPlans only
    # indexes ERCOT meters, so a lookup is guaranteed to miss. Skip without
    # burning a request.
    off_ercot = [r for r in corrupted if is_off_ercot(r.get("utility") or "")]
    corrupted = [r for r in corrupted if not is_off_ercot(r.get("utility") or "")]
    if off_ercot:
        print(f"✓ {len(off_ercot)} off-ERCOT rows skipped (no lookup)", file=sys.stderr)
    if args.limit:
        corrupted = corrupted[: args.limit]

    n_found = n_missing = n_low_conf = n_off_ercot = 0
    with args.out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["project_id", "name", "db_address", "db_city", "utility",
                    "current_esid", "proposed_esid", "matched_address",
                    "matched_tdu", "matched_status", "confidence", "notes"])
        for r in off_ercot:
            w.writerow([
                r["id"], r.get("name", ""), (r.get("address") or "").strip(),
                (r.get("city") or "").strip(), r.get("utility", ""),
                r.get("esid", ""), "", "", "", "", 0,
                "off-ERCOT utility — no lookup performed",
            ])
            n_off_ercot += 1
        for i, r in enumerate(corrupted, 1):
            addr = (r.get("address") or "").strip()
            city = (r.get("city") or "").strip()
            if not addr:
                w.writerow([r["id"], r.get("name", ""), "", city,
                            r.get("utility", ""), r.get("esid", ""), "", "",
                            "", "", 0, "no address in DB"])
                n_missing += 1
                continue
            query_addr = f"{addr} {city}".strip()
            try:
                results = lookup(nonce, query_addr)
            except Exception as e:  # noqa: BLE001
                w.writerow([r["id"], r.get("name", ""), addr, city,
                            r.get("utility", ""), r.get("esid", ""), "", "",
                            "", "", 0, f"lookup error: {e}"])
                n_missing += 1
                time.sleep(args.sleep)
                continue
            best, conf = pick_best(addr, results, r.get("utility") or "")
            if best is None or conf == 0.0:
                note = "no match (off-ERCOT territory?)" if not results else f"no street-number match; top candidate={results[0].get('address','')!r}"
                w.writerow([r["id"], r.get("name", ""), addr, city,
                            r.get("utility", ""), r.get("esid", ""), "", "",
                            "", "", 0, note])
                n_missing += 1
            else:
                if conf < 0.9:
                    n_low_conf += 1
                db_tdu = normalize_tdu(r.get("utility") or "")
                cand_tdu = normalize_tdu(best.get("tdu") or "")
                tdu_mismatch = bool(db_tdu and cand_tdu and db_tdu != cand_tdu)
                if tdu_mismatch:
                    note = f"tdu mismatch (db={db_tdu} vs match={cand_tdu})"
                elif conf >= 0.97:
                    note = ""
                elif conf >= 0.85:
                    note = "street-name variant"
                else:
                    note = "partial word overlap"
                w.writerow([
                    r["id"], r.get("name", ""), addr, city,
                    r.get("utility", ""), r.get("esid", ""),
                    best.get("esi_id", ""), best.get("address_full", ""),
                    best.get("tdu", ""), best.get("status", ""), conf,
                    note,
                ])
                n_found += 1
            if i % 25 == 0:
                print(f"  … {i}/{len(corrupted)} (found {n_found}, missing {n_missing}, low-conf {n_low_conf})", file=sys.stderr)
            time.sleep(args.sleep)
    print(f"\n✓ wrote {args.out}", file=sys.stderr)
    print(f"   found     : {n_found}", file=sys.stderr)
    print(f"   low-conf  : {n_low_conf}  (<0.90 — flag for manual review)", file=sys.stderr)
    print(f"   missing   : {n_missing}", file=sys.stderr)
    print(f"   off-ercot : {n_off_ercot}  (skipped lookup — utility is non-ERCOT)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
