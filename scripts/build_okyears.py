"""Build data/oklahoma-years.json: every statewide/federal Oklahoma general-election race, 2008-2024."""
import sys, os, json, re, glob, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse, okyears
from common import tidy, is_primary, wurl
CACHE, APP = sys.argv[1], sys.argv[2]

def page(t):
    fn = os.path.join(CACHE, hashlib.md5(t.encode()).hexdigest() + ".json")
    if not os.path.exists(fn): return None
    d = json.load(open(fn)); return None if d.get("missing") else d

OFFICES = [("lieutenant", "Lieutenant Governor"), ("gubernatorial", "Governor"), ("governor", "Governor"), ("attorney general", "Attorney General"),
           ("treasurer", "State Treasurer"), ("auditor", "State Auditor and Inspector"), ("superintendent", "Superintendent of Public Instruction"),
           ("labor", "Labor Commissioner"), ("insurance", "Insurance Commissioner"), ("corporat", "Corporation Commissioner"),
           ("presidential", "President"), ("senate", "U.S. Senate")]
def office_of(title):
    t = title.lower()
    for k, o in OFFICES:
        if k in t: return o
    return None

GROUP = lambda o: "Federal" if o.startswith(("President", "U.S.")) else ("State questions" if o.startswith("State Question") else "Statewide offices")
ORDER = ["President", "U.S. Senate", "U.S. Senate (special)", "U.S. House", "Governor", "Lieutenant Governor", "Attorney General", "State Treasurer",
         "State Auditor and Inspector", "Superintendent of Public Instruction", "Labor Commissioner", "Insurance Commissioner", "Corporation Commissioner"]

def from_box(b, office, source, district=None):
    t = tidy(b)
    if not t or len(t["candidates"]) < 1: return None
    return {"office": office, "district": district, "status": "reported", "source": source, **t}

def infobox_races(w, year, source):
    out = []
    for s, e, body in parse._templates(w):
        name, p = parse._split_params(body)
        if not name.lower().startswith("infobox election"): continue
        title = parse.clean(p.get("election_name", ""))
        o = office_of(title)
        if not o or "primary" in title.lower(): continue
        cands = []
        for k in range(1, 6):
            nm, v = parse.clean(p.get(f"nominee{k}", "")), parse.num(p.get(f"popular_vote{k}"))
            if nm and v: cands.append({"name": nm, "party": parse.party_code(p.get(f"party{k}", "")),
                                       "partyName": parse.clean(p.get(f"party{k}", "")).replace(" (United States)", ""), "votes": int(v), "winner": k == 1})
        if len(cands) >= 2:
            seat = re.search(r"seat (\d)", title, re.I)
            out.append({"office": o + (f" (seat {seat.group(1)})" if seat else "") + (" (special)" if "special" in title.lower() and o != "Corporation Commissioner" else ""),
                        "district": None, "status": "reported", "source": source,
                        **tidy({"candidates": cands, "total": None})})
    return out

def sq_text(w, source):
    out = []
    for m in re.finditer(r"===\s*State Question #?(\d+)\s*===(.*?)(?====|\Z)", w, re.S):
        body = m.group(2)
        y = re.search(r"YES\s+([\d,]+)", body); n = re.search(r"NO\s+([\d,]+)", body)
        if y and n:
            yv, nv = int(y.group(1).replace(",", "")), int(n.group(1).replace(",", ""))
            out.append({"office": f"State Question {m.group(1)}", "status": "measure", "yes": yv, "no": nv,
                        "outcome": "Passed" if yv > nv else "Failed", "source": source})
    return out

