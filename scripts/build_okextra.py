"""Build wiki/okhist_extra.json: Oklahoma governor & U.S. Senate county results from cached Wikipedia pages."""
import json, os, sys, re, glob, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import county_table, parse
CACHE, APP = sys.argv[1], sys.argv[2]
topo = json.load(open(os.path.join(APP, "data/counties-albers-10m.json")))
norm = lambda n: re.sub(r"[^a-z]", "", n.lower())
name2fips = {norm(g["properties"]["name"]): g["id"] for g in topo["objects"]["counties"]["geometries"] if g["id"].startswith("40")}
assert len(name2fips) == 77, len(name2fips)
out = []
for f in glob.glob(os.path.join(CACHE, "*.json")):
    d = json.load(open(f)); t = d["title"]
    m = re.match(r"(\d{4}) (Oklahoma gubernatorial election|United States Senate (special )?election in Oklahoma)$", t)
    if not m or d.get("missing") or int(m.group(1)) >= 2026: continue
    r = county_table.county_results(d["wikitext"])
    if not r: print("no county table:", t); continue
    ci = {c["party"]: k for k, c in enumerate(r["candidates"]) if c["party"] in ("D", "R")}
    if "D" not in ci or "R" not in ci: print("missing D/R:", t); continue
    counties = {}
    for cname, v in r["counties"].items():
        fips = name2fips.get(norm(cname))
        if not fips: print("unknown county", cname, t); continue
        counties[fips] = [v["votes"][ci["D"]], v["votes"][ci["R"]], v["total"]]
    if len(counties) != 77: print("only", len(counties), "counties:", t); continue
    # cross-check: county sums must match the page's statewide general-election result
    box = parse.general_box(d["wikitext"])
    bv = {re.sub(r"\s*\(incumbent\)", "", c["name"]): c["votes"] for c in (box or {}).get("candidates", []) if c["votes"]}
    ok_check = True
    for party, k in ci.items():
        nm = r["candidates"][k]["name"]; csum = sum(v[0 if party == "D" else 1] for v in counties.values())
        ref = bv.get(nm)
        if ref is None or abs(csum - ref) > 0.001 * ref:
            print(f"  mismatch {t}: {nm} county sum {csum} vs statewide {ref}"); ok_check = False
    if not ok_check: print("skipped (county table disagrees with statewide result):", t); continue
    office = "Governor" if "gubernatorial" in t else ("U.S. Senate (special)" if m.group(3) else "U.S. Senate")
    st = [sum(v[i] for v in counties.values()) for i in range(3)]
    out.append({"id": ("gov-" if office == "Governor" else "sen-" + ("sp-" if m.group(3) else "")) + m.group(1),
                "year": int(m.group(1)), "office": office,
                "dem": r["candidates"][ci["D"]]["name"], "rep": r["candidates"][ci["R"]]["name"],
                "state": st, "counties": counties, "source": "Wikipedia, citing the Oklahoma State Election Board (" + t + ")"})
    print("OK", t, st)
json.dump(out, open(os.path.join(CACHE, "..", "okhist_extra.json"), "w"))
