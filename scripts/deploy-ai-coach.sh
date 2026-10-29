#!/usr/bin/env bash
# Deploy VitaCore ai-coach Edge Function and set Gemini secrets.
# Requires: supabase login (or SUPABASE_ACCESS_TOKEN) and project linked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-offtlxnmbeobzaguclip}"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "Set GEMINI_API_KEY in the environment before running this script."
  exit 1
fi

echo "Linking project $PROJECT_REF (if needed)…"
npx supabase link --project-ref "$PROJECT_REF"

echo "Setting function secrets…"
npx supabase secrets set \
  "GEMINI_API_KEY=${GEMINI_API_KEY}" \
  "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.8-flash}"

echo "Deploying ai-coach…"
npx supabase functions deploy ai-coach --project-ref "$PROJECT_REF"

echo "Done. Verify with:"
echo "  curl -i -X POST \"https://${PROJECT_REF}.supabase.co/functions/v1/ai-coach\" -H \"Authorization: Bearer <user-jwt>\" -H \"apikey: <publishable-key>\" -H \"Content-Type: application/json\" -d '{\"message\":\"hi\"}'"
