# anvaya-org

Landing site for **Anvaya**, served at [org.anvaya.one](https://org.anvaya.one)
from our own server (`192.248.147.205`).

## Stack

A minimal static site (`public/index.html` + `public/styles.css`). Everything
inside `public/` is what gets published to the web root.

## Deployment

Deployment is automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- On every push to `main` (or a manual `workflow_dispatch`), the workflow opens
  an SSH connection to the server and `rsync`s the contents of `public/` into the
  site's web root.
- `rsync --delete` keeps the web root an exact mirror of `public/`, so
  **`DEPLOY_PATH` must point at the dedicated web root for `org.anvaya.one`**
  (anything else in that directory will be removed).

### Required repository configuration

Set these under **Settings → Secrets and variables → Actions**.

**Secrets:**

| Name              | Value                                                        |
|-------------------|-------------------------------------------------------------|
| `SSH_HOST`        | `192.248.147.205`                                           |
| `SSH_USER`        | SSH user that owns the web root                             |
| `SSH_PRIVATE_KEY` | Private key whose public key is in that user's `authorized_keys` |
| `SSH_PORT`        | *(optional)* SSH port; defaults to `22` if unset           |

**Variables:**

| Name          | Value                                                  |
|---------------|--------------------------------------------------------|
| `DEPLOY_PATH` | Absolute web root for the vhost, e.g. `/var/www/org.anvaya.one/html` |

### DNS

`org.anvaya.one` is an `A` record → `192.248.147.205` (the server). No GitHub
Pages / CNAME involved.

## Local preview

```sh
cd public && python3 -m http.server 8000
# then visit http://localhost:8000
```
