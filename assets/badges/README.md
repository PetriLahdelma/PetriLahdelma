# npm downloads badge

The Rhythmguard downloads badge is generated directly from npm's download API
using `node scripts/update-npm-downloads-badge.mjs`. It needs Node 22 and no
additional packages. Run its tests with `node --test tests/npm-downloads-badge.test.mjs`.

The adjacent JSON records the exact reporting window, count, source URL, and
last successful refresh time. The SVG title contains the exact count and window.
Invalid responses, rate limits, and network failures retain the last successful
SVG and JSON without changing either file. Identical reporting data is a no-op.

The workflow runs daily at 07:23 UTC and can be dispatched manually. Publication
uses the dedicated `codex/profile-badges` branch because `main` requires reviewed
pull requests. That branch contains only badge assets; no personal token or
branch-protection changes are needed. The README loads the published SVG from
that branch, so profile visits never make requests to npm or Shields.io.

The snapshots on `main` seed the publication branch and remain available for
local previews. The publication branch is the current-data source of truth.
Scheduled GitHub Actions can be delayed or disabled by GitHub; if no run occurs,
the previous valid badge stays visible. Inspect the JSON and workflow history
when checking freshness. Public repositories inactive for 60 days may have
scheduled workflows disabled automatically.
