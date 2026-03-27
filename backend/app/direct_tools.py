"""
Direct API tools — called via httpx, no MCP needed.
Each tool exposes a schema (for Claude) and a handler (for execution).
"""

import json
import logging
from datetime import datetime
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(30.0)


# ---------------------------------------------------------------------------
# FEMA — Disaster Declarations (no key required)
# ---------------------------------------------------------------------------

FEMA_TOOL = {
    "name": "fema-disaster-declarations",
    "description": (
        "Search FEMA disaster declarations by state, year, or incident type. "
        "Returns disaster numbers, types, dates, and affected areas. "
        "Useful for understanding natural disaster history and risk in a region."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "state": {
                "type": "string",
                "description": "Two-letter state abbreviation, e.g. 'TX', 'CA'",
            },
            "year": {
                "type": "integer",
                "description": "Filter to a specific year (e.g. 2023)",
            },
            "incident_type": {
                "type": "string",
                "description": "Filter by type: Fire, Flood, Hurricane, Tornado, Severe Storm, Earthquake, etc.",
            },
            "limit": {
                "type": "integer",
                "description": "Max records to return (default 25, max 100)",
            },
        },
        "required": [],
    },
}


async def handle_fema(args: dict) -> str:
    filters = []
    if args.get("state"):
        filters.append(f"state eq '{args['state'].upper()}'")
    if args.get("year"):
        y = args["year"]
        filters.append(f"declarationDate ge '{y}-01-01T00:00:00.000z'")
        filters.append(f"declarationDate lt '{y + 1}-01-01T00:00:00.000z'")
    if args.get("incident_type"):
        filters.append(f"incidentType eq '{args['incident_type']}'")

    limit = min(args.get("limit", 25), 100)
    params: dict[str, Any] = {
        "$top": limit,
        "$orderby": "declarationDate desc",
        "$select": "disasterNumber,state,declarationType,declarationDate,incidentType,declarationTitle,designatedArea",
    }
    if filters:
        params["$filter"] = " and ".join(filters)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    records = data.get("DisasterDeclarationsSummaries", [])
    return json.dumps({"count": len(records), "declarations": records}, default=str)


# ---------------------------------------------------------------------------
# BLS — Bureau of Labor Statistics (key required but free)
# ---------------------------------------------------------------------------

BLS_TOOL = {
    "name": "bls-series-data",
    "description": (
        "Fetch time-series data from the Bureau of Labor Statistics. "
        "Provide one or more series IDs to get employment, unemployment, CPI, or wage data. "
        "Common series: LAUCN (local area unemployment), CES (employment), CUUR (CPI). "
        "Example series IDs: 'LAUST480000000000003' (TX unemployment rate), "
        "'CUUR0000SA0' (national CPI-U). "
        "Use start_year/end_year to set the date range."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "series_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "One or more BLS series IDs",
            },
            "start_year": {
                "type": "integer",
                "description": "Start year (default: 3 years ago)",
            },
            "end_year": {
                "type": "integer",
                "description": "End year (default: current year)",
            },
        },
        "required": ["series_ids"],
    },
}


async def handle_bls(args: dict) -> str:
    now = datetime.now().year
    payload = {
        "seriesid": args["series_ids"],
        "startyear": str(args.get("start_year", now - 3)),
        "endyear": str(args.get("end_year", now)),
        "registrationkey": settings.bls_api_key,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.bls.gov/publicAPI/v2/timeseries/data/",
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    if data.get("status") != "REQUEST_SUCCEEDED":
        return json.dumps({"error": data.get("message", ["Unknown error"])})

    series = data.get("Results", {}).get("series", [])
    return json.dumps({"series_count": len(series), "series": series}, default=str)


# ---------------------------------------------------------------------------
# FRED — Federal Reserve Economic Data (key required but free)
# ---------------------------------------------------------------------------

FRED_SEARCH_TOOL = {
    "name": "fred-search-series",
    "description": (
        "Search FRED for economic data series by keyword. "
        "Returns series IDs, titles, and descriptions you can then fetch with fred-series-observations. "
        "Example searches: 'median household income', 'unemployment rate', 'housing starts', 'GDP'."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search keywords",
            },
            "limit": {
                "type": "integer",
                "description": "Max results (default 10)",
            },
        },
        "required": ["query"],
    },
}

FRED_DATA_TOOL = {
    "name": "fred-series-observations",
    "description": (
        "Fetch time-series observations for a FRED series ID. "
        "Returns date/value pairs. "
        "Example series: 'UNRATE' (unemployment), 'MEHOINUSA672N' (median income), "
        "'HOUST' (housing starts), 'CPIAUCSL' (CPI)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "series_id": {
                "type": "string",
                "description": "FRED series ID (e.g. 'UNRATE')",
            },
            "start_date": {
                "type": "string",
                "description": "Start date YYYY-MM-DD (default: 5 years ago)",
            },
            "end_date": {
                "type": "string",
                "description": "End date YYYY-MM-DD (default: today)",
            },
            "frequency": {
                "type": "string",
                "description": "Aggregation: 'm' monthly, 'q' quarterly, 'a' annual",
            },
        },
        "required": ["series_id"],
    },
}


