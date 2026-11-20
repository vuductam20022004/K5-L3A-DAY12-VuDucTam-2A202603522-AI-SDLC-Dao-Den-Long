#!/usr/bin/env bash
# Wrapper cho macOS/Linux. Logic thật nằm trong verify.mjs (chạy được
# trên Windows, macOS và Linux).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/verify.mjs "$@"
