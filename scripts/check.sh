#!/usr/bin/env bash
# Release gate for the public showcase: fails if anything unsafe is about to go public.
set -u
fail=0
cd "$(dirname "$0")/.."
files=$(git ls-files | grep -v -E '^(\.github/|scripts/|\.banned-strings\.txt$|\.assetsignore$|wrangler\.jsonc$|README\.md$|\.gitignore$)')

echo "1. forbidden file types"
bad=$(echo "$files" | grep -i -E '\.(zip|gpkg|shp|dbf|gml|ply|las|laz|e57|xlsx|sql|csv|key|pem|env)$' || true)
[ -n "$bad" ] && { echo "$bad"; fail=1; }

echo "2. every html page has noindex"
for f in $(echo "$files" | grep -E '\.html$'); do
  grep -q 'noindex' "$f" || { echo "missing noindex: $f"; fail=1; }
done

echo "3. banned strings (.banned-strings.txt)"
hits=$(echo "$files" | xargs grep -n -i -F -f .banned-strings.txt 2>/dev/null || true)
[ -n "$hits" ] && { echo "$hits"; fail=1; }

echo "4. secret patterns"
sec=$(echo "$files" | xargs grep -n -E 'ghp_[A-Za-z0-9]{20,}|github_pat_|AKIA[0-9A-Z]{12,}|BEGIN (RSA |EC )?PRIVATE KEY|cfut_|sk-[A-Za-z0-9]{20,}' 2>/dev/null || true)
[ -n "$sec" ] && { echo "$sec"; fail=1; }

echo "5. file size (Workers assets limit 25 MiB)"
big=$(echo "$files" | while read -r f; do [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 26214400 ] && echo "$f"; done)
[ -n "$big" ] && { echo "$big"; fail=1; }

[ $fail -eq 0 ] && echo "RESULT: ok" || echo "RESULT: FAILED"
exit $fail