async def handle_fred_search(args: dict) -> str:
    params: dict[str, Any] = {
        "api_key": settings.fred_api_key,
        "file_type": "json",
        "search_text": args["query"],
        "limit": min(args.get("limit", 10), 25),
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://api.stlouisfed.org/fred/series/search",
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    series = [
        {
            "id": s["id"],
            "title": s["title"],
            "frequency": s.get("frequency_short", ""),
            "units": s.get("units_short", ""),
            "seasonal_adjustment": s.get("seasonal_adjustment_short", ""),
            "last_updated": s.get("last_updated", ""),
        }
        for s in data.get("seriess", [])
    ]
    return json.dumps({"count": len(series), "series": series}, default=str)


async def handle_fred_data(args: dict) -> str:
    now = datetime.now()
    params: dict[str, Any] = {
        "api_key": settings.fred_api_key,
        "file_type": "json",
        "series_id": args["series_id"],
        "observation_start": args.get("start_date", f"{now.year - 5}-01-01"),
        "observation_end": args.get("end_date", now.strftime("%Y-%m-%d")),
    }
    if args.get("frequency"):
        params["frequency"] = args["frequency"]

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    observations = data.get("observations", [])
    return json.dumps({
        "series_id": args["series_id"],
        "count": len(observations),
        "observations": observations,
    }, default=str)


# ---------------------------------------------------------------------------
# Census Bureau ACS — direct REST API (key optional but recommended)
# ---------------------------------------------------------------------------

# Common variable bundles for quick demographic profiles
CENSUS_VARIABLE_PRESETS = {
    "demographics": "B01003_001E,B01002_001E,B19013_001E,B25001_001E",
    "income": "B19013_001E,B19001_002E,B19001_003E,B19001_004E,B19001_005E",
    "employment": "B23025_001E,B23025_002E,B23025_004E,B23025_005E,B23025_007E",
    "education": "B15003_001E,B15003_017E,B15003_022E,B15003_023E,B15003_025E",
    "housing": "B25001_001E,B25002_002E,B25002_003E,B25077_001E,B25003_002E,B25003_003E",
}

CENSUS_VARIABLE_LABELS = {
    "B01003_001E": "Total Population",
    "B01002_001E": "Median Age",
    "B19013_001E": "Median Household Income",
    "B25001_001E": "Total Housing Units",
    "B25002_002E": "Occupied Housing Units",
    "B25002_003E": "Vacant Housing Units",
    "B25077_001E": "Median Home Value",
    "B25003_002E": "Owner-Occupied Units",
    "B25003_003E": "Renter-Occupied Units",
    "B23025_001E": "Population 16+",
    "B23025_002E": "In Labor Force",
    "B23025_004E": "Employed",
    "B23025_005E": "Unemployed",
    "B23025_007E": "Not in Labor Force",
    "B15003_001E": "Population 25+",
    "B15003_017E": "High School Diploma",
    "B15003_022E": "Bachelor's Degree",
    "B15003_023E": "Master's Degree",
    "B15003_025E": "Doctorate Degree",
    "B19001_002E": "Income Under $10k",
    "B19001_003E": "Income $10k-$14,999",
    "B19001_004E": "Income $15k-$19,999",
    "B19001_005E": "Income $20k-$24,999",
}

CENSUS_PROFILE_TOOL = {
    "name": "census-demographic-profile",
    "description": (
        "Get a demographic profile for any U.S. state, county, or city from the Census Bureau ACS 5-year estimates. "
        "Returns population, median age, median household income, and housing data. "
        "For a city, provide the state FIPS (e.g. '48' for Texas) and place FIPS (e.g. '05000' for Austin). "
        "For a state, just provide state FIPS. For a county, provide state + county FIPS. "
        "Use census-geography-search to find FIPS codes by name."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "variables": {
                "type": "string",
                "description": (
                    "Comma-separated Census variable codes, OR a preset name: "
                    "'demographics', 'income', 'employment', 'education', 'housing'. "
                    "Default: 'demographics'"
                ),
            },
            "geo_level": {
                "type": "string",
                "enum": ["state", "county", "place", "metropolitan statistical area/micropolitan statistical area"],
                "description": "Geography level to query",
            },
            "geo_code": {
                "type": "string",
                "description": "FIPS code for the geography. Use '*' for all at that level.",
            },
            "state_fips": {
                "type": "string",
                "description": "2-digit state FIPS code (required for county and place queries). E.g. '48' for Texas, '06' for California.",
            },
            "year": {
                "type": "integer",
                "description": "ACS year (default: 2023). Available: 2009-2023.",
            },
        },
        "required": ["geo_level", "geo_code"],
    },
}

CENSUS_SEARCH_TOOL = {
    "name": "census-geography-search",
    "description": (
        "Search for Census FIPS codes by name. Returns matching places, counties, or states with their FIPS codes. "
        "Use this to find the FIPS code for a city or county before querying census-demographic-profile. "
        "Example: search 'Austin' in state '48' (Texas) to find Austin city's place FIPS code."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Place or county name to search for (e.g. 'Austin', 'Travis County')",
            },
            "state_fips": {
                "type": "string",
                "description": "2-digit state FIPS to search within (e.g. '48' for Texas)",
            },
            "geo_level": {
                "type": "string",
                "enum": ["place", "county"],
                "description": "Search for places (cities) or counties. Default: 'place'.",
            },
        },
        "required": ["name", "state_fips"],
    },
}

