import sys; sys.path.insert(0, sys.argv[1]); import wiki
cache = sys.argv[2]
pages = ["2010 Oklahoma gubernatorial election", "2014 Oklahoma gubernatorial election", "2018 Oklahoma gubernatorial election",
         "2022 Oklahoma gubernatorial election",
         "2008 United States Senate election in Oklahoma", "2010 United States Senate election in Oklahoma",
         "2014 United States Senate election in Oklahoma", "2014 United States Senate special election in Oklahoma",
         "2016 United States Senate election in Oklahoma", "2020 United States Senate election in Oklahoma",
         "2022 United States Senate election in Oklahoma", "2022 United States Senate special election in Oklahoma"]
for t in pages:
    d = wiki.wikitext(t, cache)
    print(t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
print("DONE", flush=True)
