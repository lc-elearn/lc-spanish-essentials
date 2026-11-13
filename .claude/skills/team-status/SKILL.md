---
name: team-status
description: Use when the maintainer asks how the team is doing, "team status", "what's open across the courses", or what is waiting on whom — reads the template and every course repo in the organisation (open issues, open pull requests, recent merges, how far each course is behind the template) and reports one table. Read-only.
---

# Team status

A report for the maintainer: one table of who is waiting on whom, across the template
and every course made from it. It only reads. It never comments, approves, merges,
assigns or closes anything; if the report suggests an action, offer it and wait.

## Steps

1. **Run it from the template.** Check
   [`.claude/skills/README.md` → "Where am I"](../README.md#where-am-i). In a course
   repo, stop: say the report belongs to the maintainer and runs from the template.
   `gh auth status` must succeed; if not, ask the user to sign in (`gh auth login`)
   and stop.
2. **Find the courses** from GitHub, never from memory or a list in this file. The
   organisation is `origin`'s owner:

   ```bash
   ORG=$(gh repo view --json owner --jq .owner.login)
   gh repo list "$ORG" --limit 100 --no-archived --json name,isFork,parent \
     --jq '.[] | select(.parent.name == "lc-base-template") | .name'
   ```

   A course made as a linked copy is not a fork and does not appear. If the user names
   one that is missing, add it by hand.

3. **Collect, per repo** (the template too, without the drift check):

   ```bash
   R="$ORG/<repo>"; SINCE=$(date -v-14d +%F 2>/dev/null || date -d '14 days ago' +%F)
   gh issue list -R "$R" --state open --limit 50 \
     --json number,title,author,assignees,labels,updatedAt
   gh pr list -R "$R" --state open --limit 50 \
     --json number,title,author,isDraft,reviewDecision,mergeStateStatus,statusCheckRollup,updatedAt
   gh pr list -R "$R" --state merged --limit 20 --search "merged:>=$SINCE" \
     --json number,title,author,mergedAt
   ```

   For a pull request whose `mergeStateStatus` is `BLOCKED`, read why:
   `gh pr view <n> -R "$R" --json reviews,reviewRequests`. A dismissed "changes
   requested" with no approval after it still needs a fresh approval.

4. **Measure drift by commit, not by branch.** A cross-fork compare by branch name
   (`main...owner:repo:main`) can wrongly report 0 and 0. Compare the two `main`
   commits inside the course repo instead:

   ```bash
   T=$(gh api "repos/$ORG/lc-base-template/commits/main" --jq .sha)
   C=$(gh api "repos/$ORG/<repo>/commits/main" --jq .sha)
   gh api "repos/$ORG/<repo>/compare/$C...$T" --jq '{behind: .ahead_by, own: .behind_by}'
   ```

   `behind` counts every template commit, docs-only ones included, so say so beside
   the number; an open template-update pull request means the gap is already being
   closed.

5. **Name people by their GitHub profile**, `gh api users/<login> --jq '.name // .login'`,
   and show the login beside it. The register that maps people to courses is kept
   outside the repo; if the user points you to it, use it for display only. Never
   write names into a file in the repo.

6. **Report one table**, a row per repo, template last:
   `Course · author(s) · open issues · open pull requests (CI, review) · waiting on ·
behind template`. Decide **waiting on** like this:
   - a pull request with green CI and no approval: the maintainer, to review;
   - a pull request that is approved or needs no approval, with green CI: the
     maintainer, to merge;
   - a pull request with failing CI or "changes requested": its author;
   - an open "Template update ready" issue with no pull request for it: its assignee,
     who has not started;
   - a template issue with no assignee or reply from the maintainer: the maintainer,
     to triage.

   Below the table, at most three lines: the biggest gaps, then the next actions it
   suggests, each one for the user to choose. If the user wants the report to share,
   offer to publish it as a private page.