# Common state abbreviation → FIPS mapping and reverse
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "FL": "12", "GA": "13", "HI": "15", "ID": "16",
    "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22",
    "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
    "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
    "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40",
    "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47",
    "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
    "WI": "55", "WY": "56", "DC": "11", "PR": "72",
}
FIPS_TO_STATE = {v: k for k, v in STATE_FIPS.items()}


async def handle_census_profile(args: dict) -> str:
    variables_input = args.get("variables", "demographics")
    # Resolve preset names
    variables = CENSUS_VARIABLE_PRESETS.get(variables_input, variables_input)
    year = args.get("year", 2023)
    geo_level = args["geo_level"]
    geo_code = args["geo_code"]
    state_fips = args.get("state_fips", "")

    get_param = f"NAME,{variables}"

    params: dict[str, Any] = {
        "get": get_param,
        "key": settings.census_api_key,
    }

    # Build geography parameters
    if geo_level == "state":
        params["for"] = f"state:{geo_code}"
    elif geo_level == "county":
        params["for"] = f"county:{geo_code}"
        if state_fips:
            params["in"] = f"state:{state_fips}"
    elif geo_level == "place":
        params["for"] = f"place:{geo_code}"
        if state_fips:
            params["in"] = f"state:{state_fips}"
    elif "metropolitan" in geo_level:
        params["for"] = f"metropolitan statistical area/micropolitan statistical area:{geo_code}"

    url = f"https://api.census.gov/data/{year}/acs/acs5"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()

    if not data or len(data) < 2:
        return json.dumps({"error": "No data returned", "url": str(r.url)})

    # Convert array-of-arrays to list of dicts with labels
    headers = data[0]
    results = []
    for row in data[1:]:
        record: dict[str, Any] = {}
        for i, col in enumerate(headers):
            val = row[i]
            label = CENSUS_VARIABLE_LABELS.get(col, col)
            record[label] = val
        results.append(record)

    return json.dumps({
        "year": year,
        "geography_level": geo_level,
        "count": len(results),
        "data": results,
    }, default=str)


async def handle_census_search(args: dict) -> str:
    name_query = args["name"].lower()
    state_fips = args["state_fips"]
    geo_level = args.get("geo_level", "place")

    params: dict[str, Any] = {
        "get": "NAME",
        "for": f"{geo_level}:*",
        "in": f"state:{state_fips}",
        "key": settings.census_api_key,
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://api.census.gov/data/2023/acs/acs5",
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    if not data or len(data) < 2:
        return json.dumps({"error": "No results"})

    headers = data[0]
    matches = []
    for row in data[1:]:
        place_name = row[0]
        if name_query in place_name.lower():
            record = {"name": place_name}
            for i, col in enumerate(headers):
                if col != "NAME":
                    record[col] = row[i]
            matches.append(record)

    return json.dumps({
        "query": args["name"],
        "state_fips": state_fips,
        "count": len(matches),
        "matches": matches[:20],
    }, default=str)


# ---------------------------------------------------------------------------
# Census County Business Patterns — businesses by industry (same Census key)
# ---------------------------------------------------------------------------

# Common NAICS codes for advertiser verticals
NAICS_PRESETS = {
    "restaurants": ("722511", "Full-service restaurants"),
    "fast_food": ("722513", "Limited-service restaurants"),
    "auto_dealers": ("44111", "New car dealers"),
    "used_cars": ("44112", "Used car dealers"),
    "home_improvement": ("44411", "Home centers"),
    "grocery": ("44511", "Grocery stores (except convenience)"),
    "hospitals": ("622", "Hospitals"),
    "doctors": ("6211", "Offices of physicians"),
    "dentists": ("6212", "Offices of dentists"),
    "insurance": ("5242", "Insurance agencies and brokerages"),
    "real_estate": ("531", "Real estate"),
    "legal": ("5411", "Legal services"),
    "fitness": ("71394", "Fitness and recreational sports centers"),
    "hotels": ("7211", "Hotels and motels"),
    "banks": ("5221", "Commercial banking"),
    "pharmacies": ("44611", "Pharmacies and drug stores"),
}

CBP_TOOL = {
    "name": "census-business-patterns",
    "description": (
        "Get the number of business establishments and employees by industry for any state or county. "
        "Uses Census County Business Patterns data. Great for sizing advertiser categories in a market. "
        "Provide a NAICS industry code or a preset name. "
        "Presets: 'restaurants', 'fast_food', 'auto_dealers', 'used_cars', 'home_improvement', "
        "'grocery', 'hospitals', 'doctors', 'insurance', 'real_estate', 'legal', 'fitness', "
        "'hotels', 'banks', 'pharmacies'. "
        "Returns establishment count, employee count, and annual payroll."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "naics": {
                "type": "string",
                "description": (
                    "NAICS industry code OR preset name (e.g. 'restaurants', 'auto_dealers', '722511'). "
                    "Use preset names for common advertiser categories."
                ),
            },
            "geo_level": {
                "type": "string",
                "enum": ["state", "county"],
                "description": "Geography level. Default: 'state'.",
            },
            "geo_code": {
                "type": "string",
                "description": "FIPS code. Use '*' for all states/counties. E.g. '48' for Texas.",
            },
            "state_fips": {
                "type": "string",
                "description": "2-digit state FIPS (required for county queries).",
            },
        },
        "required": ["naics", "geo_level", "geo_code"],
    },
}


