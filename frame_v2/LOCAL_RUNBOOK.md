# Frame V2: Linux Local Runbook

This guide runs Frame V2 locally with Docker Compose. It starts only the
application, PostgreSQL, and Redis; it does not start the bundled Jenkins or
Ansible services.

## What runs

| Service | Purpose | Host access |
| --- | --- | --- |
| `web` | Flask application | `http://localhost:5001` |
| `postgres` | Document, highlight, and music-track metadata | `localhost:5432` (currently published on all interfaces) |
| `redis` | Document-list and document-content cache | `localhost:6379` (currently published on all interfaces) |

The current compose file publishes PostgreSQL on `5432` and Redis on `6379` as
well as the web application on `5001`. On a shared or network-accessible
machine, remove those database/cache port mappings or bind them to `127.0.0.1`.

## Prerequisites

* Docker Engine and Docker Compose v2
* Your shell user must be able to run `docker ps` without `sudo`

If Docker reports permission denied for `/var/run/docker.sock`, add your user to
the Docker group and start a new desktop/login session:

```bash
sudo usermod -aG docker "$USER"
```

## Start the local stack

From the project directory:

```bash
docker compose up -d --build postgres redis web
docker compose ps
```

Wait until PostgreSQL reports `healthy`, then verify the app:

```bash
curl -fsS http://localhost:5001/list
```

An empty JSON list (`[]`) is the expected result for a new database. Open the
application at `http://localhost:5001`.

## Local-network access

Docker publishes the web service on `0.0.0.0:5001`, so it can accept connections
from other devices on the same LAN. Find this computer's LAN address, then open
`http://<LAN-IP>:5001` from the other device:

```bash
hostname -I
```

To allow only a typical `192.168.1.x` LAN through UFW, use:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 5001 proto tcp
sudo ufw status
```

On the initial Linux setup, this rule was added successfully and `ufw status`
reported `inactive`. An inactive UFW does not block port `5001`, but it also
does not enforce the subnet restriction. If UFW is enabled later, verify the
rule remains present before relying on LAN access.

Keep access to the local network only. Frame has no login or token validation,
so this port must not be forwarded by a router or exposed directly to the public
internet.

## Daily commands

```bash
# Follow application logs
docker compose logs -f web

# Show status for the three local services
docker compose ps postgres redis web

# Stop while retaining notes and database data
docker compose stop postgres redis web

# Start again without rebuilding
docker compose start postgres redis web

# Rebuild after editing Python, templates, or static assets
docker compose up -d --build postgres redis web

# Stop and remove containers and network, retaining volumes
docker compose down
```

## Data and persistence

* PostgreSQL data is stored in the Docker-managed `postgres_data` volume.
* Uploaded media and generated artwork are stored in the project `data/`
  directory, mounted at `/app/data`.
* Redis persistence is stored in `redis-data/`.

Do not run `docker compose down -v` unless you deliberately want to delete the
PostgreSQL volume. Back up data before resetting the stack.

## First-run verification and troubleshooting

The first build downloads images and Python packages, so it can take a minute.
If a request resets or the app does not open, use this sequence:

```bash
docker compose ps
docker compose logs --tail=200 web
docker compose logs --tail=100 postgres
curl -v http://localhost:5001/list
```

Useful interpretations:

* `web` restarting or exited: the `web` logs contain the Python startup error.
* PostgreSQL not healthy: inspect its logs before restarting `web`.
* `port is already allocated`: change the relevant host port in
  `docker-compose.yml`, then run the start command again.
* `curl: (56) Recv failure: Connection reset by peer`: the process accepted a
  connection and then closed it; collect `web` logs above to identify why.

The initial Linux build on 2026-09-07 completed successfully and created the
`web`, `postgres`, and `redis` containers. The immediate `curl /list` probe
returned a connection reset while the web container had just started, so a
follow-up log check is required before treating that deployment as healthy.

## Security notes

This is a trusted-local-network setup, not a multi-user deployment:

* Frame has no application login, user session, or API-token validation.
* The Compose file currently uses the development database password
  `notepad`/`notepad`.
* The existing `jenkins` service has access to the Docker socket, and the
  `ansible` service mounts the host SSH directory. They are intentionally not
  included in the local start command.
* The current Compose stack serves HTTP directly; the repository's historical
  Nginx/HTTPS documentation does not describe this active Compose setup.

Do not expose port `5001` to an untrusted network without adding authentication,
changing service credentials, and putting the app behind properly configured
HTTPS.

## Optional full stack

Only start Jenkins or Ansible after reviewing their credential and host-access
requirements. The safe default is the three-service command in this guide.
