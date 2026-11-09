"""Build data/oklahoma-local.json: Oklahoma municipal election results (mayor, city council, etc.)."""
import sys, os, json, re, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse
from common import wurl
CACHE, APP = sys.argv[1], sys.argv[2]

def clean_name(n): return re.sub(r"\s*\((incumbent|inc\.)\)", "", n, flags=re.I).strip()

def office_and_round(title, page_title):
    t = title.lower()
    if "runoff" in t: rnd = "Runoff"
    elif "republican primary" in t: rnd = "Republican primary"
    elif "democratic primary" in t: rnd = "Democratic primary"
    elif "primary" in t: rnd = "Primary"
    elif "first round" in t: rnd = "First round"
    else: rnd = "General"
    m = re.search(r"(?:city )?council(?:or)?,?\s*(?:district|ward)\s*(\d+)", t) or re.search(r"council (\d+)(?:st|nd|rd|th) district", t)
    if m: office = f"City Council District {m.group(1)}"
    elif "auditor" in t: office = "City Auditor"
    elif "mayor" in t or "mayoral" in page_title.lower(): office = "Mayor"
    else: office = parse.clean(title) or "Other"
    return office, rnd

elections = {}
for f in glob.glob(os.path.join(CACHE, "*.json")):
    d = json.load(open(f)); t = d["title"]
    m = re.match(r"(\d{4}) (Oklahoma City|Tulsa) (mayoral election|municipal elections)$", t)
    if not m or d.get("missing"): continue
    year, city, kind = int(m.group(1)), m.group(2), m.group(3)
    w = d["wikitext"]
    # Wikipedia box titles on these pages contain copy-paste errors (wrong district or year),
    # so the district comes from the section heading above each box, and the year from the page.
    heads = [(h.start(), h.group(1).strip()) for h in re.finditer(r"\n=+\s*([^=\n]+?)\s*=+", w)]
    for b in parse.boxes(w):
        cands = [c for c in b["candidates"] if c["votes"] is not None]
        if len(cands) < 1: continue
        office, rnd = office_and_round(b["title"], t)
        above = [h for p_, h in heads if p_ < b["raw_pos"]]
        sec = next((h for h in reversed(above) if re.search(r"district\s*\d+|mayor|auditor", h, re.I)), None)
        if kind == "municipal elections" and sec:
            md = re.search(r"district\s*(\d+)", sec, re.I)
            office = f"City Council District {md.group(1)}" if md else ("Mayor" if re.search("mayor", sec, re.I) else "City Auditor")
        if kind == "municipal elections" and office == "Mayor" and \
           any(json.load(open(g)).get("title") == f"{year} {city} mayoral election" for g in glob.glob(os.path.join(CACHE, "*.json"))):
            continue  # mayor race comes from its own page
        cands = sorted(({"name": clean_name(c["name"]), "party": c["party"] if c["party"] not in ("N", "") else "", "votes": c["votes"], "winner": c["winner"]}
                        for c in cands), key=lambda c: -c["votes"])
        total = max(b["total"] or 0, sum(c["votes"] for c in cands))
        key = (city, year, office)
        e = elections.setdefault(key, {"city": city, "year": year, "office": office, "rounds": [], "source": wurl(t)})
        if any(r["label"] == rnd and r["candidates"] == cands for r in e["rounds"]): continue
        e["rounds"].append({"label": rnd, "candidates": cands, "total": total})
out = {}
for (city, year, office), e in elections.items():
    labels = [r["label"] for r in e["rounds"]]
    if "Runoff" in labels:  # with a runoff, the unlabeled round was the first round
        for r in e["rounds"]:
            if r["label"] == "General": r["label"] = "First round"
    ORDER = ["Republican primary", "Democratic primary", "Primary", "First round", "General", "Runoff"]
    e["rounds"].sort(key=lambda r: ORDER.index(r["label"]))
    e["partisan"] = any(c["party"] in ("D", "R") for r in e["rounds"] for c in r["candidates"])
    last = e["rounds"][-1]
    # winner: marked in source, or a majority in the deciding round
    w = next((c for c in last["candidates"] if c["winner"]), None)
    if not w and last["candidates"] and last["candidates"][0]["votes"] > last["total"] / 2: w = last["candidates"][0]
    e["winner"] = w["name"] if w else None
    out.setdefault(city, []).append(e)
cities = []
for city in ("Oklahoma City", "Tulsa"):
    es = sorted(out.get(city, []), key=lambda e: (-e["year"], e["office"] != "Mayor", e["office"]))
    if es: cities.append({"city": city, "elections": es})
json.dump({"cities": cities}, open(os.path.join(APP, "data/oklahoma-local.json"), "w"), separators=(",", ":"))
for c in cities:
    for e in c["elections"]:
        print(c["city"], e["year"], e["office"], "->", e["winner"], "|", [(r["label"], len(r["candidates"]), r["total"]) for r in e["rounds"]])
