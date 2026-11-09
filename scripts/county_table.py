"""Parse Wikipedia 'by county' result tables for Oklahoma races."""
import re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse

def _cell_value(c):
    # "{{party shading/X}} |'''3,135'''" -> "3,135"
    depth, cut = 0, -1
    for k in range(len(c)):
        if c.startswith("{{", k): depth += 1
        if c.startswith("}}", k): depth -= 1
        if c[k] == "|" and depth == 0 and not c.startswith("||", k): cut = k
    return c[cut + 1:] if cut >= 0 and "{{" in c[:cut] else c

def tables(wikitext):
    out, i = [], 0
    while True:
        a = wikitext.find("{|", i)
        if a < 0: return out
        b = wikitext.find("\n|}", a)
        if b < 0: return out
        out.append(wikitext[a:b]); i = b + 3

def parse_table(t):
    rows = re.split(r"\n\|-[^\n]*", t)
    if len(rows) < 10: return None
    first_county = next((k for k, r in enumerate(rows) if re.search(r"County, Oklahoma", r)), None)
    if first_county is None: return None
    head = "\n".join(rows[:first_county])
    # candidate columns: header cells with colspan 2 that are not margin/total
    cands = []
    for line in head.split("\n"):
        if not line.startswith("!"): continue
        if not re.search(r'colspan\s*=\s*"?2', line): continue
        txt = line.split("|", 1)[1] if "|" in line else line
        name_raw = re.split(r"<br\s*/?>", txt, flags=re.I)
        name = parse.clean(name_raw[0])
        partytxt = parse.clean(" ".join(name_raw[1:])) if len(name_raw) > 1 else ""
        if re.search(r"margin|total", name, re.I): continue
        cands.append({"name": name, "party": parse.party_code(partytxt) or parse.party_code(name)})
    if not cands: return None
    counties = {}
    for r in rows[1:]:
        lines = [l for l in r.strip().split("\n") if l.strip()]
        if not lines: continue
        first = lines[0]
        m = re.search(r"\[\[([^\]|]+?) County, Oklahoma(?:\|[^\]]*)?\]\]", first)
        if not m: continue
        cells = []
        for l in lines[1:]:
            if l.startswith("|") or l.startswith("!"):
                for part in re.split(r"\|\|", l[1:]):
                    cells.append(_cell_value(part))
        nums = []
        for c in cells:
            v = parse.clean(c).replace("%", "").strip()
            if re.fullmatch(r"\d{1,3}(\.\d{3})+", v): v = v.replace(".", "")  # "1.450" typo for 1,450
            v = v.replace(",", "")
            try: nums.append(float(v))
            except ValueError: nums.append(None)
        nums = [x for x in nums if x is not None]
        n = len(cands)
        if len(nums) < 2 * n + 1: continue
        votes = [int(nums[2 * k]) for k in range(n)]
        pcts = [nums[2 * k + 1] for k in range(n)]
        total = int(nums[-1])
        if sum(votes) > total:
            # one mistyped cell: accept a fix only if total minus the others matches that cell's stated percent
            for k in range(n):
                fixed = total - (sum(votes) - votes[k])
                if fixed >= 0 and abs(fixed / total * 100 - pcts[k]) < 0.06:
                    votes[k] = fixed; break
        if not (0.9 * total <= sum(votes) <= total * 1.001): continue
        counties[m.group(1).strip()] = {"votes": votes, "total": total}
    return {"candidates": cands, "counties": counties} if len(counties) >= 70 else None

def county_results(wikitext):
    best = None
    for t in tables(wikitext):
        p = parse_table(t)
        if p and (best is None or len(p["counties"]) > len(best["counties"])): best = p
    return best
