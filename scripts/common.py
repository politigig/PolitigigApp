"""Shared helpers for the build scripts."""
import re

def wurl(title): return "https://en.wikipedia.org/wiki/" + title.replace(" ", "_")

def is_primary(t):
    t = t.lower(); return any(k in t for k in ("primary", "runoff", "convention", "caucus", "first round"))

def tidy(box):
    # drop fusion "Total" rows, then merge a candidate's party lines (fusion voting, e.g. CT/NY)
    merged = {}
    for c in box["candidates"]:
        if c["votes"] is None or c["partyName"].strip().lower() == "total": continue
        key = re.sub(r"\s*\((incumbent|inc\.)\)", "", c["name"], flags=re.I).strip()
        if key in merged:
            m = merged[key]; m["votes"] += c["votes"]; m["winner"] = m["winner"] or c["winner"]
            if c["party"] in ("D", "R") and m["party"] not in ("D", "R"): m["party"], m["partyName"] = c["party"], c["partyName"]
        else:
            merged[key] = dict(c, name=key)
    cands = list(merged.values())
    if not cands: return None
    cands.sort(key=lambda c: -c["votes"])
    total = box["total"] or sum(c["votes"] for c in cands)
    if total < sum(c["votes"] for c in cands): total = sum(c["votes"] for c in cands)
    if not any(c["winner"] for c in cands): cands[0]["winner"] = True
    for c in cands:
        c["name"] = re.sub(r"\s*\((incumbent|inc\.)\)", "", c["name"], flags=re.I).strip()
        c["incumbent"] = False
        c.pop("pct", None)
    return {"candidates": cands, "total": total}

