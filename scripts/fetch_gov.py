import sys, json; sys.path.insert(0, sys.argv[1]); import wiki
cache = sys.argv[2]
Y = {}
for s in "AL AK AZ AR CA CO CT FL GA HI ID IL IA KS ME MD MA MI MN NE NV NH NM NY OH OK OR PA RI SC SD TN TX VT WI WY".split(): Y[s] = 2026
for s in "NJ VA".split(): Y[s] = 2025
for s in "DE IN MO MT NC ND UT WA WV".split(): Y[s] = 2024
for s in "KY LA MS".split(): Y[s] = 2023
NAMES = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}
assert len(Y) == 50
json.dump({"years": Y, "names": NAMES}, open(cache + "/../gov_plan.json", "w"))
for i, (s, y) in enumerate(sorted(Y.items())):
    t = f"{y} {NAMES[s]} gubernatorial election"
    d = wiki.wikitext(t, cache)
    print(i + 1, s, t, "MISSING" if d.get("missing") else len(d["wikitext"]), flush=True)
print("DONE", flush=True)
