#!/usr/bin/env bash
# Refresh governor and Oklahoma election data from Wikipedia, then rebuild the app's data files.
#   scripts/update_data.sh          reuse pages already downloaded to .cache/
#   FRESH=1 scripts/update_data.sh  re-download every page (use after new results are posted)
# Wikipedia rate-limits requests; the fetcher waits and retries, so a fresh run can take an hour.
set -euo pipefail
cd "$(dirname "$0")/.."
D=scripts; W=.cache; C=$W/wiki
[ "${FRESH:-0}" = "1" ] && rm -rf "$C"
mkdir -p "$C"
python3 $D/fetch_ok2026.py $D $C
python3 $D/fetch_gov.py $D $C
python3 $D/fetch_okyears.py $D $C
python3 $D/fetch_okraces.py $D $C
python3 $D/fetch_okhist.py $D $C
python3 $D/build_extra.py $C data          # data/governors.json, data/oklahoma-2026.json
python3 $D/build_okextra.py $C .           # governor/Senate county tables -> .cache/okhist_extra.json
python3 $D/build_okhist.py . $W            # data/oklahoma-history.json
python3 $D/build_okyears.py $C .           # data/oklahoma-years.json
echo "Data rebuilt. Review with: git diff --stat data/"
