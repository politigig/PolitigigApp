"""Parse {{Election box ...}} blocks out of Wikipedia wikitext."""
import re

def _templates(text):
    """Yield (start, end, body) for top-level {{...}} templates."""
    i, n = 0, len(text)
    while i < n:
        j = text.find("{{", i)
        if j < 0: return
        depth, k = 0, j
        while k < n:
            if text.startswith("{{", k): depth += 1; k += 2
            elif text.startswith("}}", k):
                depth -= 1; k += 2
                if depth == 0: break
            else: k += 1
        yield j, k, text[j + 2:k - 2]
        i = k

def _split_params(body):
    parts, depth, cur, sq = [], 0, "", 0
    for ch_i, ch in enumerate(body):
        if body.startswith("{{", ch_i): depth += 1
        if body.startswith("}}", ch_i): depth -= 1
        if body.startswith("[[", ch_i): sq += 1
        if body.startswith("]]", ch_i): sq -= 1
        if ch == "|" and depth == 0 and sq == 0:
            parts.append(cur); cur = ""
        else:
            cur += ch
    parts.append(cur)
    name = parts[0].strip()
    params = {}
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1); params[k.strip().lower()] = v.strip()
    return name, params

def clean(s):
    s = re.sub(r"<ref[^>]*/>", "", s); s = re.sub(r"(?s)<ref.*?</ref>", "", s)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"\{\{(?:efn|Efn|refn|nowrap|sort)[^{}]*?\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'''?", "", s); s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    return re.sub(r"\s+", " ", s).strip()

def num(s):
    s = clean(s or "").replace(",", "")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None

PARTY = [("democratic", "D"), ("republican", "R"), ("libertarian", "L"), ("green", "G"), ("independent", "I"),
         ("constitution", "C"), ("write-in", "W"), ("nonpartisan", "N"), ("forward", "F"), ("working families", "WF"),
         ("conservative party", "CON"), ("vermont progressive", "P"), ("progressive", "P"), ("alaskan independence", "AI")]
def party_code(p):
    p = clean(p).lower()
    for k, c in PARTY:
        if k in p: return c
    return "O" if p else ""

def boxes(wikitext):
    """Return list of election boxes: {title, candidates:[{name,party,votes,pct,winner}], total}."""
    out, cur = [], None
    for s, e, body in _templates(wikitext):
        name, params = _split_params(body)
        ln = name.lower()
        if not ln.startswith("election box"): continue
        if ln.startswith("election box begin"):
            cur = {"title": clean(params.get("title", "")), "candidates": [], "total": None, "raw_pos": s}
        elif cur is None:
            continue
        elif ln.startswith("election box end"):
            out.append(cur); cur = None
        elif "candidate" in ln and "candidate" in params or ("candidate" in ln and params.get("candidate") is not None):
            raw = params.get("candidate", "")
            m_ubl = re.match(r"\s*\{\{\s*(?:ubl|unbulleted list|plainlist)\s*\|(.*)\}\}\s*$", raw, flags=re.I | re.S)
            if m_ubl:
                _, first = _split_params("x|" + m_ubl.group(1)); raw = m_ubl.group(1).split("|")[0]
                raw = re.split(r"\|(?![^\[]*\]\])", m_ubl.group(1))[0]
            cand = clean(re.split(r"<br\s*/?>|\{\{\s*small", raw, flags=re.I)[0])
            votes = num(params.get("votes"))
            if not cand: continue
            cur["candidates"].append({
                "name": cand, "party": party_code(params.get("party", "")), "partyName": clean(params.get("party", "")).replace(" (United States)", ""),
                "votes": int(votes) if votes is not None else None, "pct": num(params.get("percentage")),
                "winner": "winning" in ln})
        elif ln.startswith("election box total"):
            v = num(params.get("votes")); cur["total"] = int(v) if v else None
    return out

def general_box(wikitext, prefer=None):
    bx = [b for b in boxes(wikitext) if b["candidates"]]
    def bad(b):
        t = b["title"].lower()
        return any(k in t for k in ("primary", "runoff", "convention", "caucus", "first round", "special"))
    good = [b for b in bx if not bad(b)]
    return (good or bx or [None])[-1]
