import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse

def party_from(s):
    s = s.lower()
    for k, c in (("republican", "R"), ("democratic", "D"), ("libertarian", "L"), ("independent", "I")):
        if k in s: return c
    return "O"

def rows(wikitext):
    i = wikitext.find("Summary of elections")
    if i < 0: return []
    t0 = wikitext.find("{|", i); t1 = wikitext.find("\n|}", t0)
    table = wikitext[t0:t1]
    out = []
    for raw in re.split(r"\n\|-[^\n]*", table)[1:]:
        # cells: lines starting with "|" (not "|}" / "|-"), allowing nested templates spanning lines
        cells, buf, depth = [], None, 0
        for line in raw.split("\n"):
            if depth == 0 and line.startswith("|") and not line.startswith("|}"):
                if buf is not None: cells.append(buf)
                buf = line[1:]
            elif buf is not None:
                buf += "\n" + line
            depth += line.count("{{") - line.count("}}")
            depth = max(depth, 0)
        if buf is not None: cells.append(buf)
        if len(cells) < 6: continue
        dist = parse.clean(cells[0])
        if not re.match(r"^\d+", dist): continue
        def after_bar(c):  # "{{Party shading/X}} | Text" -> Text
            depth = 0
            for k in range(len(c)):
                if c.startswith("{{", k): depth += 1
                if c.startswith("}}", k): depth -= 1
                if c[k] == "|" and depth == 0: return c[k + 1:]
            return c
        incumbent = parse.clean(cells[1])
        inc_party = party_from(cells[2])
        status = parse.clean(after_bar(cells[4]))
        cand_cell = cells[5]
        general = re.split(r"'''[^']*(?:Eliminated|Withdrawn|Disqualified)[^']*'''", cand_cell)[0]
        cands = []
        for m in re.finditer(r"\*\s*\{\{Party stripe\|([^}]*)\}\}(.*)", general):
            name_raw = m.group(2)
            win = "{{aye" in name_raw.lower()
            name = parse.clean(re.sub(r"\{\{aye\}\}", "", name_raw, flags=re.I))
            if name: cands.append({"name": name, "party": party_from(m.group(1)), "winner": win})
        for c in cands:
            m2 = re.search(r"\s*[-\u2013]\s*(\d+(?:\.\d+)?)%\s*$", c["name"])
            c["primaryPct"] = float(m2.group(1)) if m2 else None
            if m2: c["name"] = c["name"][:m2.start()].strip()
        st = status.lower()
        note = None
        if not any(c["winner"] for c in cands) and any(c["primaryPct"] is not None for c in cands) and "elected" in st:
            top = max(cands, key=lambda c: c["primaryPct"] or 0)
            top["winner"] = True; note = "Decided in the primary"
        if len(cands) == 1 and not any(c["winner"] for c in cands) and ("unopposed" in st or "elected" in st):
            cands[0]["winner"] = True
        decided = any(c["winner"] for c in cands)
        out.append({"district": int(re.match(r"\d+", dist).group()), "incumbent": incumbent, "incumbentParty": inc_party,
                    "status": status, "candidates": cands, "decided": decided, "unopposed": len(cands) == 1, "note": note})
    return out
