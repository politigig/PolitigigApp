"""Build data/oklahoma-history.json: Oklahoma county-level results, 2008 onward."""
import json, os, sys
APP = sys.argv[1]
WORK = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wiki")
res = json.load(open(os.path.join(APP, "data/results.json")))
PRES = {"2008": ("Barack Obama", "John McCain"), "2012": ("Barack Obama", "Mitt Romney"), "2016": ("Hillary Clinton", "Donald Trump"),
        "2020": ("Joe Biden", "Donald Trump"), "2024": ("Kamala Harris", "Donald Trump")}
races = []
for y, (d, r) in PRES.items():
    cty = {f: v for f, v in res[y]["counties"].items() if f.startswith("40")}
    races.append({"id": f"pres-{y}", "year": int(y), "office": "President", "dem": d, "rep": r,
                  "state": res[y]["states"]["40"], "counties": cty,
                  "source": "MIT Election Lab (state totals) and US County Level Election Results dataset (counties)"})
extra = os.path.join(WORK, "okhist_extra.json")
if os.path.exists(extra):
    races += json.load(open(extra))
races.sort(key=lambda x: (-x["year"], {"President": 0, "Governor": 1}.get(x["office"], 2), x["office"]))
json.dump({"races": races}, open(os.path.join(APP, "data/oklahoma-history.json"), "w"), separators=(",", ":"))
for x in races:
    s = x["state"]; print(x["id"], len(x["counties"]), "counties", s, f"D {s[0]/s[2]:.1%} R {s[1]/s[2]:.1%}")
