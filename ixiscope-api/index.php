<?php
/*
 * ixiscope API
 * ------------------------------------------------------------------------
 * A read-only JSON API over the Ixian explorer's own database, in the exact
 * shapes ixiscope uses (web/src/data/types.ts).
 *
 * It lives in the explorer's web root, next to index.php, and uses
 * the explorer's config.php for the database, and the files the explorer's
 * cron jobs already write (cache/tx.ixi, cache/nodes.ixi). Nothing here
 * writes to the database.
 *
 * Every call is GET index.php?p=<path>, so no URL rewriting is needed:
 *   /status
 *   /blocks?before=&limit=               newest first
 *   /blocks/latest
 *   /blocks/{height}
 *   /blocks/hash/{blockChecksum}
 *   /blocks/slowest?from=&to=&page=&size=
 *   /blocks/{height}/transactions?page=&size=&type=
 *   /transactions/recent?limit=
 *   /transactions/{txid}
 *   /addresses/top?limit=
 *   /addresses/{address}
 *   /addresses/{address}/transactions?page=&size=&sort=time|amount&dir=desc|asc
 *   /addresses/{address}/balance?range=24h|7d|30d|90d
 *   /stats/{metric}?range=24h|7d|30d|90d
 *   /nodes                               204 (no content) until nodes.php has run
 *   /nodes/versions
 *
 * Errors: {"error": "not_found" | "bad_request" | "server_error", "message": "..."}
 * with status 404, 400 or 500.
 *
 * From the command line, `php index.php warm` computes the all-time TPS
 * record once (otherwise it is built up over the first requests).
 * ------------------------------------------------------------------------
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '0');
date_default_timezone_set('UTC');

$ixiscope_cli = PHP_SAPI === 'cli';
if ($ixiscope_cli) {
    chdir(__DIR__);
}

require __DIR__ . '/../config.php';
if (is_file(__DIR__ . '/../wallets.php')) {
    require __DIR__ . '/../wallets.php';
}
require __DIR__ . '/settings.php';

if (!isset($known_wallets) || !is_array($known_wallets)) {
    $known_wallets = [];
}

const RANGES = [
    '24h' => [600, 144],
    '7d' => [3600, 168],
    '30d' => [21600, 120],
    '90d' => [86400, 90],
];
const METRICS = ['tx', 'tps', 'nodesDlt', 'nodesS2', 'supply', 'emission', 'blocktime', 'signerDifficulty', 'requiredDifficulty', 'hashrate', 'signatures', 'sigRequired'];
/* the old explorer's signer hashrate estimate: total signer difficulty over 900 s (30 blocks) */
const HASHRATE_WINDOW = 900;

/* ---------------------------------------------------------------- output */

function send($data, int $maxAge = 5): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . $maxAge);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function fail(int $status, string $error, string $message = ''): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => $error, 'message' => $message]);
    exit;
}

function cors(): void
{
    global $ixiscope_origins;
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $ixiscope_origins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        fail(400, 'bad_request', 'Only GET is supported.');
    }
}

/* ---------------------------------------------------------------- database */

function pdo(): PDO
{
    static $pdo = null;
    global $db_host, $db_name, $db_user, $db_pass;
    if ($pdo === null) {
        try {
            $pdo = new PDO('mysql:host=' . $db_host . ';dbname=' . $db_name . ';charset=utf8', $db_user, $db_pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            fail(500, 'server_error', 'The database is not reachable.');
        }
    }
    return $pdo;
}

function rows(string $sql, array $args = []): array
{
    $st = pdo()->prepare($sql);
    $st->execute($args);
    return $st->fetchAll();
}

function row(string $sql, array $args = []): ?array
{
    $r = rows($sql, $args);
    return $r[0] ?? null;
}

/* ---------------------------------------------------------------- cache */

function cache_dir(): string
{
    global $ixiscope_cache_dir;
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $dir = $ixiscope_cache_dir;
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    if (!is_dir($dir) || !is_writable($dir)) {
        $dir = rtrim(sys_get_temp_dir(), '/\\') . '/ixiscope-api';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
    }
    return $dir;
}

/** $fn() computed at most once per $ttl seconds; a failure keeps the last good answer. */
function cached(string $key, int $ttl, callable $fn)
{
    $file = cache_dir() . '/' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $key) . '.json';
    if (is_file($file) && time() - filemtime($file) < $ttl) {
        $v = json_decode((string) file_get_contents($file), true);
        if ($v !== null) {
            return $v;
        }
    }
    $v = $fn();
    @file_put_contents($file . '.tmp', json_encode($v, JSON_PRESERVE_ZERO_FRACTION));
    @rename($file . '.tmp', $file);
    return $v;
}

