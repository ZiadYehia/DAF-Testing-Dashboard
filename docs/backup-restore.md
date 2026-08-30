# Database backup and restore

This document explains how the nightly backup job works, how to set it up on a fresh EC2 host, and how to restore the database if it's ever needed.

## What is covered

The MSSQL database `TestingDashboard` is the single source of truth for all QA content (features, test cases, execution history, bugs, knowledge, requirements, stories, the app/module registries) plus auth users and sessions, application settings, and app logos. The nightly job backs it up with a `.bak` file, as before.

It also tars up `data/` — the binary assets (screenshots, bug attachments) that live on disk with metadata rows in the database — and uploads that alongside the `.bak` file. This used to be unnecessary because `data/` was a git-tracked bind mount and git itself was the recovery path, but that's no longer a safe assumption: this repo can be public, and binaries aren't reliably committed to it. The `data/` tarball is the real recovery path for those files now; don't rely on git history for them.

`automation-hub/` is still git-tracked and still recovered via `git checkout` / a clone of the remote — it holds authoring config and page objects, not QA content or binaries, so it isn't part of this backup job.

## One-time EC2 setup

Run these steps once on the EC2 host, before the first scheduled backup:

1. Create the local staging directory and give it to the MSSQL container's user (the official image runs as uid `10001`, group `0`):
   ```bash
   mkdir -p backups && sudo chown 10001:0 backups && chmod 770 backups
   ```
2. Apply the new bind mount by restarting the `db` service:
   ```bash
   docker compose up -d db
   ```
3. Create an S3 bucket to receive the backups. Turn on "Block all public access", use default SSE-S3 encryption, and optionally enable versioning for extra protection against accidental overwrites.
4. Add lifecycle rules scoped to both the `mssql/` and `data/` prefixes that expire objects after 30 days. If you want cheaper long-term storage, you can also add a transition to Glacier Instant Retrieval at 7 days before the 30-day expiration.
5. Set up IAM access for the upload step. The preferred approach is to attach an instance role to the EC2 host with a policy that allows `s3:PutObject` on `arn:aws:s3:::YOUR_BUCKET/mssql/*` and `arn:aws:s3:::YOUR_BUCKET/data/*` — this avoids putting long-lived credentials on disk. If an instance role isn't practical, you can instead set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`, and the AWS CLI will pick them up automatically.
6. Add the bucket name (and optionally custom prefixes) to `.env`:
   ```
   BACKUP_S3_BUCKET=your-bucket
   BACKUP_S3_PREFIX=mssql
   BACKUP_S3_DATA_PREFIX=data
   ```
7. Test the script manually before relying on cron:
   ```bash
   bash scripts/backup-db.sh
   ```
   You should see a `.bak` file and a `data_*.tar.gz` file appear both in `./backups` on the host and under the `mssql/` and `data/` prefixes in the S3 bucket, respectively.

## Cron

Add a crontab entry on the EC2 host to run the backup every night. For example, to run at 3:15 AM UTC:

```
15 3 * * * flock -n /tmp/tdash-backup.lock /home/ubuntu/General-Testing-Dashboard/scripts/backup-db.sh >> /var/log/tdash-backup.log 2>&1
```

Adjust the repo path to match where the project actually lives on your host, and make sure the entry runs as a user that can reach the Docker daemon (a member of the `docker` group, or root). The `flock` wrapper prevents overlapping runs if a backup ever takes longer than expected. Note that `/var/log/tdash-backup.log` needs to be writable by the cron user — if it isn't, either `sudo touch` and `chown` it first, or point the redirect at a path the user does own, such as `/home/ubuntu/tdash-backup.log`.

## Restore procedure

This is destructive — it replaces the live database (and, if you also restore `data/`, the on-disk binaries) with the contents of the backup files, so make sure you're restoring the right files before running these commands.

### Database

```bash
aws s3 cp s3://YOUR_BUCKET/mssql/FILE.bak ./backups/
docker compose stop app
docker exec testing-dashboard-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$DB_PASSWORD" -C -b -Q "ALTER DATABASE [TestingDashboard] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE [TestingDashboard] FROM DISK = N'/var/opt/mssql/backups/FILE.bak' WITH REPLACE; ALTER DATABASE [TestingDashboard] SET MULTI_USER;"
docker compose start app
```

Steps, in order: pull the desired backup file down from S3 into the local `backups/` staging directory (skip this if you're restoring from a file that's already there); stop the `app` service so nothing is writing to the database mid-restore; run the restore itself, which forces the database into single-user mode, replaces it with the backup, and then puts it back into multi-user mode; and finally bring the app back up.

### `data/` (binary assets)

Restore this whenever the on-disk screenshots/attachments are missing or out of sync with the database rows that reference them — e.g. after provisioning a new host, or recovering from disk loss:

```bash
aws s3 cp s3://YOUR_BUCKET/data/data_TIMESTAMP.tar.gz ./backups/
tar -xzf ./backups/data_TIMESTAMP.tar.gz -C /home/ubuntu/General-Testing-Dashboard
docker compose restart app
```

Pull the desired `data_*.tar.gz` down from S3; extract it over the repo directory (it archives the `data/` folder relative to the repo root, so `-C` should point at the repo root, not into `data/` itself) — existing files are overwritten, nothing already on disk but absent from the tarball is removed; then restart `app` so it picks up the refreshed files. This does not touch the database — pair it with the database restore above if both are out of sync, running the database step first.

## Verification

The nightly script already runs `RESTORE VERIFYONLY WITH CHECKSUM` against every backup it takes, which confirms the backup file is structurally valid and not corrupted — but it does not prove the backup can actually be restored into a working database. It's worth doing a full restore drill at least once: restore the backup into a scratch database with a different name using `RESTORE DATABASE ... WITH MOVE` to redirect the data and log files, then spot-check that the data looks right, and drop the scratch database afterward. This gives you real confidence in the restore path without touching the live database.

There's no analogous integrity check for the `data/` tarball beyond tar's own error reporting on extraction, so a periodic `tar -tzf data_*.tar.gz` (list-only, no extraction) against the latest upload is a cheap sanity check that it isn't truncated or corrupted.
