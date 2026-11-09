import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import wiki
pages, cache = json.load(open(sys.argv[1])), sys.argv[2]
for t in sorted(set(pages + ["2010 Oklahoma City mayoral election", "2026 Tulsa municipal elections"])):
    d = wiki.wikitext(t, cache)
    print(t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
print("DONE", flush=True)