async def handle_cbp(args: dict) -> str:
    naics_input = args["naics"]
    # Resolve preset
    if naics_input in NAICS_PRESETS:
        naics_code, naics_label = NAICS_PRESETS[naics_input]
    else:
        naics_code = naics_input
        naics_label = naics_input

    geo_level = args.get("geo_level", "state")
    geo_code = args["geo_code"]
    state_fips = args.get("state_fips", "")

    params: dict[str, Any] = {
        "get": "NAICS2017_LABEL,ESTAB,EMP,PAYANN",
        "NAICS2017": naics_code,
        "key": settings.census_api_key,
    }

    if geo_level == "state":
        params["for"] = f"state:{geo_code}"
    elif geo_level == "county":
        params["for"] = f"county:{geo_code}"
        if state_fips:
            params["in"] = f"state:{state_fips}"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get("https://api.census.gov/data/2022/cbp", params=params)
        r.raise_for_status()
        data = r.json()

    if not data or len(data) < 2:
        return json.dumps({"error": "No data returned"})

    headers = data[0]
    results = []
    for row in data[1:]:
        record = {}
        for i, col in enumerate(headers):
            if col == "ESTAB":
                record["establishments"] = int(row[i]) if row[i] else 0
            elif col == "EMP":
                record["employees"] = int(row[i]) if row[i] else 0
            elif col == "PAYANN":
                record["annual_payroll_thousands"] = int(row[i]) if row[i] else 0
            elif col == "NAICS2017_LABEL":
                record["industry"] = row[i]
            elif col == "state":
                record["state_fips"] = row[i]
            elif col == "county":
                record["county_fips"] = row[i]
        results.append(record)

    return json.dumps({
        "naics_code": naics_code,
        "industry_preset": naics_label,
        "count": len(results),
        "data": results,
    }, default=str)


# ---------------------------------------------------------------------------
# CDC PLACES — health data by county (no key needed)
# ---------------------------------------------------------------------------

CDC_MEASURES = {
    "obesity": "OBESITY",
    "diabetes": "DIABETES",
    "smoking": "CSMOKING",
    "heart_disease": "CHD",
    "high_blood_pressure": "BPHIGH",
    "depression": "DEPRESSION",
    "asthma": "CASTHMA",
    "no_insurance": "ACCESS2",
    "no_checkup": "CHECKUP",
    "physical_inactivity": "LPA",
    "binge_drinking": "BINGE",
    "sleep_less_7hr": "SLEEP",
}

CDC_TOOL = {
    "name": "cdc-health-data",
    "description": (
        "Get county-level health statistics from CDC PLACES. "
        "Returns prevalence rates for health measures like obesity, diabetes, smoking, etc. "
        "Useful for pharma, healthcare, insurance, and wellness advertisers. "
        "Measures: 'obesity', 'diabetes', 'smoking', 'heart_disease', 'high_blood_pressure', "
        "'depression', 'asthma', 'no_insurance', 'physical_inactivity', 'binge_drinking', 'sleep_less_7hr'. "
        "Query by state abbreviation (e.g. 'OH') to get all counties in that state."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "state": {
                "type": "string",
                "description": "2-letter state abbreviation (e.g. 'OH', 'TX', 'FL')",
            },
            "measure": {
                "type": "string",
                "description": "Health measure preset name (e.g. 'obesity', 'diabetes'). Default: 'obesity'.",
            },
            "limit": {
                "type": "integer",
                "description": "Max counties to return (default 20, max 100). Results sorted by value descending.",
            },
        },
        "required": ["state"],
    },
}


async def handle_cdc(args: dict) -> str:
    state = args["state"].upper()
    measure_input = args.get("measure", "obesity")
    measure_id = CDC_MEASURES.get(measure_input, measure_input.upper())
    limit = min(args.get("limit", 20), 100)

    params: dict[str, Any] = {
        "$where": f"stateabbr='{state}' AND measureid='{measure_id}'",
        "$order": "data_value DESC",
        "$limit": limit,
        "$select": "locationname,statedesc,measure,data_value,data_value_unit,low_confidence_limit,high_confidence_limit,year",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://data.cdc.gov/resource/swc5-untb.json",
            params=params,
        )
        r.raise_for_status()
        data = r.json()

    results = []
    for row in data:
        results.append({
            "county": row.get("locationname", ""),
            "state": row.get("statedesc", ""),
            "measure": row.get("measure", ""),
            "value": row.get("data_value", ""),
            "unit": row.get("data_value_unit", ""),
            "year": row.get("year", ""),
        })

    return json.dumps({
        "state": state,
        "measure": measure_input,
        "measure_id": measure_id,
        "count": len(results),
        "data": results,
    }, default=str)


