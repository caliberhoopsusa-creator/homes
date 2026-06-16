#!/bin/bash
set -euo pipefail

# SessionStart hook: install workspace dependencies so typecheck and tests work
# in Claude Code on the web. Synchronous (deps guaranteed ready before the agent
# loop starts). Idempotent — safe to run every session.

# Web (remote) sessions only; local sessions manage their own dependencies.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Use the pinned package manager (packageManager: pnpm@10.9.0).
corepack enable >/dev/null 2>&1 || true

# Install all workspace deps. `pnpm install` (not `--frozen`) so the container
# state is cached after the hook completes. Install logs go to stderr so they
# don't flood the session context; errors still surface and a non-zero exit
# fails the hook.
pnpm install --reporter=silent 1>&2

echo "Parcel: pnpm workspace dependencies installed."
