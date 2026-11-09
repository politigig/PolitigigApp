"""Race-page discovery and parsing for Oklahoma general elections 2008-2024."""
import re, os, sys, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse

LOCAL = re.compile(r"mayor|county|city|tulsa|norman|edmond|school|municipal|special election in Oklahoma's|primary", re.I)

def race_pages(year, links):
    """Return [(title, office, kind)] for the statewide/federal races linked from the overview page."""
    out = []
    for t in links:
        if not t.startswith(f"{year} "): continue
        if t == f"{year} United States House of Representatives elections in Oklahoma":
            out.append((t, "U.S. House", "house")); continue
        m = re.match(rf"{year} United States Senate (special )?election in Oklahoma$", t)
        if m: out.append((t, "U.S. Senate" + (" (special)" if m.group(1) else ""), "race")); continue
        m = re.match(rf"{year} Oklahoma State Question (\d+)", t)
        if m: out.append((t, f"State Question {m.group(1)}", "sq")); continue
        m = re.match(rf"{year} Oklahoma (.+?) (?:special )?election$", t)
        if not m or LOCAL.search(t): continue
        o = m.group(1)
        if o in ("Senate", "House of Representatives"): continue  # state legislature: separate pages, not in scope here
        o = {"gubernatorial": "Governor", "lieutenant gubernatorial": "Lieutenant Governor"}.get(o, o)
        o = o[0].upper() + o[1:]
        out.append((t, o, "race"))
    order = ["U.S. Senate", "U.S. House", "Governor", "Lieutenant Governor", "Attorney General", "State Treasurer",
             "State Auditor", "Superintendent", "Labor", "Insurance", "Corporation"]
    def key(x):
        for i, k in enumerate(order):
            if x[1].startswith(k) or k in x[1]: return (i, x[1])
        return (len(order), x[1])
    return sorted(set(out), key=key)

def referendum(wikitext):
    m = re.search(r"\{\{\s*Referendum results(.*?)\}\}\s*$", wikitext, re.S | re.M)
    for s, e, body in parse._templates(wikitext):
        name, p = parse._split_params(body)
        if name.lower().startswith("referendum results"):
            y, n = parse.num(p.get("for") or p.get("yes")), parse.num(p.get("against") or p.get("no"))
            if y and n: return int(y), int(n)
    for b in parse.boxes(wikitext):
        cs = {c["name"].lower(): c["votes"] for c in b["candidates"] if c["votes"]}
        y = next((v for k, v in cs.items() if k.startswith("yes") or k.startswith("for")), None)
        n = next((v for k, v in cs.items() if k.startswith("no") or k.startswith("against")), None)
        if y and n: return y, n
    return None
