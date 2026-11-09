"""Polite Wikipedia wikitext fetcher with on-disk cache, pacing and 429 backoff."""
import json, os, sys, time, urllib.parse, urllib.request, hashlib
CACHE = sys.argv[1] if len(sys.argv) > 1 else "cache"
UA = "PolitigigApp-data-builder/1.0 (election results app build script)"
_last = [0.0]
def wikitext(title, cache=CACHE, delay=3.0):
    os.makedirs(cache, exist_ok=True)
    fn = os.path.join(cache, hashlib.md5(title.encode()).hexdigest() + ".json")
    if os.path.exists(fn):
        return json.load(open(fn))
    for attempt in range(5):
        wait = delay - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        q = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "wikitext|links", "format": "json",
                                    "formatversion": "2", "redirects": "1", "maxlag": "5"})
        req = urllib.request.Request("https://en.wikipedia.org/w/api.php?" + q, headers={"User-Agent": UA})
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                ra = int(e.headers.get("Retry-After") or 30)
                print(f"429 on {title}; waiting {ra}s", file=sys.stderr); time.sleep(max(ra, 30)); continue
            raise
        if "error" in d:
            out = {"title": title, "missing": True, "error": d["error"].get("code")}
        else:
            p = d["parse"]
            out = {"title": p["title"], "wikitext": p["wikitext"], "links": [l["title"] for l in p.get("links", []) if l.get("exists")]}
        json.dump(out, open(fn, "w"))
        return out
    raise RuntimeError("gave up on " + title)