/* ---------------------------------------------------------------- shapes */

function amount($v): string
{
    if (is_string($v) && preg_match('/^-?\d+(\.\d+)?$/', $v)) {
        return $v;
    }
    return number_format((float) $v, 8, '.', '');
}

function block_out(array $b): array
{
    return [
        'id' => (int) $b['id'],
        'blockChecksum' => $b['blockChecksum'],
        'lastBlockChecksum' => $b['lastBlockChecksum'],
        'wsChecksum' => $b['wsChecksum'],
        'sigFreezeChecksum' => $b['sigFreezeChecksum'],
        'powField' => $b['powField'],
        'difficulty' => (string) $b['difficulty'],
        'sigCount' => (int) $b['sigCount'],
        'txCount' => (int) $b['txCount'],
        'txAmount' => amount($b['txAmount']),
        'timestamp' => (int) $b['timestamp'],
        'version' => (int) $b['version'],
        'hashrate' => (string) $b['hashrate'],
        'blocktime' => (int) $b['blocktime'],
        'totalSignerDifficulty' => (string) $b['totalSignerDifficulty'],
        'sigRequired' => (int) $b['sigRequired'],
        'requiredSignerDifficulty' => (string) $b['requiredSignerDifficulty'],
        'sigChecksum' => $b['sigChecksum'],
    ];
}

/** ixi_transactions.from / .to: a JSON object of { address: amount } */
function io_list(?string $json): array
{
    $o = json_decode($json ?: '{}', true, 8, JSON_BIGINT_AS_STRING);
    if (!is_array($o)) {
        return [];
    }
    $out = [];
    foreach ($o as $address => $amt) {
        $out[] = ['address' => (string) $address, 'amount' => amount($amt)];
    }
    return $out;
}

function tx_out(array $t): array
{
    return [
        'id' => $t['txid'],
        'type' => (int) $t['type'],
        'blockNr' => (int) $t['blockNr'],
        'applied' => (int) $t['applied'],
        'timestamp' => (int) $t['timestamp'],
        'amount' => amount($t['amount']),
        'fee' => amount($t['fee']),
        'from' => io_list($t['from']),
        'to' => io_list($t['to']),
        'nonce' => (string) $t['nonce'],
        'signature' => bin2hex_if_binary((string) $t['signature']),
        'checksum' => (string) $t['checksum'],
        'data' => (string) $t['data'],
        'version' => (int) $t['version'],
    ];
}

function bin2hex_if_binary(string $s): string
{
    return preg_match('/^[\x20-\x7e]*$/', $s) ? $s : bin2hex($s);
}

function tx_summary(array $t): array
{
    $from = io_list($t['from']);
    $to = io_list($t['to']);
    return [
        'id' => $t['txid'],
        'type' => (int) $t['type'],
        'applied' => (int) $t['applied'],
        'timestamp' => (int) $t['timestamp'],
        'amount' => amount($t['amount']),
        'fee' => amount($t['fee']),
        'from' => $from[0]['address'] ?? null,
        'to' => $to[0]['address'] ?? null,
        'fromCount' => count($from),
        'toCount' => count($to),
    ];
}

const TX_COLS = 't.id, t.txid, t.blockNr, t.timestamp, t.type, t.amount, t.applied, t.`from`, t.`to`, t.fee';

/* ---------------------------------------------------------------- input */

function int_arg(string $name, int $default, int $min, int $max): int
{
    $v = $_GET[$name] ?? null;
    if ($v === null || $v === '') {
        return $default;
    }
    if (!preg_match('/^-?\d+$/', (string) $v)) {
        fail(400, 'bad_request', "$name must be a whole number.");
    }
    return max($min, min($max, (int) $v));
}

function range_arg(): string
{
    $r = $_GET['range'] ?? '24h';
    if (!isset(RANGES[$r])) {
        fail(400, 'bad_request', 'range must be 24h, 7d, 30d or 90d.');
    }
    return $r;
}

function token(string $s, string $what): string
{
    if (!preg_match('/^[A-Za-z0-9\-_]{1,200}$/', $s)) {
        fail(400, 'bad_request', "That is not a valid $what.");
    }
    return $s;
}

/* ---------------------------------------------------------------- chain helpers */

