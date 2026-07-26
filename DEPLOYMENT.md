# UniMap Deployment

UniMap is a static site. Deployment should remain a direct publish of the repository root unless the architecture is intentionally changed.

## Deployment assumptions

- No build command
- No generated output directory
- No runtime secrets
- No backend service
- No database
- No environment variables
- Site entry point: `index.html`
- Data file: `celestial-bodies.json`

## Pre-deployment checks

From the repository root:

1. Confirm the intended branch and clean working tree.
2. Start a local static server:

   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000`.
4. Confirm the page and catalogue load without console errors.
5. Validate:
   - initial result list;
   - partial-name search;
   - each category filter;
   - no-results state;
   - Clear Search;
   - detail view;
   - Back navigation;
   - keyboard navigation;
   - narrow mobile layout.
6. Confirm `celestial-bodies.json` is valid JSON.
7. Confirm changed documentation matches actual behavior.

## Preferred initial deployment: GitHub Pages

Before enabling Pages, confirm which branch should be the stable production branch. The repository currently uses `claude/unimap-static-app-uj0ql5` as its default branch; do not assume that is the intended permanent production branch.

Once the branch strategy is confirmed:

1. Open repository **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the approved production branch.
5. Select the root folder `/`.
6. Save.
7. Wait for GitHub Pages to report a successful deployment.
8. Open the published URL and repeat the smoke checks.

No GitHub Actions workflow is required for branch-based Pages deployment.

## Cloudflare Pages alternative

- Connect `asktheeightball/unimap`.
- Select the approved production branch.
- Framework preset: none.
- Build command: leave empty.
- Build output directory: repository root (`/`) or the platform equivalent.
- Environment variables: none.

## Netlify alternative

- Connect the repository.
- Select the approved production branch.
- Build command: leave empty.
- Publish directory: repository root (`.` or `/`, according to the UI).
- Environment variables: none.

## Post-deployment verification

Verify on the public URL:

- CSS and JavaScript return HTTP 200;
- `celestial-bodies.json` returns HTTP 200;
- search and filters work;
- details open and close;
- refresh works at the root URL;
- mobile layout is usable;
- no mixed-content, CORS, or console errors appear.

## Rollback

Because the site is static, rollback means redeploying a known-good commit or moving the production branch back to that commit.

Recommended rollback procedure:

1. Identify the last known-good commit.
2. Prefer reverting the faulty commit with a new commit rather than force-pushing shared history.
3. Push the revert to the production branch.
4. Confirm the hosting provider redeploys.
5. Repeat the post-deployment verification.
6. Record the incident and rollback in `HANDOFF.md`.

## Deployment record

After each production deployment, update `HANDOFF.md` with:

- deployment date and time;
- branch and commit SHA;
- hosting provider;
- public URL;
- checks performed;
- result;
- rollback commit, if any.

## Guardrails

- Never commit credentials or tokens.
- Do not add a build pipeline solely for static deployment.
- Do not change hosting providers without documenting the reason.
- Do not deploy uncommitted local files.
- Do not deploy from a feature branch unless it is intentionally serving as production.
