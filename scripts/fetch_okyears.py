import sys; sys.path.insert(0, sys.argv[1]); import wiki
cache = sys.argv[2]
for y in range(2008, 2025, 2):
    t = f"{y} Oklahoma elections"
    d = wiki.wikitext(t, cache)
    print(t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
print("DONE", flush=True)
