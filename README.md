# anvaya-org

Landing site for **Anvaya**, served at [org.anvaya.one](https://org.anvaya.one).

## Stack

A minimal static site (`index.html` + `styles.css`) deployed to **GitHub Pages**.

## Deployment

Deployment is automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- Every push to `main` (or a manual `workflow_dispatch`) builds and publishes the
  repository root to GitHub Pages.
- The custom domain is configured by the [`CNAME`](CNAME) file (`org.anvaya.one`).

### One-time setup

1. In the repo's **Settings → Pages**, set the build source to **GitHub Actions**.
2. Point the DNS for `org.anvaya.one` at GitHub Pages:
   - a `CNAME` record → `<owner>.github.io`, or
   - the GitHub Pages `A`/`AAAA` apex records if using an apex domain.
3. Once DNS resolves, enable **Enforce HTTPS** in Settings → Pages.

## Local preview

Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```
