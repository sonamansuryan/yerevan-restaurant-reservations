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

# Make it obvious whether work is on main or on a feature branch.
branch=$(git branch --show-current 2>/dev/null)
if [ -z "$branch" ]; then
  where="no branch (detached HEAD)"
elif [ "$branch" = main ]; then
  where="main"
else
  ahead=$(git rev-list --count main..HEAD 2>/dev/null)
  if [ "$ahead" = 1 ]; then commits="1 commit"; else commits="${ahead:-?} commits"; fi
  where="feature branch $branch ($commits not on main yet)"
fi
# --no-optional-locks: git status must not rewrite even git's own index file.
changed=$(git --no-optional-locks status --short 2>/dev/null | awk '{print $2}' | head -5 | paste -sd, -)

echo "Seghan, where we are ($setup):"
echo "- you are on: $where"
echo "- setup progress: $done of $((done + todo)) steps done"
echo "- next setup step: ${next_step:-none, the setup is complete}"
echo "- next roadmap task (PROJECT_PLAN.md §7): ${next_task:-none}"
echo "- not committed: ${changed:-nothing}"
echo "Explain the next step and wait for explicit approval before changing any file."
