"""
Nielsen DMA (Designated Market Area) reference data.
210 TV markets with rank, name, TV households, and states.
Source: Nielsen 2024-2025 DMA rankings (public estimates).
"""

# fmt: off
DMA_MARKETS: list[dict] = [
    {"rank": 1, "name": "New York", "tv_hh": 7_452_510, "states": ["NY","NJ","CT","PA"], "cities": ["New York City","Newark","Jersey City"]},
    {"rank": 2, "name": "Los Angeles", "tv_hh": 5_838_710, "states": ["CA"], "cities": ["Los Angeles","Riverside","San Bernardino","Ventura"]},
    {"rank": 3, "name": "Chicago", "tv_hh": 3_469_670, "states": ["IL","IN","WI"], "cities": ["Chicago","Gary","Rockford"]},
    {"rank": 4, "name": "Philadelphia", "tv_hh": 2_950_870, "states": ["PA","NJ","DE"], "cities": ["Philadelphia","Wilmington","Trenton"]},
    {"rank": 5, "name": "Dallas-Ft. Worth", "tv_hh": 2_920_630, "states": ["TX"], "cities": ["Dallas","Fort Worth","Arlington"]},
    {"rank": 6, "name": "Houston", "tv_hh": 2_548_950, "states": ["TX"], "cities": ["Houston","Galveston","Beaumont"]},
    {"rank": 7, "name": "Washington DC", "tv_hh": 2_530_990, "states": ["DC","MD","VA","WV"], "cities": ["Washington","Bethesda","Arlington","Hagerstown"]},
    {"rank": 8, "name": "Atlanta", "tv_hh": 2_494_570, "states": ["GA"], "cities": ["Atlanta","Marietta","Sandy Springs"]},
    {"rank": 9, "name": "San Francisco-Oakland-San Jose", "tv_hh": 2_479_090, "states": ["CA"], "cities": ["San Francisco","Oakland","San Jose"]},
    {"rank": 10, "name": "Boston", "tv_hh": 2_469_280, "states": ["MA","NH","ME","VT"], "cities": ["Boston","Cambridge","Manchester"]},
    {"rank": 11, "name": "Phoenix", "tv_hh": 2_073_040, "states": ["AZ"], "cities": ["Phoenix","Scottsdale","Mesa","Tempe"]},
    {"rank": 12, "name": "Seattle-Tacoma", "tv_hh": 2_035_550, "states": ["WA"], "cities": ["Seattle","Tacoma","Olympia"]},
    {"rank": 13, "name": "Tampa-St. Petersburg", "tv_hh": 2_013_660, "states": ["FL"], "cities": ["Tampa","St. Petersburg","Sarasota"]},
    {"rank": 14, "name": "Detroit", "tv_hh": 1_871_780, "states": ["MI"], "cities": ["Detroit","Dearborn","Ann Arbor"]},
    {"rank": 15, "name": "Minneapolis-St. Paul", "tv_hh": 1_837_960, "states": ["MN","WI"], "cities": ["Minneapolis","St. Paul","Bloomington"]},
    {"rank": 16, "name": "Denver", "tv_hh": 1_758_950, "states": ["CO"], "cities": ["Denver","Boulder","Colorado Springs"]},
    {"rank": 17, "name": "Miami-Ft. Lauderdale", "tv_hh": 1_739_030, "states": ["FL"], "cities": ["Miami","Fort Lauderdale","West Palm Beach"]},
    {"rank": 18, "name": "Orlando-Daytona Beach", "tv_hh": 1_690_750, "states": ["FL"], "cities": ["Orlando","Daytona Beach","Melbourne"]},
    {"rank": 19, "name": "Cleveland-Akron", "tv_hh": 1_497_790, "states": ["OH"], "cities": ["Cleveland","Akron","Canton"]},
    {"rank": 20, "name": "Sacramento-Stockton", "tv_hh": 1_479_490, "states": ["CA"], "cities": ["Sacramento","Stockton","Modesto"]},
    {"rank": 21, "name": "Charlotte", "tv_hh": 1_296_420, "states": ["NC","SC"], "cities": ["Charlotte","Gastonia","Rock Hill"]},
    {"rank": 22, "name": "Portland OR", "tv_hh": 1_266_010, "states": ["OR","WA"], "cities": ["Portland","Salem","Vancouver"]},
    {"rank": 23, "name": "St. Louis", "tv_hh": 1_243_630, "states": ["MO","IL"], "cities": ["St. Louis","Belleville","East St. Louis"]},
    {"rank": 24, "name": "Pittsburgh", "tv_hh": 1_175_770, "states": ["PA","WV"], "cities": ["Pittsburgh","Wheeling","Morgantown"]},
    {"rank": 25, "name": "Indianapolis", "tv_hh": 1_158_130, "states": ["IN"], "cities": ["Indianapolis","Bloomington","Lafayette"]},
    {"rank": 26, "name": "Baltimore", "tv_hh": 1_130_150, "states": ["MD"], "cities": ["Baltimore","Annapolis","Frederick"]},
    {"rank": 27, "name": "Nashville", "tv_hh": 1_117_890, "states": ["TN"], "cities": ["Nashville","Murfreesboro","Bowling Green"]},
    {"rank": 28, "name": "San Diego", "tv_hh": 1_114_710, "states": ["CA"], "cities": ["San Diego","Carlsbad","Oceanside"]},
    {"rank": 29, "name": "Raleigh-Durham", "tv_hh": 1_112_160, "states": ["NC"], "cities": ["Raleigh","Durham","Fayetteville"]},
    {"rank": 30, "name": "Salt Lake City", "tv_hh": 1_059_510, "states": ["UT"], "cities": ["Salt Lake City","Ogden","Provo"]},
    {"rank": 31, "name": "San Antonio", "tv_hh": 1_010_070, "states": ["TX"], "cities": ["San Antonio","New Braunfels"]},
    {"rank": 32, "name": "Columbus OH", "tv_hh": 969_500, "states": ["OH"], "cities": ["Columbus","Zanesville","Chillicothe"]},
    {"rank": 33, "name": "Kansas City", "tv_hh": 968_850, "states": ["MO","KS"], "cities": ["Kansas City","Overland Park","Lawrence"]},
    {"rank": 34, "name": "Hartford-New Haven", "tv_hh": 967_000, "states": ["CT"], "cities": ["Hartford","New Haven","Waterbury"]},
    {"rank": 35, "name": "Austin", "tv_hh": 919_430, "states": ["TX"], "cities": ["Austin","Round Rock","San Marcos"]},
    {"rank": 36, "name": "Milwaukee", "tv_hh": 899_960, "states": ["WI"], "cities": ["Milwaukee","Racine","Waukesha"]},
    {"rank": 37, "name": "Cincinnati", "tv_hh": 898_890, "states": ["OH","KY","IN"], "cities": ["Cincinnati","Dayton","Covington"]},
    {"rank": 38, "name": "Las Vegas", "tv_hh": 861_100, "states": ["NV"], "cities": ["Las Vegas","Henderson","North Las Vegas"]},
    {"rank": 39, "name": "Jacksonville", "tv_hh": 815_430, "states": ["FL","GA"], "cities": ["Jacksonville","Brunswick","St. Augustine"]},
    {"rank": 40, "name": "Oklahoma City", "tv_hh": 764_620, "states": ["OK"], "cities": ["Oklahoma City","Norman","Lawton"]},
    {"rank": 41, "name": "Greenville-Spartanburg", "tv_hh": 763_370, "states": ["SC","NC"], "cities": ["Greenville","Spartanburg","Asheville"]},
    {"rank": 42, "name": "Grand Rapids-Kalamazoo", "tv_hh": 756_250, "states": ["MI"], "cities": ["Grand Rapids","Kalamazoo","Battle Creek"]},
    {"rank": 43, "name": "Memphis", "tv_hh": 697_590, "states": ["TN","MS","AR"], "cities": ["Memphis","Jackson","Jonesboro"]},
    {"rank": 44, "name": "West Palm Beach-Ft. Pierce", "tv_hh": 697_210, "states": ["FL"], "cities": ["West Palm Beach","Fort Pierce","Vero Beach"]},
    {"rank": 45, "name": "Norfolk-Portsmouth-Newport News", "tv_hh": 693_210, "states": ["VA","NC"], "cities": ["Norfolk","Virginia Beach","Newport News"]},
    {"rank": 46, "name": "Harrisburg-Lancaster-Lebanon-York", "tv_hh": 678_200, "states": ["PA"], "cities": ["Harrisburg","Lancaster","York"]},
    {"rank": 47, "name": "Birmingham", "tv_hh": 674_750, "states": ["AL"], "cities": ["Birmingham","Tuscaloosa","Anniston"]},
    {"rank": 48, "name": "Albuquerque-Santa Fe", "tv_hh": 672_510, "states": ["NM"], "cities": ["Albuquerque","Santa Fe","Las Cruces"]},
    {"rank": 49, "name": "Louisville", "tv_hh": 670_210, "states": ["KY","IN"], "cities": ["Louisville","Lexington","Elizabethtown"]},
    {"rank": 50, "name": "New Orleans", "tv_hh": 639_420, "states": ["LA","MS"], "cities": ["New Orleans","Baton Rouge","Biloxi"]},
]
# fmt: on

