import csv, json, sys, collections
src, out = sys.argv[1], sys.argv[2]
ABBR = {"AL":"01","AK":"02","AZ":"04","AR":"05","CA":"06","CO":"08","CT":"09","DE":"10","DC":"11","FL":"12","GA":"13","HI":"15","ID":"16","IL":"17","IN":"18","IA":"19","KS":"20","KY":"21","LA":"22","ME":"23","MD":"24","MA":"25","MI":"26","MN":"27","MS":"28","MO":"29","MT":"30","NE":"31","NV":"32","NH":"33","NJ":"34","NM":"35","NY":"36","NC":"37","ND":"38","OH":"39","OK":"40","OR":"41","PA":"42","RI":"44","SC":"45","SD":"46","TN":"47","TX":"48","UT":"49","VT":"50","VA":"51","WA":"53","WV":"54","WI":"55","WY":"56"}
years = {y:{} for y in ("2008","2012","2016","2020","2024")}
def add(y, fips, d, r, t):
    fips = str(fips).split(".")[0].zfill(5)
    if fips[:2] not in ABBR.values(): return
    c = years[y].get(fips, [0,0,0])
    years[y][fips] = [c[0]+int(float(d)), c[1]+int(float(r)), c[2]+int(float(t))]
with open(f"{src}/US_County_Level_Presidential_Results_08-16.csv") as f:
    for row in csv.DictReader(f):
        for y in ("2008",):
            add(y, row["fips_code"], row[f"dem_{y}"], row[f"gop_{y}"], row[f"total_{y}"])
with open(f"{src}/US_County_Level_Presidential_Results_12-16.csv") as f:
    for row in csv.DictReader(f):
        if row["total_votes_2012"]:
            add("2012", row["combined_fips"], row["votes_dem_2012"], row["votes_gop_2012"], row["total_votes_2012"])
with open(f"{src}/2016_US_County_Level_Presidential_Results.csv") as f:
    for row in csv.DictReader(f):
        add("2016", row["combined_fips"], row["votes_dem"], row["votes_gop"], row["total_votes"])
for y in ("2020","2024"):
    with open(f"{src}/{y}_US_County_Level_Presidential_Results.csv") as f:
        for row in csv.DictReader(f):
            add(y, row["county_fips"], row["votes_dem"], row["votes_gop"], row["total_votes"])
result = {}
for y, counties in years.items():
    states = collections.defaultdict(lambda:[0,0,0])
    for fips, v in counties.items():
        s = states[fips[:2]]
        for i in range(3): s[i] += v[i]
    result[y] = {"states": dict(states), "counties": counties}
    nat = [sum(s[i] for s in states.values()) for i in range(3)]
    print(y, len(counties), "counties", len(states), "states", nat)
json.dump(result, open(out, "w"), separators=(",",":"))
# Override state totals 2008-2020 with certified MIT Election Lab figures
mit = sys.argv[3]
for r in csv.DictReader(open(mit)):
    y = r["year"]
    if y not in result: continue
    f = str(r["state_fips"]).zfill(2)
    s = result[y]["states"].setdefault(f, [0,0,0])
    if result[y].get("_reset_"+f) is None:
        result[y]["_reset_"+f] = True; s[0]=s[1]=0
    if r["party"]=="DEMOCRAT": s[0]=int(r["candidatevotes"])
    if r["party"]=="REPUBLICAN": s[1]=int(r["candidatevotes"])
    s[2]=int(r["totalvotes"])
for y in result:
    for k in [k for k in result[y] if k.startswith("_reset_")]: del result[y][k]
    st = result[y]["states"]
    print(y, "final", len(st), [sum(v[i] for v in st.values()) for i in range(3)])
# Alaska county-equivalents don't match map geometry; drop to use state fallback
for y in result:
    result[y]["counties"] = {k:v for k,v in result[y]["counties"].items() if not k.startswith("02")}
json.dump(result, open(out, "w"), separators=(",",":"))