# ---------------------------------------------------------------------------
# BEA — Bureau of Economic Analysis (GDP, personal income by region)
# ---------------------------------------------------------------------------

BEA_GDP_TOOL = {
    "name": "bea-gdp-by-area",
    "description": (
        "Get GDP (Gross Domestic Product) data by state or metro area from the Bureau of Economic Analysis. "
        "Returns GDP, GDP growth, per-capita GDP, and industry breakdowns. "
        "Use LineCode 1 for All Industries GDP, 3 for Per Capita Real GDP. "
        "GeoFips: 'STATE' for all states, or specific FIPS like '48000' (Texas), 'MSA' for all metros."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "enum": ["SAGDP1", "SAGDP2N", "SAGDP9N", "CAGDP1", "CAGDP2N"],
                "description": (
                    "BEA table: SAGDP1 = State GDP summary, SAGDP2N = State GDP by industry, "
                    "SAGDP9N = State real GDP, CAGDP1 = County/MSA GDP summary, CAGDP2N = County/MSA GDP by industry"
                ),
            },
            "geo_fips": {
                "type": "string",
                "description": (
                    "Geography: 'STATE' for all states, '48000' for Texas, '00000' for US total, "
                    "'MSA' for all metros, or specific county/MSA FIPS."
                ),
            },
            "line_code": {
                "type": "integer",
                "description": "Data line: 1 = All Industries GDP, 2 = Private Industries, 3 = Per Capita Real GDP. Default: 1.",
            },
            "year": {
                "type": "string",
                "description": "Year(s): single year '2023', range '2020,2021,2022,2023', or 'LAST5'. Default: 'LAST5'.",
            },
        },
        "required": ["table_name", "geo_fips"],
    },
}

BEA_INCOME_TOOL = {
    "name": "bea-personal-income",
    "description": (
        "Get personal income data by state or county from the Bureau of Economic Analysis. "
        "Includes total personal income, per capita income, and income components. "
        "Use LineCode 1 for total personal income, 3 for per capita personal income."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "enum": ["SAINC1", "SAINC4", "CAINC1", "CAINC4"],
                "description": (
                    "BEA table: SAINC1 = State personal income summary, SAINC4 = State income by component, "
                    "CAINC1 = County income summary, CAINC4 = County income by component"
                ),
            },
            "geo_fips": {
                "type": "string",
                "description": "Geography: 'STATE' for all states, '48000' for Texas, specific county FIPS.",
            },
            "line_code": {
                "type": "integer",
                "description": "Data line: 1 = Total personal income, 3 = Per capita personal income. Default: 3.",
            },
            "year": {
                "type": "string",
                "description": "Year(s): '2023', '2020,2021,2022,2023', or 'LAST5'. Default: 'LAST5'.",
            },
        },
        "required": ["table_name", "geo_fips"],
    },
}


async def handle_bea_regional(args: dict) -> str:
    table = args["table_name"]
    geo = args["geo_fips"]
    line = args.get("line_code", 1)
    year = args.get("year", "LAST5")

    params: dict[str, Any] = {
        "UserID": settings.bea_api_key,
        "method": "GetData",
        "datasetname": "Regional",
        "TableName": table,
        "GeoFips": geo,
        "LineCode": line,
        "Year": year,
        "ResultFormat": "JSON",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get("https://apps.bea.gov/api/data/", params=params)
        r.raise_for_status()
        data = r.json()

    results = data.get("BEAAPI", {}).get("Results", {})
    if "Error" in results:
        return json.dumps({"error": results["Error"]})

    rows = results.get("Data", [])
    return json.dumps({
        "table": table,
        "geo_fips": geo,
        "count": len(rows),
        "data": rows[:100],  # Cap at 100 rows for context
    }, default=str)


async def handle_bea_gdp(args: dict) -> str:
    return await handle_bea_regional(args)


async def handle_bea_income(args: dict) -> str:
    args.setdefault("line_code", 3)  # Default to per capita
    return await handle_bea_regional(args)


# ---------------------------------------------------------------------------
# Google Trends — search interest over time and by region (no key needed)
# ---------------------------------------------------------------------------

GTRENDS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

GTRENDS_INTEREST_TOOL = {
    "name": "google-trends-interest",
    "description": (
        "Get Google search interest over time for one or more keywords in the US. "
        "Returns a 0-100 index showing relative search popularity. "
        "Great for understanding consumer demand, seasonal patterns, and brand awareness. "
        "Compare up to 5 keywords side by side. "
        "Timeframes: 'today 1-m' (1 month), 'today 3-m' (3 months), 'today 12-m' (1 year), 'today 5-y' (5 years)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "description": "One to five search terms to compare (e.g. ['home depot', 'lowes'])",
                "maxItems": 5,
            },
            "timeframe": {
                "type": "string",
                "description": "Time range: 'today 1-m', 'today 3-m', 'today 12-m', 'today 5-y'. Default: 'today 12-m'.",
            },
        },
        "required": ["keywords"],
    },
}