function latest_block(): ?array
{
    return row('SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT 1');
}

function ts10(int $t): string
{
    // ixi_blocks.timestamp is a varchar; compare as a same-length string so the index is used
    return sprintf('%010d', max(0, $t));
}

/** first block at or after unix time $t (null when none) */
function height_at_or_after(int $t): ?int
{
    $r = row('SELECT id FROM ixi_blocks WHERE timestamp >= ? ORDER BY timestamp ASC, id ASC LIMIT 1', [ts10($t)]);
    return $r ? (int) $r['id'] : null;
}

/** The all-time TPS record, built up in chunks and kept in the cache. */
function tps_peak(int $budget = 400000): array
{
    $file = cache_dir() . '/tps-peak.json';
    $s = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    if (!is_array($s)) {
        $s = ['tps' => 0, 'height' => 0, 'timestamp' => 0, 'scanned' => 0];
    }
    $top = latest_block();
    $tip = $top ? (int) $top['id'] : 0;
    if ($s['scanned'] > $tip) {
        // the chain was rolled back past what was scanned; start over
        $s = ['tps' => 0, 'height' => 0, 'timestamp' => 0, 'scanned' => 0];
    }
    if ($s['scanned'] === 0) {
        $first = row('SELECT MIN(id) AS id FROM ixi_blocks');
        $s['scanned'] = max(0, (int) ($first['id'] ?? 1) - 1);
    }
    $lock = @fopen($file . '.lock', 'c');
    if ($lock && flock($lock, LOCK_EX | LOCK_NB)) {
        $left = $budget;
        while ($s['scanned'] < $tip && $left > 0) {
            $to = min($tip, $s['scanned'] + min(200000, $left));
            $r = row(
                'SELECT id, timestamp, txCount / blocktime AS tps FROM ixi_blocks WHERE id > ? AND id <= ? AND blocktime > 0 ORDER BY tps DESC, id ASC LIMIT 1',
                [$s['scanned'], $to]
            );
            if ($r && (float) $r['tps'] > $s['tps']) {
                $s['tps'] = round((float) $r['tps'], 2);
                $s['height'] = (int) $r['id'];
                $s['timestamp'] = (int) $r['timestamp'];
            }
            $left -= $to - $s['scanned'];
            $s['scanned'] = $to;
        }
        @file_put_contents($file . '.tmp', json_encode($s));
        @rename($file . '.tmp', $file);
        flock($lock, LOCK_UN);
    }
    if ($lock) {
        fclose($lock);
    }
    return $s;
}

/* ---------------------------------------------------------------- statistics */

/**
 * Buckets for a range, the same way ixiscope's demo data makes them: `count`
 * buckets of `step` seconds, the last one being the current (partial) bucket.
 */
function buckets(string $range): array
{
    [$step, $count] = RANGES[$range];
    $now = time();
    $end = intdiv($now, $step) * $step;
    $t0 = $end - ($count - 1) * $step;
    return [$step, $count, $t0, $now];
}

