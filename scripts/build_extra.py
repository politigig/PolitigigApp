"""Build data/governors.json and data/oklahoma-2026.json from cached Wikipedia wikitext."""
import sys, json, os, re, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse, legis
CACHE, OUT = sys.argv[1], sys.argv[2]

def page(title):
    fn = os.path.join(CACHE, hashlib.md5(title.encode()).hexdigest() + ".json")
    if not os.path.exists(fn): return None
    d = json.load(open(fn))
    return None if d.get("missing") else d

from common import wurl, is_primary, tidy

def nominees(boxes):
    """When the general isn't posted yet: the winner of each party's last primary/runoff."""
    by_party = {}
    for b in boxes:
        t = b["title"].lower()
        if not is_primary(t): continue
        win = next((c for c in b["candidates"] if c["winner"]), None)
        if win: by_party[win["party"]] = {"name": re.sub(r"\s*\(incumbent\)", "", win["name"]), "party": win["party"], "partyName": win["partyName"]}
    return sorted(by_party.values(), key=lambda c: {"R": 0, "D": 1}.get(c["party"], 2))

def race(title, office, box_filter=None, district=None):
    p = page(title)
    r = {"office": office, "district": district, "source": wurl(title) if p else None}
    if not p:
        r.update(status="pending", candidates=[], note="Results not yet available"); return r
    bx = [b for b in parse.boxes(p["wikitext"]) if b["candidates"]]
    if box_filter: bx = [b for b in bx if box_filter(b["title"])]
    gen = [b for b in bx if not is_primary(b["title"])]
    t = tidy(gen[-1]) if gen else None
    if t:
        r.update(status="reported", **t)
    else:
        r.update(status="pending", candidates=[], note="General election results not yet posted")
    return r

# ---------------- Oklahoma ----------------
ok = {"election": "Oklahoma General Election", "date": "2026-11-03", "status": "unofficial",
      "statusNote": "Unofficial results. The State Election Board certifies state and federal races on November 10, 2026.",
      "groups": []}
ok["groups"].append({"name": "Statewide offices", "races": [
    race("2026 Oklahoma gubernatorial election", "Governor"),
    race("2026 Oklahoma lieutenant gubernatorial election", "Lieutenant Governor"),
    race("2026 Oklahoma Attorney General election", "Attorney General"),
    race("2026 Oklahoma State Treasurer election", "State Treasurer"),
    race("2026 Oklahoma State Auditor election", "State Auditor and Inspector"),
    race("2026 Oklahoma Superintendent of Public Instruction election", "Superintendent of Public Instruction"),
    race("2026 Oklahoma Labor Commissioner election", "Labor Commissioner"),
    race("2026 Oklahoma Insurance Commissioner election", "Insurance Commissioner"),
    race("2026 Oklahoma Corporation Commission election", "Corporation Commissioner"),
]})
fed = [race("2026 United States Senate election in Oklahoma", "U.S. Senate")]
for n, suf in zip(range(1, 6), ["st", "nd", "rd", "th", "th"]):
    fed.append(race("2026 United States House of Representatives elections in Oklahoma", f"U.S. House District {n}",
                    box_filter=lambda t, n=n, suf=suf: f"{n}{suf} congressional district" in t.lower() or f"district {n}" in t.lower(), district=n))
ok["groups"].append({"name": "Federal", "races": fed})

# State questions on the Nov 3 ballot (outcomes reported in text; no vote counts on Wikipedia yet)
SRC = wurl("2026 Oklahoma elections")
ok["groups"].append({"name": "State questions", "races": [
    {"office": "State Question 845", "subtitle": "Changes to the Judicial Nominating Commission", "status": "outcome",
     "outcome": "Failed", "candidates": [], "source": SRC},
    {"office": "State Question 847", "subtitle": "Property tax cap change", "status": "outcome",
     "outcome": "Failed", "candidates": [], "source": SRC},
]})

ov = page("2026 Oklahoma elections")
# Judicial retention (reported in text only, no vote counts)
if ov:
    w = ov["wikitext"]; i = w.find("Retention===")
    txt = parse.clean(w[i + 12:w.find("==", i + 12)]) if i >= 0 else ""
    ok["judicialRetention"] = {"summary": re.sub(r"\s+\.", ".", txt), "source": wurl("2026 Oklahoma elections")}

# Legislature: districts parsed later if the pages carry results tables
ok["legislature"] = []
for title, chamber in (("2026 Oklahoma Senate election", "State Senate"), ("2026 Oklahoma House of Representatives election", "State House")):
    p = page(title)
    ok["legislature"].append({"chamber": chamber, "source": wurl(title) if p else None,
                              "districts": sorted(legis.rows(p["wikitext"]), key=lambda r: r["district"]) if p else []})

json.dump(ok, open(os.path.join(OUT, "oklahoma-2026.json"), "w"), separators=(",", ":"))
for g in ok["groups"]:
    for r in g["races"]:
        print("OK", r["office"], r["status"], [(c["name"], c["party"], c.get("votes")) for c in r["candidates"]][:4])

# ---------------- Governors ----------------
plan_fn = os.path.join(CACHE, "..", "gov_plan.json")
if os.path.exists(plan_fn):
    plan = json.load(open(plan_fn))
    gov = {}
    for s, y in sorted(plan["years"].items()):
        t = f"{y} {plan['names'][s]} gubernatorial election"
        r = race(t, "Governor", box_filter=lambda bt: not re.search(r"congress|senate|house|lieutenant|attorney", bt, re.I))
        r["year"] = y
        r["status"] = ("unofficial" if y == 2026 else "certified") if r["status"] == "reported" else "pending"
        gov[s] = r
        print("GOV", s, y, r["status"], [(c["name"], c["party"], c.get("votes")) for c in r["candidates"]][:3])
    json.dump(gov, open(os.path.join(OUT, "governors.json"), "w"), separators=(",", ":"))
