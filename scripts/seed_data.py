"""
Seed script: Loads FCC TV station data and DMA-county mappings into Supabase.

Data sources:
- DMA-County mapping: github.com/alex-patton/US-TVDMA-BY-COUNTY
- FCC TV stations: FCC TV Query pipe-delimited export

Usage: python scripts/seed_data.py
Requires: SUPABASE_URL and SUPABASE_KEY env vars (or uses defaults below)
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request
import urllib.parse
import ssl

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://paiskiyabhmmlckefqoh.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaXNraXlhYmhtbWxja2VmcW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODgxNjUsImV4cCI6MjA5MDE2NDE2NX0.A0okdTRujyb-U_GiKQ-tTKGP5MYGPz3u61lxhWRvTeA")

# State abbreviation to FIPS mapping
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "DC": "11", "FL": "12", "GA": "13", "HI": "15",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21",
    "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27",
    "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
    "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "PR": "72", "RI": "44", "SC": "45",
    "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51",
    "VI": "78", "WA": "53", "WV": "54", "WI": "55", "WY": "56",
}

# SSL context for corporate environments
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def fetch_url(url):
    """Fetch URL content as string."""
    print(f"  Fetching: {url[:80]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "CensusExplorer/1.0"})
    with urllib.request.urlopen(req, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def supabase_insert(table, rows, batch_size=500):
    """Insert rows into Supabase table via REST API."""
    total = len(rows)
    inserted = 0
    for i in range(0, total, batch_size):
        batch = rows[i:i + batch_size]
        data = json.dumps(batch).encode("utf-8")
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        req = urllib.request.Request(url, data=data, method="POST", headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        })
        try:
            urllib.request.urlopen(req, context=ctx)
            inserted += len(batch)
            print(f"  Inserted {inserted}/{total} rows into {table}")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  ERROR inserting into {table}: {e.code} - {body[:200]}")
            # Try individual inserts on batch failure
            for row in batch:
                try:
                    data2 = json.dumps([row]).encode("utf-8")
                    req2 = urllib.request.Request(url, data=data2, method="POST", headers={
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    })
                    urllib.request.urlopen(req2, context=ctx)
                    inserted += 1
                except Exception:
                    pass
            print(f"  Recovered: {inserted}/{total} rows into {table}")
    return inserted


def seed_dma_counties():
    """Load DMA-to-county mapping from GitHub."""
    print("\n=== Seeding DMA-County Mapping ===")
    url = "https://raw.githubusercontent.com/alex-patton/US-TVDMA-BY-COUNTY/master/usa-tvdma-county.csv"
    raw = fetch_url(url)
    reader = csv.DictReader(io.StringIO(raw))

    rows = []
    for r in reader:
        state_abbr = r.get("STATE_AB", "").strip()
        rows.append({
            "state": r.get("STATE", "").strip(),
            "state_abbr": state_abbr,
            "county": r.get("COUNTY", "").strip(),
            "state_fips": STATE_FIPS.get(state_abbr, ""),
            "dma_name": r.get("TVDMA", "").strip(),
            "msa": r.get("Metropolitan_Statistical_Areas", "").strip(),
        })

    print(f"  Parsed {len(rows)} DMA-county records")
    return supabase_insert("dma_counties", rows)


def seed_tv_stations():
    """Load TV station data from FCC TV Query."""
    print("\n=== Seeding FCC TV Stations ===")

    # FCC TV Query - get all licensed full-power and low-power TV stations
    # The TV Query can return pipe-delimited text via specific URL params
    # We'll use the public facility search data instead - query state by state
    all_stations = []

    for state_abbr, state_fips in sorted(STATE_FIPS.items()):
        if state_abbr in ("PR", "VI", "DC"):
            continue  # Skip territories for now

        try:
            # FCC TV Query pipe-delimited output
            url = (
                f"https://transition.fcc.gov/cgi-bin/tvq?"
                f"state={state_abbr}&call=&chan=0&ession=&type=0&facid=&list=4"
            )
            raw = fetch_url(url)
            stations = parse_fcc_tv_output(raw, state_abbr, state_fips)
            all_stations.extend(stations)
            print(f"  {state_abbr}: {len(stations)} stations")
        except Exception as e:
            print(f"  {state_abbr}: ERROR - {e}")

    print(f"\n  Total stations parsed: {len(all_stations)}")
    if all_stations:
        return supabase_insert("tv_stations", all_stations)
    return 0


def parse_fcc_tv_output(raw_text, state_abbr, state_fips):
    """Parse FCC TV Query pipe-delimited output."""
    stations = []
    lines = raw_text.strip().split("\n")

    for line in lines:
        # Pipe-delimited format: fields separated by |
        if "|" not in line:
            continue
        fields = [f.strip() for f in line.split("|")]
        if len(fields) < 10:
            continue

        # Skip header-like lines
        if fields[0].startswith("Call") or fields[0].startswith("-"):
            continue

        callsign = fields[0].strip() if fields[0] else ""
        if not callsign or not re.match(r'^[KW][A-Z]{2,}', callsign):
            continue

        # Parse channel number
        chan_str = fields[1].strip() if len(fields) > 1 else ""
        channel = None
        try:
            channel = int(re.search(r'\d+', chan_str).group()) if chan_str else None
        except (AttributeError, ValueError):
            pass

        # Parse service type
        service = fields[2].strip() if len(fields) > 2 else ""

        # City, State
        city = fields[3].strip() if len(fields) > 3 else ""
        st = fields[4].strip() if len(fields) > 4 else state_abbr

        # Status
        status = fields[5].strip() if len(fields) > 5 else ""

        # Facility ID
        fac_id = ""
        for f in fields:
            m = re.search(r'\b\d{4,6}\b', f)
            if m:
                fac_id = m.group()
                break

        # Network affiliation (may be in later fields)
        network = ""
        for f in fields[6:]:
            f_clean = f.strip().upper()
            if f_clean in ("ABC", "CBS", "NBC", "FOX", "PBS", "CW", "MNT", "ION",
                           "UNI", "TEL", "IND", "MY", "ZUMO", "TBN", "DAYSTAR"):
                network = f_clean
                break

        station = {
            "callsign": callsign,
            "channel": channel,
            "service_type": service if service else None,
            "city": city if city else None,
            "state": st if st else state_abbr,
            "state_fips": state_fips,
            "status": status if status else None,
            "facility_id": fac_id if fac_id else None,
            "network_affiliation": network if network else None,
        }
        stations.append(station)

    return stations


def assign_dma_to_stations():
    """Update TV stations with their DMA based on city/state matching."""
    print("\n=== Assigning DMAs to Stations ===")

    # This is done via SQL since both tables are in Supabase
    sql = """
    UPDATE tv_stations s
    SET dma_name = d.dma_name
    FROM dma_counties d
    WHERE UPPER(s.state) = d.state_abbr
    AND d.dma_name IS NOT NULL
    AND s.dma_name IS NULL
    AND (
        UPPER(s.city) LIKE '%' || UPPER(d.county) || '%'
        OR UPPER(d.county) LIKE '%' || UPPER(s.city) || '%'
    );
    """
    # We can't execute UPDATE via the anon key REST API,
    # but stations will still be queryable and DMA data is in dma_counties
    print("  Note: DMA assignment will be done via the query layer (JOIN)")
    print("  Stations + DMA data are both loaded and can be joined at query time")


if __name__ == "__main__":
    print("Census Explorer - Data Seeder")
    print(f"Supabase: {SUPABASE_URL}")

    n1 = seed_dma_counties()
    print(f"\nDMA-County records inserted: {n1}")

    n2 = seed_tv_stations()
    print(f"\nTV station records inserted: {n2}")

    assign_dma_to_stations()

    print("\n=== Done! ===")
    print(f"Total: {n1} DMA-county mappings, {n2} TV stations")
