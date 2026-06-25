#!/bin/zsh
cd "$(dirname "$0")"

export PATH="/Users/lucasiotti/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
export WATCHPACK_POLLING=true

./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3000
