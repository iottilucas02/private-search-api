#!/bin/zsh
cd "$(dirname "$0")"

export PATH="/Users/lucasiotti/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/lucasiotti/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH"
export TRIGGER_PROJECT_REF="proj_wprkfwzuaonbokhfsktk"

pnpm dlx trigger.dev@latest deploy
