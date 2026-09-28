# ixiscope API

Real data for ixiscope, served by the existing explorer server.

ixiscope is a static site: it has no server code of its own. This folder is
the small read-only API it talks to. It runs next to the current explorer,
reads the explorer's database with the explorer's own `config.php`, and uses
the files the explorer's cron jobs already write. It never writes to the
database.

The existing explorer keeps doing the real work: `internal/sync.php`,
`fetchstatus.php` and `updatetxstats.php` keep the database and caches up to
date, exactly as today.

## Install (about 15 minutes)

Requirements: the running explorer (PHP 7.4 or newer, `pdo_mysql`, `curl`,
`zlib`). Nothing to install with composer: the one library it needs (the
MaxMind DB reader, Apache 2.0) is in `vendor/`.

1. **Deploy the explorer as usual.** This folder sits in its web root, next
   to `index.php`, so after deploying it is at `/ixiscope-api/`.

   Check it: `https://<explorer host>/ixiscope-api/index.php?p=/status` should
   return JSON with the current block height.

2. **Allow ixiscope's address** (only if ixiscope is served from a different
   host than the explorer). In `settings.php`:

   ```php
   $ixiscope_origins = [
       "https://ixiscope.ixian.io",
   ];
   ```

3. **Let the web server write its cache.** It keeps computed answers
   (statistics, top addresses, the TPS record) in `cache/ixiscope/` under the
   explorer's `cache` folder. If that isn't writable it falls back to the
   system temp folder, which also works.

   ```
   mkdir -p /var/www/html/cache/ixiscope /var/www/html/cache/geo
   chown -R www-data /var/www/html/cache/ixiscope /var/www/html/cache/geo
   ```

4. **Add the node map job** to the same crontab as the explorer's jobs. It
   asks the explorer's DLT node for its presence list, places each DLT and S2
   node in a city and writes `cache/ixiscope-nodes.json`:

   ```
   0-59/5 * * * * cd /var/www/html/ixiscope-api && /usr/bin/php nodes.php > /dev/null
   ```

   It uses the same node and connection mode (http or ssh) as `sync.php`. The
   first run downloads the free DB-IP City Lite database (about 130 MB) into
   `cache/geo/` and refreshes it monthly. To use MaxMind GeoLite2-City instead,
   put that `.mmdb` file at `cache/geo/city.mmdb`. Until this job has run once,
   ixiscope shows node counts and versions without the map.

5. **Optional, once:** compute the all-time TPS record now instead of over the
   first few requests:

   ```
   cd /var/www/html/ixiscope-api && php index.php warm
   ```

6. **Build ixiscope for live data** (in `web/`):

   ```
   cd web
   NEXT_PUBLIC_IXISCOPE_SOURCE=api \
   NEXT_PUBLIC_IXISCOPE_API=https://<explorer host>/ixiscope-api \
   npm ci && npm run build
   ```

   Upload `web/out/` to any static host (or the explorer's web server). The
   "Demo data" marks disappear in this build. Without those two settings, the
   build shows generated demo data, as today.

After that the old PHP pages can stay as they are, be switched off, or
redirect to ixiscope. The API needs them only for `config.php`,
`wallets.php` and the cron jobs.

## What it serves

Every call is `GET index.php?p=<path>` (no URL rewriting needed). Answers
are in the shapes of `web/src/data/types.ts`.

| Path | From | Cached |
| --- | --- | --- |
| `/status` | `ixi_nodestats` (latest), `ixi_blocks` (latest), `cache/tx.ixi` | TPS record kept in cache |
| `/blocks?before=&limit=` | `ixi_blocks` by height | no |
| `/blocks/latest`, `/blocks/{height}` | `ixi_blocks` | no |
| `/blocks/hash/{blockChecksum}` | `ixi_blocks` (indexed) | no |
| `/blocks/slowest?from=&to=&page=&size=` | `ixi_blocks`, up to 100,000 blocks | no |
| `/blocks/{height}/transactions?page=&size=&type=` | `ixi_transactions.applied` | no |
| `/transactions/recent?limit=` | `ixi_transactions` | no |
| `/transactions/{txid}` | `ixi_transactions` | no |
| `/addresses/top?limit=` | `ixi_addresses` | 10 min |
| `/addresses/{address}` | `ixi_addresses`, `ixi_txidx` | 1 min |
| `/addresses/{address}/transactions?page=&size=&sort=time\|amount&dir=` | `ixi_txidx` + `ixi_transactions` | no |
| `/addresses/{address}/balance?range=` | current balance minus later changes | 30 s to 10 min |
| `/stats/{metric}?range=24h\|7d\|30d\|90d` | one pass over the range's blocks, or `ixi_nodestats` | 30 s to 10 min |
| `/nodes` | `cache/ixiscope-nodes.json` from `nodes.php`; 204 until it exists | 1 min |
| `/nodes/versions` | `cache/nodes.ixi` (written by `sync.php`) | 1 min |

Metrics: `tx`, `tps`, `blocktime`, `signerDifficulty`, `requiredDifficulty`,
`hashrate` (total signer difficulty / 900, as the explorer computes it),
`signatures`, `sigRequired`, `nodesDlt`, `nodesS2`, `supply`, `emission`.

Errors are `{"error": "...", "message": "..."}` with status 400, 404 or 500.

Test from the command line without a browser:

```
php index.php /blocks/latest
php index.php "/stats/tx?range=7d"
```

## Speed

Tested on a copy of the explorer schema with 270,000 blocks, 1.35 million
transactions and 3 million address-index rows: blocks, transactions,
addresses and block pages answer in 30 to 130 ms; a 90-day statistic takes
under a second the first time and is then served from the cache. Lookups go
through the explorer's existing indexes, so a larger chain doesn't slow them
down; statistics only read the blocks of the chosen range.

## Privacy

`nodes.php` reads node IPs on the server only, looks them up in a local
file, and writes city, country and a slightly offset position. No IP, port
or wallet address is written, served or sent to any third party. The node id
is a short hash. ixiscope's Network page credits DB-IP ("IP geolocation by
DB-IP"), as its free licence (CC BY 4.0) asks.

## Files

- `index.php`: the API.
- `nodes.php`: the node map job (command line only).
- `settings.php`: allowed origins, cache folder, node list file.
- `vendor/MaxMind/`: MaxMind DB reader 1.x (Apache 2.0), for `.mmdb` files.
- `.htaccess`: only `index.php` answers the web.
