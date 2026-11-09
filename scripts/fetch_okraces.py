import sys, json, glob; sys.path.insert(0, sys.argv[1]); import wiki, okyears
cache = sys.argv[2]
titles = []
for f in glob.glob(cache + "/*.json"):
    d = json.load(open(f))
    if d["title"].endswith("Oklahoma elections") and not d.get("missing") and d["title"][:4].isdigit() and 2008 <= int(d["title"][:4]) <= 2024:
        titles += [t for t, o, k in okyears.race_pages(int(d["title"][:4]), d["links"])]
titles += ["2016 United States House of Representatives elections in Oklahoma", "2016 United States Senate election in Oklahoma",
           "2020 United States House of Representatives elections in Oklahoma", "2022 United States House of Representatives elections in Oklahoma",
           "2024 United States House of Representatives elections in Oklahoma"]
for t in sorted(set(titles)):
    d = wiki.wikitext(t, cache)
    print(t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
print("DONE", flush=True)
