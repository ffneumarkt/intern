#!/usr/bin/env bash
# Merges the open pull requests of trusted authors whose head commit SHA has every check finished and
# green. Called by .github/workflows/automerge.yml after any CI workflow completes; it never runs code
# from the pull request, it only reads the GitHub API and merges.
#
# Environment: GH_TOKEN, GH_REPO (owner/name), SHA (head commit that just finished a workflow),
# AUTHORS (space separated logins whose pull requests merge themselves), DRY_RUN=1 (print, do not merge).
set -euo pipefail

: "${GH_REPO:?}" "${SHA:?}" "${AUTHORS:?}"
export SHA

say() { printf '%s\n' "$*"; }

# Open pull requests whose head is exactly this commit (a newer push makes this run stale).
prs=$(gh api "repos/$GH_REPO/commits/$SHA/pulls" \
  --jq '.[] | select(.state == "open" and .base.ref == "main" and .head.sha == env.SHA) | .number')

if [[ -z "$prs" ]]; then
  say "No open pull request has $SHA as its head."
  exit 0
fi

for pr in $prs; do
  info=$(gh api "repos/$GH_REPO/pulls/$pr" --jq '[.user.login, .draft, .head.repo.full_name, ([.labels[].name] | join(","))] | @tsv')
  IFS=$'\t' read -r author draft head_repo labels <<<"$info"

  if [[ " $AUTHORS " != *" $author "* ]]; then
    say "#$pr: opened by $author, who is not on the list; merge it by hand."
    continue
  fi
  if [[ "$head_repo" != "$GH_REPO" ]]; then
    say "#$pr: comes from a fork; merge it by hand."
    continue
  fi
  if [[ "$draft" == "true" ]]; then
    say "#$pr: is a draft."
    continue
  fi
  if [[ ",$labels," == *",no-automerge,"* ]]; then
    say "#$pr: has the no-automerge label."
    continue
  fi

  # Every check on this commit has to be finished and green. Workflows that a pull request does not
  # trigger (path filters) create no checks, so only the ones that ran count.
  # Read into a variable first: a failed API call (a missing permission, a 403) must stop the script, not
  # look like "no checks" (a process substitution would swallow it).
  runs=$(gh api "repos/$GH_REPO/commits/$SHA/check-runs?per_page=100" --paginate \
    --jq '.check_runs[] | [.name, .status, (.conclusion // "")] | @tsv')
  pending=0
  red=0
  green=0
  while IFS=$'\t' read -r name status conclusion; do
    [[ -n "$name" ]] || continue
    if [[ "$status" != "completed" ]]; then
      say "#$pr: $name is still $status."
      pending=1
    elif [[ "$conclusion" == "success" ]]; then
      green=$((green + 1))
    elif [[ "$conclusion" == "skipped" || "$conclusion" == "neutral" ]]; then
      :
    else
      say "#$pr: $name ended as $conclusion."
      red=1
    fi
  done <<<"$runs"

  if ((pending)); then
    say "#$pr: waiting for the other checks; the next workflow to finish tries again."
    continue
  fi
  if ((red)); then
    say "#$pr: a check is not green."
    continue
  fi
  if ((green == 0)); then
    say "#$pr: no check ran (a docs-only change starts none); merge it by hand."
    continue
  fi

  # The built-in token may not change workflow files, so those pull requests stay manual.
  files=$(gh api "repos/$GH_REPO/pulls/$pr/files" --paginate --jq '.[].filename')
  if grep -q '^\.github/workflows/' <<<"$files"; then
    say "#$pr: changes workflow files, which the built-in token cannot merge; merge it by hand."
    continue
  fi

  if [[ "${DRY_RUN:-}" == "1" ]]; then
    say "#$pr: would merge ($green checks green)."
    continue
  fi

  # --match-head-commit refuses to merge if the branch moved after the checks started.
  if ! out=$(gh pr merge "$pr" --merge --match-head-commit "$SHA" 2>&1); then
    say "::warning::#$pr was not merged: $out"
    continue
  fi
  say "#$pr: merged ($green checks green)."

  # A merge made with the built-in token does not start the push workflows, so the image of main is
  # built here. Documentation-only changes need no new image (same rule as image.yml).
  if grep -qvE '^docs/|^LICENSE$|\.md$' <<<"$files"; then
    gh workflow run image.yml --ref main
    say "#$pr: started the image build for main."
  fi
done