/** One pass over the range's blocks, all block-based metrics at once. */
function block_stats(string $range): array
{
    [$step, $count, $t0] = buckets($range);
    $h0 = height_at_or_after($t0);
    $b = array_fill(0, $count, null);
    $peak = null;
    if ($h0 !== null) {
        $pdo = pdo();
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        $st = $pdo->prepare('SELECT id, timestamp, txCount, blocktime, sigCount, sigRequired, totalSignerDifficulty, requiredSignerDifficulty FROM ixi_blocks WHERE id >= ? ORDER BY id ASC');
        $st->execute([$h0]);
        while ($r = $st->fetch(PDO::FETCH_NUM)) {
            [$id, $ts, $txc, $bt, $sc, $sr, $tsd, $rsd] = [(int) $r[0], (int) $r[1], (int) $r[2], (int) $r[3], (int) $r[4], (int) $r[5], (float) $r[6], (float) $r[7]];
            $i = intdiv($ts - $t0, $step);
            if ($i < 0 || $i >= $count) {
                continue;
            }
            if ($b[$i] === null) {
                $b[$i] = ['n' => 0, 'h0' => $id, 'h1' => $id, 'tx' => 0, 'bt' => 0, 'btn' => 0, 'lo' => null, 'loH' => null, 'hi' => null, 'hiH' => null, 'tps' => 0.0, 'tpsH' => $id, 'tpsT' => $ts, 'sc' => 0, 'sr' => 0, 'tsd' => 0.0, 'rsd' => 0.0];
            }
            $x = &$b[$i];
            $x['n']++;
            $x['h0'] = min($x['h0'], $id);
            $x['h1'] = max($x['h1'], $id);
            $x['tx'] += $txc;
            $x['sc'] += $sc;
            $x['sr'] += $sr;
            $x['tsd'] += $tsd;
            $x['rsd'] += $rsd;
            if ($bt > 0) {
                $x['bt'] += $bt;
                $x['btn']++;
                if ($x['lo'] === null || $bt < $x['lo']) {
                    $x['lo'] = $bt;
                    $x['loH'] = $id;
                }
                if ($x['hi'] === null || $bt > $x['hi']) {
                    $x['hi'] = $bt;
                    $x['hiH'] = $id;
                }
                $tps = $txc / $bt;
                if ($tps > $x['tps']) {
                    $x['tps'] = $tps;
                    $x['tpsH'] = $id;
                    $x['tpsT'] = $ts;
                }
            }
            unset($x);
        }
        $st->closeCursor();
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
    }
    // no blocks yet in the newest buckets (the current one just started, or the explorer is catching up):
    // leave them out rather than drawing a drop to zero
    $last = $count - 1;
    while ($last >= 0 && $b[$last] === null) {
        $last--;
    }
    $out = [];
    foreach (['tx', 'tps', 'blocktime', 'signerDifficulty', 'requiredDifficulty', 'hashrate', 'signatures', 'sigRequired'] as $m) {
        $points = [];
        $peak = null;
        $prev = null;
        for ($i = 0; $i <= $last; $i++) {
            $p = ['t' => $t0 + $i * $step, 'v' => 0];
            $x = $b[$i];
            if ($x === null && $prev !== null && !in_array($m, ['tx', 'tps'], true)) {
                // a gap without blocks inside the range: averages hold their last value, counts stay 0
                $p['v'] = $prev;
            }
            if ($x !== null) {
                $p['h0'] = $x['h0'];
                $p['h1'] = $x['h1'];
                $n = $x['n'];
                switch ($m) {
                    case 'tx':
                        $p['v'] = $x['tx'];
                        break;
                    case 'tps':
                        $p['v'] = round($x['tps'], 2);
                        $p['h'] = $x['tpsH'];
                        if ($peak === null || $x['tps'] > $peak['tps']) {
                            $peak = ['tps' => round($x['tps'], 2), 'height' => $x['tpsH'], 'timestamp' => $x['tpsT']];
                        }
                        break;
                    case 'blocktime':
                        $avg = $x['btn'] ? $x['bt'] / $x['btn'] : 0;
                        $p['v'] = round($avg, 2);
                        $p['lo'] = $x['lo'] ?? $p['v'];
                        $p['hi'] = $x['hi'] ?? $p['v'];
                        if ($x['loH'] !== null) {
                            $p['loH'] = $x['loH'];
                            $p['hiH'] = $x['hiH'];
                        }
                        break;
                    case 'signerDifficulty':
                        $p['v'] = round($x['tsd'] / $n);
                        break;
                    case 'hashrate':
                        $p['v'] = round($x['tsd'] / $n / HASHRATE_WINDOW);
                        break;
                    case 'requiredDifficulty':
                        $p['v'] = round($x['rsd'] / $n);
                        break;
                    case 'signatures':
                        $p['v'] = round($x['sc'] / $n, 1);
                        break;
                    case 'sigRequired':
                        $p['v'] = round($x['sr'] / $n, 1);
                        break;
                }
            }
            if ($x !== null) {
                $prev = $p['v'];
            }
            $points[] = $p;
        }
        $s = ['metric' => $m, 'range' => $range, 'step' => $step, 'points' => $points];
        if ($m === 'tps') {
            $s['peak'] = $peak;
        }
        $out[$m] = $s;
    }
    return $out;
}

