"""List Wikipedia pages for Oklahoma local (municipal) elections, 2008 onward."""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import wiki
out = set()
for q in ['intitle:mayoral intitle:election Oklahoma', 'intitle:"Oklahoma City mayoral election"', 'intitle:"Tulsa mayoral election"',
          'intitle:Tulsa intitle:municipal intitle:election', 'intitle:"Oklahoma City" intitle:election', 'intitle:Norman intitle:election Oklahoma',
          'intitle:election intitle:"Broken Arrow"', 'intitle:election intitle:Edmond Oklahoma', 'intitle:election intitle:Lawton Oklahoma']:
    for t in wiki.search(q):
        m = re.match(r"(\d{4}) ", t)
        if m and 2008 <= int(m.group(1)) <= 2026 and re.search(r"Oklahoma City|Tulsa|Norman|Broken Arrow|Edmond|Lawton|Moore|Stillwater", t) \
           and not re.search(r"congress|Senate election|House of Rep|gubernatorial|presidential", t):
            out.add(t)
print(json.dumps(sorted(out), indent=0))
json.dump(sorted(out), open(sys.argv[1], "w"))