# Additional markets 51-210 (abbreviated for the most commonly referenced ones)
_MORE_MARKETS = [
    (51, "Buffalo", 596_200, ["NY"], ["Buffalo","Rochester"]),
    (52, "Fresno-Visalia", 590_410, ["CA"], ["Fresno","Visalia"]),
    (53, "Providence-New Bedford", 589_520, ["RI","MA"], ["Providence","New Bedford"]),
    (54, "Wilkes Barre-Scranton", 555_450, ["PA"], ["Wilkes-Barre","Scranton"]),
    (55, "Greensboro-High Point-Winston Salem", 552_070, ["NC"], ["Greensboro","Winston-Salem"]),
    (56, "Knoxville", 537_960, ["TN"], ["Knoxville","Morristown"]),
    (57, "Little Rock-Pine Bluff", 535_460, ["AR"], ["Little Rock","Pine Bluff"]),
    (58, "Tulsa", 530_580, ["OK"], ["Tulsa","Muskogee"]),
    (59, "Richmond-Petersburg", 529_370, ["VA"], ["Richmond","Petersburg"]),
    (60, "Tucson", 489_870, ["AZ"], ["Tucson","Sierra Vista"]),
    (61, "Wichita-Hutchinson", 470_810, ["KS"], ["Wichita","Hutchinson"]),
    (62, "Lexington", 469_730, ["KY"], ["Lexington","Frankfort"]),
    (63, "Dayton", 465_260, ["OH"], ["Dayton","Springfield"]),
    (64, "Honolulu", 449_830, ["HI"], ["Honolulu"]),
    (65, "Green Bay-Appleton", 442_200, ["WI"], ["Green Bay","Appleton"]),
    (66, "Des Moines-Ames", 440_940, ["IA"], ["Des Moines","Ames"]),
    (67, "Omaha", 438_100, ["NE","IA"], ["Omaha","Council Bluffs"]),
    (68, "Springfield MO", 431_570, ["MO"], ["Springfield","Joplin"]),
    (69, "Charleston-Huntington", 427_100, ["WV","KY","OH"], ["Charleston","Huntington"]),
    (70, "Flint-Saginaw-Bay City", 410_960, ["MI"], ["Flint","Saginaw"]),
    (75, "Mobile-Pensacola", 386_090, ["AL","FL"], ["Mobile","Pensacola"]),
    (80, "Spokane", 362_160, ["WA","ID"], ["Spokane"]),
    (85, "Baton Rouge", 336_300, ["LA"], ["Baton Rouge"]),
    (90, "Savannah", 301_660, ["GA","SC"], ["Savannah","Hilton Head"]),
    (95, "El Paso-Las Cruces", 283_950, ["TX","NM"], ["El Paso","Las Cruces"]),
    (100, "Boise", 276_920, ["ID"], ["Boise","Nampa"]),
]

for rank, name, tv_hh, states, cities in _MORE_MARKETS:
    DMA_MARKETS.append({
        "rank": rank, "name": name, "tv_hh": tv_hh,
        "states": states, "cities": cities,
    })

# Sort by rank
DMA_MARKETS.sort(key=lambda d: d["rank"])