/** Node counts and supply from ixi_nodestats (written by internal/fetchstatus.php). */
function node_stats(string $range): array
{
    [$step, $count, $t0] = buckets($range);
    // ixi_nodestats is keyed by the network height, so find the height where the range starts
    $h0 = height_at_or_after($t0) ?? PHP_INT_MAX;
    $prev = row('SELECT UNIX_TIMESTAMP(`date`) AS t, totalixi FROM ixi_nodestats WHERE blockheight < ? ORDER BY blockheight DESC LIMIT 1', [$h0]);
    $rs = rows('SELECT blockheight, UNIX_TIMESTAMP(`date`) AS t, totalixi, `nodes-m` AS m, `nodes-r` AS r FROM ixi_nodestats WHERE blockheight >= ? ORDER BY blockheight ASC', [$h0]);
    $b = array_fill(0, $count, null);
    foreach ($rs as $r) {
        $i = intdiv((int) $r['t'] - $t0, $step);
        if ($i < 0 || $i >= $count) {
            continue;
        }
        if ($b[$i] === null) {
            $b[$i] = ['k' => 0, 'm' => 0, 'r' => 0, 'first' => (float) $r['totalixi'], 'last' => (float) $r['totalixi'], 'h' => (int) $r['blockheight']];
        }
        $b[$i]['k']++;
        $b[$i]['m'] += (int) $r['m'];
        $b[$i]['r'] += (int) $r['r'];
        $b[$i]['last'] = (float) $r['totalixi'];
        $b[$i]['h'] = (int) $r['blockheight'];
    }
    $out = [];
    $before = $prev ? (float) $prev['totalixi'] : null;
    $carry = ['nodesDlt' => 0, 'nodesS2' => 0, 'supply' => $before ?? 0];
    $lastSupply = $before;
    $series = ['nodesDlt' => [], 'nodesS2' => [], 'supply' => [], 'emission' => []];
    for ($i = 0; $i < $count; $i++) {
        $t = $t0 + $i * $step;
        $x = $b[$i];
        if ($x !== null) {
            $carry['nodesDlt'] = (int) round($x['m'] / $x['k']);
            $carry['nodesS2'] = (int) round($x['r'] / $x['k']);
            $carry['supply'] = $x['last'];
        }
        $series['nodesDlt'][] = ['t' => $t, 'v' => $carry['nodesDlt']];
        $series['nodesS2'][] = ['t' => $t, 'v' => $carry['nodesS2']];
        $sp = ['t' => $t, 'v' => round($carry['supply'])];
        if ($x !== null) {
            $sp['h'] = $x['h'];
        }
        $series['supply'][] = $sp;
        $em = 0;
        if ($x !== null) {
            $base = $lastSupply ?? $x['first'];
            $em = max(0, round($x['last'] - $base));
            $lastSupply = $x['last'];
        }
        $series['emission'][] = ['t' => $t, 'v' => $em];
    }
    foreach ($series as $m => $points) {
        $out[$m] = ['metric' => $m, 'range' => $range, 'step' => $step, 'points' => $points];
    }
    return $out;
}

const STATS_TTL = ['24h' => 30, '7d' => 120, '30d' => 300, '90d' => 600];

function series(string $metric, string $range): array
{
    $ttl = STATS_TTL[$range];
    if (in_array($metric, ['nodesDlt', 'nodesS2', 'supply', 'emission'], true)) {
        $all = cached("nodes-$range", $ttl, fn() => node_stats($range));
    } else {
        $all = cached("blocks-$range", $ttl, fn() => block_stats($range));
    }
    return $all[$metric];
}

/* ---------------------------------------------------------------- addresses */

function address_row(string $addr): ?array
{
    return row('SELECT id, address, amount, lastblock FROM ixi_addresses WHERE address = ? LIMIT 1', [$addr]);
}

function address_info(string $addr): ?array
{
    global $known_wallets;
    $a = address_row($addr);
    if (!$a) {
        return null;
    }
    $aidx = (int) $a['id'];
    $agg = cached("addr-$aidx", 60, function () use ($aidx) {
        $s = row(
            'SELECT COUNT(DISTINCT txidx) AS n, MIN(txidx) AS first, SUM(CASE WHEN amountdelta > 0 THEN amountdelta ELSE 0 END) AS rcv, SUM(CASE WHEN amountdelta < 0 THEN -amountdelta ELSE 0 END) AS snt FROM ixi_txidx WHERE aidx = ?',
            [$aidx]
        );
        $first = null;
        if ($s && $s['first'] !== null) {
            $f = row('SELECT applied FROM ixi_transactions WHERE id = ?', [(int) $s['first']]);
            $first = $f ? (int) $f['applied'] : null;
        }
        return ['n' => (int) ($s['n'] ?? 0), 'first' => $first, 'rcv' => amount($s['rcv'] ?? '0'), 'snt' => amount($s['snt'] ?? '0')];
    });
    return [
        'address' => $a['address'],
        'amount' => amount($a['amount']),
        'lastblock' => (int) $a['lastblock'],
        'txcount' => $agg['n'],
        'firstblock' => $agg['first'],
        'label' => isset($known_wallets[$a['address']]) ? (string) $known_wallets[$a['address']][0] : null,
        'received' => $agg['rcv'],
        'sent' => $agg['snt'],
        '_aidx' => $aidx,
    ];
}

