# Running the pipeline on a server

The pipeline runs on a small Linux server with Docker (Ubuntu 24.04, 4 vCPU, 8 GB, shared with other projects).
Everything lives in `/srv/sponsored`; nothing is published to the internet.

| What                                                                                                     | Where                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Code (a copy of this repo)                                                                               | `/srv/sponsored/src`                                |
| Compose project `sponsored`: Postgres 18 (`db`, 768 MB cap) and the `pipeline` image (1 GB, 1.5 CPU cap) | `/srv/sponsored/compose.yml`                        |
| Database password, made once by the deploy                                                               | `/srv/sponsored/.env` (mode 600, never in git)      |
| Files the pipeline may read (seed lists)                                                                 | `/srv/sponsored/data`, mounted read-only at `/data` |

## Deploy

```sh
DEPLOY_HOST=<ssh alias> deploy/deploy.sh
```

It copies the code, builds the image, starts Postgres, applies migrations and installs the timers. Safe to run
again.

## Schedule (systemd timers, UTC)

| Timer                 | When                 | Runs                                                                   |
| --------------------- | -------------------- | ---------------------------------------------------------------------- |
| `sponsored-ingest`    | every 6 hours at :20 | `ingest`: reads the boards that are due                                |
| `sponsored-registers` | daily 03:40          | `registers`: reloads the IND and UK registers, then matches companies  |
| `sponsored-discover`  | Sundays 01:10        | `discover`: finds new boards in Common Crawl                           |
| `sponsored-backup`    | daily 02:50          | `deploy/backup.sh`: `pg_dump` to `/srv/sponsored/backups`, kept 7 days |
| `sponsored-digest`    | daily 06:00          | `deploy/digest.sh`: the morning summary on Telegram                    |

`Persistent=true` starts a run missed while the server was down as soon as it's back. systemd never starts a unit
that's still running, so runs can't overlap.

## Alerts

A unit that fails starts `sponsored-alert@<unit>`, which sends its last log lines to the owner on Telegram
(`deploy/alert.sh`). An ingest run also fails, after saving everything, when half or more of a board type's boards
failed (10 or more read). The bot token and chat id go in `/srv/sponsored/.env`, set by the owner:

```sh
TELEGRAM_BOT_TOKEN=…   # from @BotFather
TELEGRAM_CHAT_ID=…     # your chat with the bot: send it a message, then open
                       # https://api.telegram.org/bot<token>/getUpdates and copy message.chat.id
```

Test with `systemctl start sponsored-alert@test.service`. Without the two values the alert is only logged.

Every morning `sponsored-digest` sends a summary of the last 24 hours: runs, board reads, new and closed roles,
the registers, the backup and the disk. Problems come first under ⚠️; a normal day starts with ✅. No message at
all means the server is down. Send one now with `systemctl start sponsored-digest`.

## Everyday commands (on the server)

```sh
cd /srv/sponsored
systemctl list-timers 'sponsored-*'                       # next and last runs
journalctl -u sponsored-ingest -n 50                      # a run's output
docker compose run --rm pipeline report                   # the numbers
docker compose run --rm pipeline ingest ashby:someco      # read one board now
docker compose exec db psql -U sponsored                  # SQL
systemctl start sponsored-ingest                          # run now
```