GTRENDS_GEO_TOOL = {
    "name": "google-trends-by-region",
    "description": (
        "Get Google search interest by US state or metro (DMA) for one or more keywords. "
        "Shows which states or metros have the highest search interest. "
        "Useful for finding where consumer demand is strongest for a product or brand. "
        "Set resolution to 'REGION' for states or 'DMA' for metro areas."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "keywords": {
                "type": "array",
                "items": {"type": "string"},
                "description": "One to five search terms (e.g. ['car insurance'])",
                "maxItems": 5,
            },
            "resolution": {
                "type": "string",
                "enum": ["REGION", "DMA"],
                "description": "Geographic granularity: 'REGION' for states, 'DMA' for metro areas. Default: 'REGION'.",
            },
            "timeframe": {
                "type": "string",
                "description": "Time range: 'today 1-m', 'today 3-m', 'today 12-m', 'today 5-y'. Default: 'today 12-m'.",
            },
        },
        "required": ["keywords"],
    },
}


def _build_trends_payload(keywords: list[str], timeframe: str) -> dict:
    return {
        "comparisonItem": [
            {"keyword": kw, "geo": "US", "time": timeframe}
            for kw in keywords
        ],
        "category": 0,
        "property": "",
    }


async def _get_trends_widgets(keywords: list[str], timeframe: str) -> tuple[list[dict], httpx.AsyncClient]:
    """Get widget tokens from Google Trends. Returns (widgets, client) — caller must close client."""
    client = httpx.AsyncClient(
        headers=GTRENDS_HEADERS, timeout=TIMEOUT, follow_redirects=True,
    )
    # Warm up cookies
    await client.get("https://trends.google.com/trends/explore?q=test&geo=US")

    payload = _build_trends_payload(keywords, timeframe)
    r = await client.get(
        "https://trends.google.com/trends/api/explore",
        params={"hl": "en-US", "tz": 360, "req": json.dumps(payload)},
    )
    text = r.text
    if "\n" in text:
        text = text[text.index("\n") + 1:]
    widgets = json.loads(text).get("widgets", [])
    return widgets, client


async def handle_gtrends_interest(args: dict) -> str:
    keywords = args["keywords"][:5]
    timeframe = args.get("timeframe", "today 12-m")

    widgets, client = await _get_trends_widgets(keywords, timeframe)
    try:
        ts_widget = next((w for w in widgets if w["id"] == "TIMESERIES"), None)
        if not ts_widget:
            return json.dumps({"error": "Could not get trends data. Try again shortly."})

        r = await client.get(
            "https://trends.google.com/trends/api/widgetdata/multiline",
            params={
                "hl": "en-US", "tz": 360,
                "req": json.dumps(ts_widget["request"]),
                "token": ts_widget["token"],
            },
        )
        text = r.text
        if "\n" in text:
            text = text[text.index("\n") + 1:]
        data = json.loads(text)
    finally:
        await client.aclose()

    timeline = data.get("default", {}).get("timelineData", [])
    results = []
    for point in timeline:
        entry: dict[str, Any] = {"date": point.get("formattedTime", "")}
        for i, kw in enumerate(keywords):
            entry[kw] = point["value"][i] if i < len(point.get("value", [])) else 0
        results.append(entry)

    return json.dumps({
        "keywords": keywords,
        "timeframe": timeframe,
        "data_points": len(results),
        "data": results,
    }, default=str)


async def handle_gtrends_geo(args: dict) -> str:
    keywords = args["keywords"][:5]
    timeframe = args.get("timeframe", "today 12-m")
    resolution = args.get("resolution", "REGION")

    widgets, client = await _get_trends_widgets(keywords, timeframe)
    try:
        geo_widget = next((w for w in widgets if w["id"] == "GEO_MAP"), None)
        if not geo_widget:
            return json.dumps({"error": "Could not get geo data. Try again shortly."})

        # Override resolution in the widget request
        req = geo_widget["request"]
        req["resolution"] = resolution

        r = await client.get(
            "https://trends.google.com/trends/api/widgetdata/comparedgeo",
            params={
                "hl": "en-US", "tz": 360,
                "req": json.dumps(req),
                "token": geo_widget["token"],
            },
        )
        text = r.text
        if "\n" in text:
            text = text[text.index("\n") + 1:]
        data = json.loads(text)
    finally:
        await client.aclose()

    regions = data.get("default", {}).get("geoMapData", [])
    results = []
    for region in regions:
        entry: dict[str, Any] = {"region": region.get("geoName", "")}
        for i, kw in enumerate(keywords):
            entry[kw] = region["value"][i] if i < len(region.get("value", [])) else 0
        results.append(entry)

    return json.dumps({
        "keywords": keywords,
        "resolution": resolution,
        "timeframe": timeframe,
        "regions": len(results),
        "data": results,
    }, default=str)


# ---------------------------------------------------------------------------
# HUD — Fair Market Rents & Income Limits (free key required)
# ---------------------------------------------------------------------------

