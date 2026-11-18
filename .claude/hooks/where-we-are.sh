#!/bin/sh
# Session-start summary: where the agreed plan stands and what comes next.
# Read-only on purpose: it reads the two plan files and git's state, and never changes a file,
# runs a project task or decides anything. Claude explains the next step and waits for approval.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
setup=.claude/plans/SETUP_PLAN.md
done=$(grep -c '^- \[x\]' "$setup" 2>/dev/null); done=${done:-0}
todo=$(grep -c '^- \[ \]' "$setup" 2>/dev/null); todo=${todo:-0}
next_step=$(grep -m1 '^- \[ \]' "$setup" 2>/dev/null | sed 's/^- \[ \] //' | cut -c1-150)
next_task=$(grep -m1 '^- \[ \]' .claude/plans/PROJECT_PLAN.md 2>/dev/null | sed 's/^- \[ \] //' | cut -c1-150)

# Make it obvious whether work is on main or on a feature branch. PRs are merged on GitHub, so the
# local main falls behind: compare with origin/main instead, as git last fetched it. The hook never
# fetches, so it stays read-only and offline. Without a remote, the local main is all there is.
if git rev-parse --verify --quiet refs/remotes/origin/main >/dev/null 2>&1; then
  base=origin/main
  as_of=", as of the last fetch"
else
  base=main
  as_of=""
fi
plural() { if [ "$1" = 1 ]; then echo "1 commit"; else echo "${1:-?} commits"; fi; }
branch=$(git branch --show-current 2>/dev/null)
if [ -z "$branch" ]; then
  where="no branch (detached HEAD)"
elif [ "$branch" = main ]; then
  where="main"
else
  ahead=$(git rev-list --count "$base..HEAD" 2>/dev/null)
  where="feature branch $branch ($(plural "$ahead") not on $base yet$as_of)"
fi
# Merges on GitHub reach the local main only when it's fast-forwarded, so say when it lags.
behind=""
if [ "$base" = origin/main ]; then
  lag=$(git rev-list --count main..origin/main 2>/dev/null)
  if [ -n "$lag" ] && [ "$lag" -gt 0 ]; then
    behind="local main is $(plural "$lag") behind origin/main$as_of"
  fi
fi
# --no-optional-locks: git status must not rewrite even git's own index file.
changed=$(git --no-optional-locks status --short 2>/dev/null | awk '{print $2}' | head -5 | paste -sd, -)

echo "Seghan, where we are ($setup):"
echo "- you are on: $where"
if [ -n "$behind" ]; then echo "- $behind"; fi
echo "- setup progress: $done of $((done + todo)) steps done"
echo "- next setup step: ${next_step:-none, the setup is complete}"
echo "- next roadmap task (PROJECT_PLAN.md §7): ${next_task:-none}"
echo "- not committed: ${changed:-nothing}"
echo "Explain the next step and wait for explicit approval before changing any file."