function balance_history(string $addr, string $range): ?array
{
    [$step, $count, $t0, $now] = buckets($range);
    $a = address_row($addr);
    if (!$a) {
        return null;
    }
    $aidx = (int) $a['id'];
    $bal = (float) $a['amount'];
    $h0 = height_at_or_after($t0);
    $deltas = [];
    if ($h0 !== null) {
        // first transaction applied in the range, so only the range's rows of this address are read
        $ft = row('SELECT id FROM ixi_transactions WHERE applied >= ? ORDER BY applied ASC, id ASC LIMIT 1', [$h0]);
        if ($ft) {
            $deltas = rows(
                'SELECT t.applied AS h, t.timestamp AS ts, SUM(x.amountdelta) AS d FROM ixi_txidx x JOIN ixi_transactions t ON t.id = x.txidx WHERE x.aidx = ? AND x.txidx >= ? GROUP BY t.applied, t.timestamp ORDER BY t.applied DESC',
                [$aidx, (int) $ft['id']]
            );
        }
    }
    // the height at the end of each bucket
    $ends = [];
    for ($i = 0; $i < $count; $i++) {
        $ends[$i] = min($t0 + ($i + 1) * $step, $now);
    }
    $heights = [];
    foreach ($ends as $i => $te) {
        $r = row('SELECT id FROM ixi_blocks WHERE timestamp < ? ORDER BY timestamp DESC, id DESC LIMIT 1', [ts10($te)]);
        $heights[$i] = $r ? (int) $r['id'] : 0;
    }
    $points = [];
    $e = 0;
    $n = count($deltas);
    for ($i = $count - 1; $i >= 0; $i--) {
        $h = $heights[$i];
        while ($e < $n && (int) $deltas[$e]['h'] > $h) {
            $bal -= (float) $deltas[$e]['d'];
            $e++;
        }
        $points[] = ['t' => $t0 + $i * $step, 'v' => max(0, round($bal, 8)), 'h' => $h];
    }
    return ['metric' => 'balance', 'range' => $range, 'step' => $step, 'points' => array_reverse($points)];
}

/* ---------------------------------------------------------------- nodes */

function node_versions(): array
{
    $raw = @file_get_contents(__DIR__ . '/../cache/nodes.ixi');
    $o = $raw ? json_decode($raw, true) : null;
    $out = [];
    if (is_array($o)) {
        foreach ($o as $agent => $n) {
            $agent = (string) $agent;
            $kind = strncmp($agent, 'xdc-', 4) === 0 ? 'dlt' : (strncmp($agent, 'xs2c-', 5) === 0 ? 's2' : null);
            if ($kind !== null) {
                $out[] = ['kind' => $kind, 'version' => $agent, 'count' => (int) $n];
            }
        }
    }
    return $out;
}

/* ---------------------------------------------------------------- routes */