HUD_FMR_TOOL = {
    "name": "hud-fair-market-rents",
    "description": (
        "Get HUD Fair Market Rents (FMR) by state or county. "
        "FMRs represent the 40th percentile of gross rents for standard quality units. "
        "Used to determine housing affordability and Section 8 voucher amounts. "
        "Provide a 2-letter state abbreviation (e.g. 'TX') for statewide data, "
        "or a 10-digit county code (e.g. '4801399999' for Travis County TX) for county data. "
        "Also accepts 2-digit state FIPS codes which are auto-converted. "
        "Returns rent estimates by bedroom count (0BR through 4BR)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "entity_id": {
                "type": "string",
                "description": (
                    "State abbreviation (e.g. 'TX', 'TN') or state FIPS (e.g. '48') for statewide FMR data, "
                    "or county FIPS code (10 digits) for county-level data."
                ),
            },
            "year": {
                "type": "integer",
                "description": "FMR fiscal year (default: current year). Available from 2017+.",
            },
        },
        "required": ["entity_id"],
    },
}

HUD_IL_TOOL = {
    "name": "hud-income-limits",
    "description": (
        "Get HUD Income Limits by state or county. "
        "Shows Very Low (50% AMI), Low (80% AMI), and Extremely Low income thresholds "
        "by household size (1-8 persons). "
        "Useful for understanding housing affordability and market segmentation. "
        "Provide a 2-letter state abbreviation (e.g. 'TN') or 10-digit county code."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "entity_id": {
                "type": "string",
                "description": "State abbreviation (e.g. 'TX') or state FIPS (e.g. '48'), or county code (10 digits).",
            },
            "year": {
                "type": "integer",
                "description": "Fiscal year (default: current year).",
            },
        },
        "required": ["entity_id"],
    },
}

HUD_FMR_LIST_TOOL = {
    "name": "hud-list-counties",
    "description": (
        "List all counties and their HUD entity codes for a given state. "
        "Use this to find the correct county code before querying hud-fair-market-rents or hud-income-limits. "
        "Provide a 2-letter state abbreviation (e.g. 'TX'). Also accepts FIPS codes."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "state_fips": {
                "type": "string",
                "description": "State abbreviation (e.g. 'TX', 'TN') or 2-digit state FIPS code.",
            },
        },
        "required": ["state_fips"],
    },
}


