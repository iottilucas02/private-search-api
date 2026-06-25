#!/bin/zsh
cd "$(dirname "$0")"

export PATH="/Users/lucasiotti/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"

node scripts/local-worker.mjs
