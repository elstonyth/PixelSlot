# serve-standalone.ps1 — serve the production storefront from the standalone bundle.
#
# WHY this exists: next.config.ts sets `output: 'standalone'`, which makes
# `npx next start` unusable (it errors / serves a stripped app). The standalone
# server is `.next/standalone/server.js`, but Next does NOT copy the static
# assets or `public/` into that dir — you must copy them yourself, or every
# /_next/static asset and public image 404s. This script does the copy and boots
# the server on the given port (default 4000, the verify port from CLAUDE.md).
#
#   npm run build              # first — emits .next/standalone
#   pwsh scripts/serve-standalone.ps1 [-Port 4000]
#
# Reads NEXT_PUBLIC_* from .env.local at BUILD time (already baked in), so just
# run after a build. Backend must be up on :9000 for card images to resolve.

param([int]$Port = 4000)

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $PSScriptRoot
$STANDALONE = Join-Path $ROOT '.next\standalone'

if (-not (Test-Path (Join-Path $STANDALONE 'server.js'))) {
    throw "No .next/standalone/server.js -- run 'npm run build' first (output: standalone)."
}

# Next emits the standalone server but leaves these for you to copy.
Copy-Item -Recurse -Force (Join-Path $ROOT '.next\static') (Join-Path $STANDALONE '.next\static')
if (Test-Path (Join-Path $ROOT 'public')) {
    Copy-Item -Recurse -Force (Join-Path $ROOT 'public') (Join-Path $STANDALONE 'public')
}

$env:PORT = "$Port"
$env:HOSTNAME = '127.0.0.1'
Write-Host "[serve-standalone] http://localhost:$Port (Ctrl+C to stop)"
node (Join-Path $STANDALONE 'server.js')
