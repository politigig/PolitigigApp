import sys; sys.path.insert(0, sys.argv[1]); import wiki
cache = sys.argv[2]
pages = ["2026 Oklahoma elections", "2026 United States Senate election in Oklahoma", "2026 United States House of Representatives elections in Oklahoma",
         "2026 Oklahoma gubernatorial election", "2026 Oklahoma lieutenant gubernatorial election", "2026 Oklahoma Attorney General election",
         "2026 Oklahoma State Treasurer election", "2026 Oklahoma Senate election", "2026 Oklahoma House of Representatives election",
         "2026 Oklahoma Superintendent of Public Instruction election", "2026 Oklahoma Corporation Commission election",
         "2026 Oklahoma Labor Commissioner election", "2026 Oklahoma Insurance Commissioner election", "2026 Oklahoma State Auditor election"]
for t in pages:
    d = wiki.wikitext(t, cache)
    print(t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