years = []
for year in range(2008, 2025, 2):
    races = {}
    def put(r, prio):
        k = (r["office"], r.get("district"))
        if k not in races or races[k][0] > prio: races[k] = (prio, r)
    ov = page(f"{year} Oklahoma elections")
    links = ov["links"] if ov else []
    titles = okyears.race_pages(year, links)
    if not ov:  # 2016 has no overview page
        titles = [(f"{year} United States Senate election in Oklahoma", "U.S. Senate", "race"),
                  (f"{year} United States House of Representatives elections in Oklahoma", "U.S. House", "house")]
    for extra in (f"{year} United States House of Representatives elections in Oklahoma",):
        if extra not in [t for t, _, _ in titles]: titles.append((extra, "U.S. House", "house"))
    # 1) dedicated race pages
    for t, office, kind in titles:
        p = page(t)
        if not p: continue
        if kind == "house":
            for b in parse.boxes(p["wikitext"]):
                m = re.search(r"(\d)(?:st|nd|rd|th) congressional district|district (\d)", b["title"], re.I)
                if not m or is_primary(b["title"]) or not b["candidates"]: continue
                d = int(m.group(1) or m.group(2))
                r = from_box(b, "U.S. House", wurl(t), district=d)
                if r: put(r, 0)
                elif len(b["candidates"]) == 1 and b["candidates"][0]["votes"] is None:
                    c = b["candidates"][0]; nm = re.sub(r"\s*\(incumbent\)", "", c["name"])
                    put({"office": "U.S. House", "district": d, "status": "outcome", "outcome": "Unopposed",
                         "subtitle": f"{nm} ({c['party']})", "note": "Ran unopposed; Oklahoma does not list uncontested races on the general-election ballot.",
                         "candidates": [], "source": wurl(t)}, 0)
        elif kind == "sq":
            yn = okyears.referendum(p["wikitext"])
            if yn: put({"office": office, "status": "measure", "yes": yn[0], "no": yn[1], "outcome": "Passed" if yn[0] > yn[1] else "Failed", "source": wurl(t)}, 0)
        else:
            gen = [b for b in parse.boxes(p["wikitext"]) if b["candidates"] and not is_primary(b["title"])
                   and not re.search(r"congress|house", b["title"], re.I)]
            if gen:
                r = from_box(gen[-1], office if not office.startswith("Commissioner of Labor") else "Labor Commissioner", wurl(t))
                if r: put(r, 0)
    # 2) results boxes embedded in the overview page
    if ov:
        src = wurl(ov["title"])
        for b in parse.boxes(ov["wikitext"]):
            if not b["candidates"] or is_primary(b["title"]): continue
            o = office_of(b["title"])
            if not o: continue
            r = from_box(b, o, src)
            if r: put(r, 1)
        for r in infobox_races(ov["wikitext"], year, src): put(r, 2)
        for r in sq_text(ov["wikitext"], src): put(r, 1)
    # presidential: use the certified state totals already in the app
    if year % 4 == 0:
        res = json.load(open(os.path.join(APP, "data/results.json")))[str(year)]["states"]["40"]
        meta = {2008: ("Barack Obama", "John McCain"), 2012: ("Barack Obama", "Mitt Romney"), 2016: ("Hillary Clinton", "Donald Trump"),
                2020: ("Joe Biden", "Donald Trump"), 2024: ("Kamala Harris", "Donald Trump")}[year]
        cands = [{"name": meta[1], "party": "R", "partyName": "Republican Party", "votes": res[1], "winner": True},
                 {"name": meta[0], "party": "D", "partyName": "Democratic Party", "votes": res[0], "winner": False}]
        if res[2] - res[0] - res[1] > 0:
            cands.append({"name": "Others", "party": "O", "partyName": "Other", "votes": res[2] - res[0] - res[1], "winner": False})
        put({"office": "President", "district": None, "status": "reported", "candidates": cands, "total": res[2],
             "source": "MIT Election Data and Science Lab"}, -1)
    # drop duplicated office rows keyed with/without "(special)" naming quirks: keep as is
    rs = [r for _, r in races.values()]
    def okey(r):
        base = r["office"].split(" (")[0]
        return (ORDER.index(r["office"]) if r["office"] in ORDER else (ORDER.index(base) if base in ORDER else 99), r["office"], r.get("district") or 0)
    rs.sort(key=okey)
    groups = []
    for g in ("Federal", "Statewide offices", "State questions"):
        gr = [r for r in rs if GROUP(r["office"]) == g]
        if gr: groups.append({"name": g, "races": gr})
    years.append({"year": year, "groups": groups})
    print(year, sum(len(g["races"]) for g in groups), "races:", ", ".join(r["office"] + (f" {r['district']}" if r.get("district") else "") for r in rs))
json.dump({"years": years}, open(os.path.join(APP, "data/oklahoma-years.json"), "w"), separators=(",", ":"))