async def _hud_get(path: str, params: dict | None = None) -> dict:
    """Make an authenticated HUD API request."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            f"https://www.huduser.gov/hudapi/public{path}",
            headers={"Authorization": f"Bearer {settings.hud_api_key}"},
            params=params or {},
        )
        r.raise_for_status()
        return r.json()


def _resolve_hud_state(value: str) -> str:
    """Convert FIPS code to state abbreviation if needed. HUD API requires abbreviations."""
    value = value.strip()
    if len(value) == 2 and value.isdigit():
        return FIPS_TO_STATE.get(value, value)
    return value.upper()


async def handle_hud_fmr(args: dict) -> str:
    entity_id = args["entity_id"]
    year = args.get("year")

    if len(entity_id) <= 2:
        # State-level query — convert FIPS to abbreviation
        state_abbr = _resolve_hud_state(entity_id)
        path = f"/fmr/statedata/{state_abbr}"
    else:
        # County-level query
        path = f"/fmr/data/{entity_id}"

    params = {}
    if year:
        params["year"] = year

    data = await _hud_get(path, params)
    return json.dumps(data, default=str)


async def handle_hud_il(args: dict) -> str:
    entity_id = args["entity_id"]
    year = args.get("year")

    if len(entity_id) <= 2:
        entity_id = _resolve_hud_state(entity_id)
    path = f"/il/data/{entity_id}"
    params = {}
    if year:
        params["year"] = year

    data = await _hud_get(path, params)
    return json.dumps(data, default=str)


async def handle_hud_list(args: dict) -> str:
    state_fips = _resolve_hud_state(args["state_fips"])
    path = f"/fmr/listCounties/{state_fips}"
    data = await _hud_get(path)
    return json.dumps(data, default=str)


# ---------------------------------------------------------------------------
# FCC / DMA — TV markets and geographic lookup (no key needed)
# ---------------------------------------------------------------------------

from .dma_data import DMA_MARKETS

FCC_DMA_TOOL = {
    "name": "fcc-dma-lookup",
    "description": (
        "Look up Nielsen DMA (Designated Market Area) TV markets. "
        "Search by market name, state, city, or rank. "
        "Returns market rank, name, TV households, states, and major cities. "
        "There are 210 DMAs in the US — this covers the top 100. "
        "Examples: search 'Cincinnati' to find the Cincinnati DMA, "
        "or search 'TX' to find all Texas markets, "
        "or set top_n=25 to get the top 25 markets by size."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search term: market name, city name, or 2-letter state code (e.g. 'Cincinnati', 'TX', 'Nashville')",
            },
            "top_n": {
                "type": "integer",
                "description": "Return the top N markets by rank (e.g. 10, 25, 50). Ignores query if set.",
            },
        },
        "required": [],
    },
}

FCC_GEO_TOOL = {
    "name": "fcc-geo-lookup",
    "description": (
        "Look up FCC geographic and census data for a latitude/longitude. "
        "Returns county, state, census block, and population for that location. "
        "Useful for mapping a street address or coordinate to its county and state."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "latitude": {
                "type": "number",
                "description": "Latitude (e.g. 40.7128 for NYC)",
            },
            "longitude": {
                "type": "number",
                "description": "Longitude (e.g. -74.0060 for NYC)",
            },
        },
        "required": ["latitude", "longitude"],
    },
}


async def handle_fcc_dma(args: dict) -> str:
    top_n = args.get("top_n")
    if top_n:
        results = [m for m in DMA_MARKETS if m["rank"] <= top_n]
        return json.dumps({"count": len(results), "markets": results}, default=str)

    query = (args.get("query") or "").strip()
    if not query:
        # Default: return top 25
        results = [m for m in DMA_MARKETS if m["rank"] <= 25]
        return json.dumps({"count": len(results), "markets": results}, default=str)

    q = query.lower()
    matches = []
    for m in DMA_MARKETS:
        # Match on market name, city names, or state codes
        if (q in m["name"].lower()
                or any(q in c.lower() for c in m["cities"])
                or (len(q) == 2 and q.upper() in m["states"])):
            matches.append(m)

    return json.dumps({"query": query, "count": len(matches), "markets": matches}, default=str)


async def handle_fcc_geo(args: dict) -> str:
    lat = args["latitude"]
    lon = args["longitude"]

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.get(
            "https://geo.fcc.gov/api/census/area",
            params={"lat": lat, "lon": lon, "format": "json"},
        )
        r.raise_for_status()
        data = r.json()

    results = data.get("results", [])
    if not results:
        return json.dumps({"error": "No results for this location"})

    area = results[0]
    return json.dumps({
        "latitude": lat,
        "longitude": lon,
        "county": area.get("county_name", ""),
        "county_fips": area.get("county_fips", ""),
        "state": area.get("state_name", ""),
        "state_code": area.get("state_code", ""),
        "state_fips": area.get("state_fips", ""),
        "census_block_fips": area.get("block_fips", ""),
        "block_population_2020": area.get("block_pop_2020", 0),
    }, default=str)


# ---------------------------------------------------------------------------
# Registry — collects all available direct tools
# ---------------------------------------------------------------------------

_TOOL_HANDLERS = {
    "fema-disaster-declarations": handle_fema,
    "bls-series-data": handle_bls,
    "fred-search-series": handle_fred_search,
    "fred-series-observations": handle_fred_data,
    "census-demographic-profile": handle_census_profile,
    "census-geography-search": handle_census_search,
    "bea-gdp-by-area": handle_bea_gdp,
    "bea-personal-income": handle_bea_income,
    "google-trends-interest": handle_gtrends_interest,
    "google-trends-by-region": handle_gtrends_geo,
    "fcc-dma-lookup": handle_fcc_dma,
    "fcc-geo-lookup": handle_fcc_geo,
    "census-business-patterns": handle_cbp,
    "cdc-health-data": handle_cdc,
    "hud-fair-market-rents": handle_hud_fmr,
    "hud-income-limits": handle_hud_il,
    "hud-list-counties": handle_hud_list,
}


def get_available_tools() -> list[dict]:
    """Return tool schemas for all direct tools whose API keys are configured."""
    tools = []

    # FEMA — always available (no key)
    tools.append(FEMA_TOOL)

    # BLS — needs key
    if settings.bls_api_key:
        tools.append(BLS_TOOL)

    # FRED — needs key
    if settings.fred_api_key:
        tools.append(FRED_SEARCH_TOOL)
        tools.append(FRED_DATA_TOOL)

    # Census — key optional but we have one
    if settings.census_api_key:
        tools.append(CENSUS_PROFILE_TOOL)
        tools.append(CENSUS_SEARCH_TOOL)
        tools.append(CBP_TOOL)

    # CDC PLACES — always available (no key)
    tools.append(CDC_TOOL)

    # BEA — needs key
    if settings.bea_api_key:
        tools.append(BEA_GDP_TOOL)
        tools.append(BEA_INCOME_TOOL)

    # Google Trends — always available (no key)
    tools.append(GTRENDS_INTEREST_TOOL)
    tools.append(GTRENDS_GEO_TOOL)

    # FCC / DMA — always available (no key)
    tools.append(FCC_DMA_TOOL)
    tools.append(FCC_GEO_TOOL)

    # HUD — needs key
    if settings.hud_api_key:
        tools.append(HUD_FMR_TOOL)
        tools.append(HUD_IL_TOOL)
        tools.append(HUD_FMR_LIST_TOOL)

    return tools


def get_source_status() -> dict[str, bool]:
    """Return connection status per source ID for the health endpoint."""
    return {
        "fema": True,  # Always available
        "bls": bool(settings.bls_api_key),
        "fred": bool(settings.fred_api_key),
        "census_acs": bool(settings.census_api_key),
        "census_geo": bool(settings.census_api_key),
        "bea": True if settings.bea_api_key else False,
        "google_trends": True,  # Always available (no key)
        "fcc": True,  # DMA data + FCC geo API (no key)
        "hud": bool(settings.hud_api_key),
        "cbp": bool(settings.census_api_key),
        "cdc": True,  # Always available (no key)
    }


async def call_tool(name: str, arguments: dict) -> str:
    """Execute a direct tool by name. Raises KeyError if unknown."""
    handler = _TOOL_HANDLERS.get(name)
    if not handler:
        raise KeyError(f"Unknown direct tool: {name}")
    return await handler(arguments)