function route(string $path): void
{
    global $known_wallets, $ixiscope_nodes_file;
    $seg = array_values(array_filter(explode('/', trim($path, '/')), 'strlen'));
    $n = count($seg);

    if ($n === 1 && $seg[0] === 'status') {
        $b = latest_block();
        $ns = row('SELECT * FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1');
        if (!$b || !$ns) {
            fail(404, 'not_found', 'The explorer has no blocks or node status yet.');
        }
        $tx = json_decode((string) @file_get_contents(__DIR__ . '/../cache/tx.ixi'), true);
        $peak = tps_peak();
        send([
            'blockheight' => (int) $ns['blockheight'],
            'indexedHeight' => (int) $b['id'],
            'timestamp' => (int) $b['timestamp'],
            'totalixi' => amount($ns['totalixi']),
            'hashrate' => (int) $ns['hashrate'],
            'difficulty' => (string) $ns['difficulty'],
            'blockratio' => (float) $ns['blockratio'],
            'nodes_m' => (int) $ns['nodes-m'],
            'nodes_r' => (int) $ns['nodes-r'],
            'nodes_c' => (int) $ns['nodes-c'],
            'tpsNow' => (int) $b['blocktime'] > 0 ? round((int) $b['txCount'] / (int) $b['blocktime'], 2) : 0,
            'tpsPeak' => ['tps' => $peak['tps'], 'height' => $peak['height'], 'timestamp' => $peak['timestamp']],
            'tx24h' => (int) ($tx[1]['tx_24h'] ?? 0),
            'txAvgPerDay' => (int) round((float) ($tx[2]['tx_avg'] ?? 0)),
            'txTotal' => (int) ($tx[0]['tx_total'] ?? 0),
        ], 5);
    }

    if ($seg[0] === 'blocks') {
        if ($n === 1) {
            $limit = int_arg('limit', 25, 1, 100);
            $before = isset($_GET['before']) && $_GET['before'] !== '' ? int_arg('before', 0, 0, PHP_INT_MAX) : null;
            $rs = $before === null
                ? rows("SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT $limit")
                : rows("SELECT * FROM ixi_blocks WHERE id <= ? ORDER BY id DESC LIMIT $limit", [$before]);
            send(array_map('block_out', $rs), $before === null ? 5 : 30);
        }
        if ($n === 2 && $seg[1] === 'latest') {
            $b = latest_block();
            $b ? send(block_out($b), 5) : fail(404, 'not_found');
        }
        if ($n === 2 && $seg[1] === 'slowest') {
            $from = int_arg('from', 1, 1, PHP_INT_MAX);
            $to = int_arg('to', $from, 1, PHP_INT_MAX);
            if ($to - $from > 100000) {
                fail(400, 'bad_request', 'A window can be at most 100,000 blocks.');
            }
            $page = int_arg('page', 0, 0, 100000);
            $size = int_arg('size', 25, 1, 100);
            $off = $page * $size;
            $rs = rows("SELECT * FROM ixi_blocks WHERE id BETWEEN ? AND ? ORDER BY blocktime DESC, id DESC LIMIT $size OFFSET $off", [$from, $to]);
            $total = row('SELECT COUNT(*) AS n FROM ixi_blocks WHERE id BETWEEN ? AND ?', [$from, $to]);
            send(['items' => array_map('block_out', $rs), 'total' => (int) $total['n'], 'page' => $page, 'pageSize' => $size], 30);
        }
        if ($n === 3 && $seg[1] === 'hash') {
            $b = row('SELECT * FROM ixi_blocks WHERE blockChecksum = ? LIMIT 1', [token($seg[2], 'block hash')]);
            $b ? send(block_out($b), 60) : fail(404, 'not_found');
        }
        if (($n === 2 || $n === 3) && preg_match('/^\d+$/', $seg[1])) {
            $h = (int) $seg[1];
            if ($n === 2) {
                $b = row('SELECT * FROM ixi_blocks WHERE id = ?', [$h]);
                $b ? send(block_out($b), 30) : fail(404, 'not_found');
            }
            if ($seg[2] === 'transactions') {
                $page = int_arg('page', 0, 0, 1000000);
                $size = int_arg('size', 25, 1, 100);
                $off = $page * $size;
                $args = [$h];
                $where = 't.applied = ?';
                if (isset($_GET['type']) && $_GET['type'] !== '') {
                    $where .= ' AND t.type = ?';
                    $args[] = (string) int_arg('type', 0, 0, 99);
                }
                $rs = rows('SELECT ' . TX_COLS . " FROM ixi_transactions t WHERE $where ORDER BY t.id ASC LIMIT $size OFFSET $off", $args);
                $total = row("SELECT COUNT(*) AS n FROM ixi_transactions t WHERE $where", $args);
                send(['items' => array_map('tx_summary', $rs), 'total' => (int) $total['n'], 'page' => $page, 'pageSize' => $size], 30);
            }
        }
    }

    if ($seg[0] === 'transactions') {
        if ($n === 2 && $seg[1] === 'recent') {
            $limit = int_arg('limit', 20, 1, 100);
            $rs = rows('SELECT ' . TX_COLS . " FROM ixi_transactions t ORDER BY t.id DESC LIMIT $limit");
            send(array_map('tx_summary', $rs), 5);
        }
        if ($n === 2) {
            $t = row('SELECT * FROM ixi_transactions WHERE txid = ? LIMIT 1', [token($seg[1], 'transaction id')]);
            $t ? send(tx_out($t), 30) : fail(404, 'not_found');
        }
    }

    if ($seg[0] === 'addresses') {
        if ($n === 2 && $seg[1] === 'top') {
            $limit = int_arg('limit', 20, 1, 100);
            $top = cached("top-$limit", 600, function () use ($limit) {
                global $known_wallets;
                $ns = row('SELECT totalixi FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1');
                $supply = $ns ? (float) $ns['totalixi'] : 0;
                $out = [];
                foreach (rows("SELECT address, amount FROM ixi_addresses ORDER BY amount DESC LIMIT $limit") as $i => $r) {
                    $out[] = [
                        'rank' => $i + 1,
                        'address' => $r['address'],
                        'amount' => amount($r['amount']),
                        'share' => $supply > 0 ? (float) $r['amount'] / $supply : 0,
                        'label' => isset($known_wallets[$r['address']]) ? (string) $known_wallets[$r['address']][0] : null,
                    ];
                }
                return $out;
            });
            send($top, 60);
        }
        if ($n >= 2) {
            $addr = token($seg[1], 'address');
            if ($n === 2) {
                $a = address_info($addr);
                if (!$a) {
                    fail(404, 'not_found');
                }
                unset($a['_aidx']);
                send($a, 10);
            }
            if ($n === 3 && $seg[2] === 'transactions') {
                $a = address_row($addr);
                if (!$a) {
                    fail(404, 'not_found');
                }
                $page = int_arg('page', 0, 0, 1000000);
                $size = int_arg('size', 25, 1, 100);
                $off = $page * $size;
                $dir = ($_GET['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
                $order = ($_GET['sort'] ?? 'time') === 'amount' ? "ABS(SUM(x.amountdelta)) $dir, x.txidx $dir" : "x.txidx $dir";
                $rs = rows(
                    'SELECT ' . TX_COLS . ", SUM(x.amountdelta) AS delta FROM ixi_txidx x JOIN ixi_transactions t ON t.id = x.txidx WHERE x.aidx = ? GROUP BY x.txidx ORDER BY $order LIMIT $size OFFSET $off",
                    [(int) $a['id']]
                );
                $total = row('SELECT COUNT(DISTINCT txidx) AS n FROM ixi_txidx WHERE aidx = ?', [(int) $a['id']]);
                $items = array_map(fn($r) => tx_summary($r) + ['delta' => amount($r['delta'])], $rs);
                send(['items' => $items, 'total' => (int) $total['n'], 'page' => $page, 'pageSize' => $size], 10);
            }
            if ($n === 3 && $seg[2] === 'balance') {
                $range = range_arg();
                $s = cached("bal-$addr-$range", STATS_TTL[$range], fn() => balance_history($addr, $range));
                $s ? send($s, 30) : fail(404, 'not_found');
            }
        }
    }

    if ($seg[0] === 'stats' && $n === 2) {
        if (!in_array($seg[1], METRICS, true)) {
            fail(404, 'not_found', 'Unknown metric.');
        }
        $range = range_arg();
        send(series($seg[1], $range), 30);
    }

    if ($seg[0] === 'nodes') {
        if ($n === 1) {
            if (!is_file($ixiscope_nodes_file)) {
                // 204: nothing published yet (not an error; ixiscope shows counts and versions without the map)
                http_response_code(204);
                header('Cache-Control: public, max-age=60');
                exit;
            }
            $list = json_decode((string) file_get_contents($ixiscope_nodes_file), true);
            is_array($list) ? send($list, 60) : fail(500, 'server_error', 'The node list file is not valid JSON.');
        }
        if ($n === 2 && $seg[1] === 'versions') {
            send(node_versions(), 60);
        }
    }

    fail(404, 'not_found', 'Unknown path.');
}

/* ---------------------------------------------------------------- main */

if ($ixiscope_cli) {
    if (($argv[1] ?? '') === 'warm') {
        $s = tps_peak(PHP_INT_MAX);
        echo 'TPS record: ' . $s['tps'] . ' at block ' . $s['height'] . ' (scanned to ' . $s['scanned'] . ")\n";
        exit(0);
    }
    // php index.php /blocks/latest  -> prints the JSON, handy for testing
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $argPath = $argv[1] ?? '/status';
    $q = parse_url($argPath, PHP_URL_QUERY);
    if ($q) {
        parse_str($q, $_GET);
    }
    $_GET['p'] = parse_url($argPath, PHP_URL_PATH);
}

cors();
try {
    route((string) ($_GET['p'] ?? ''));
} catch (Throwable $e) {
    error_log('ixiscope-api: ' . $e->getMessage());
    fail(500, 'server_error', 'Something went wrong on the server.');
}
