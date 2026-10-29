#!/usr/bin/env bash
# Milestone 6 automated regression stamp. Does not claim device or store success.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP="docs/audit-stamps/$(date -u +%Y%m%dT%H%M%SZ)-release-audit.txt"
mkdir -p docs/audit-stamps

{
  echo "VitaCore release audit stamp"
  echo "UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Commit: $(git rev-parse HEAD)"
  echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
  echo
  echo "== pnpm typecheck =="
  pnpm typecheck
  echo
  echo "== pnpm test =="
  pnpm test
  echo
  echo "== pnpm lint =="
  pnpm lint
  echo
  echo "== expo config --type public =="
  (cd apps/mobile && npx expo config --type public >/dev/null)
  echo "expo config --type public: PASS"
  echo
  echo "== expo config --json --full =="
  (cd apps/mobile && npx expo config --json --full >/dev/null)
  echo "expo config --json --full: PASS"
  echo
  echo "== expo-doctor =="
  set +e
  (cd apps/mobile && npx expo-doctor)
  DOCTOR=$?
  set -e
  if [[ "$DOCTOR" -eq 0 ]]; then
    echo "expo-doctor: PASS (exit 0)"
  else
    echo "expo-doctor: FAIL (exit $DOCTOR) — see docs/RELEASE_AUDIT.md"
  fi
  echo
  echo "Device builds, live Supabase RLS, and store submission were NOT run."
} | tee "$STAMP"

echo "Wrote $STAMP"
