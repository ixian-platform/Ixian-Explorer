<?php
/*
 * ixiscope node map: run every 5 minutes from cron, next to the explorer's
 * own jobs:
 *
 *   0-59/5 * * * * cd /var/www/html/ixiscope-api && /usr/bin/php nodes.php > /dev/null
 *
 * 1. Asks the explorer's DLT node for its presence list (`pl`), the same node
 *    and connection (http or ssh) the explorer's sync already uses.
 * 2. Keeps the DLT (M) and S2 (R) nodes seen in the last two hours.
 * 3. Turns each IP into a city with a local geo database file (.mmdb). No IP
 *    is sent anywhere: the lookup reads a file on this server.
 * 4. Writes cache/ixiscope-nodes.json in ixiscope's NodeInfo shape: city,
 *    country, a slightly offset position, version, uptime, last seen. No IPs,
 *    no ports, no wallet addresses; the id is a short hash.
 *
 * The geo database: by default the free DB-IP "IP to City Lite" file, which
 * this script downloads once a month (CC BY 4.0: ixiscope credits DB-IP on the
 * Network page). To use MaxMind GeoLite2-City instead, put the .mmdb file at
 * the path in $geo_file below; any GeoIP2-City-compatible file works.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
chdir(__DIR__);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

require __DIR__ . '/../config.php';
require __DIR__ . '/settings.php';
require_once __DIR__ . '/vendor/MaxMind/Db/Reader/Decoder.php';
require_once __DIR__ . '/vendor/MaxMind/Db/Reader/InvalidDatabaseException.php';
require_once __DIR__ . '/vendor/MaxMind/Db/Reader/Metadata.php';
require_once __DIR__ . '/vendor/MaxMind/Db/Reader/Util.php';
require_once __DIR__ . '/vendor/MaxMind/Db/Reader.php';

$geo_dir = __DIR__ . '/../cache/geo';
$geo_file = $geo_dir . '/city.mmdb';
$state_file = __DIR__ . '/../cache/ixiscope-nodes-state.json';
// a node counts as online while its presence was refreshed within this window
const ONLINE_WINDOW = 7200;
// jitter: up to about 0.25 degrees, enough to separate dots in one city, still city-level
const JITTER = 0.5;

function say(string $s): void
{
    fwrite(STDOUT, $s . "\n");
}

/* ------------------------------------------------------------ geo database */

function geo_database(string $dir, string $file): ?string
{
    if (is_file($file) && time() - filemtime($file) < 35 * 86400) {
        return $file;
    }
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    // DB-IP publishes the Lite file at the start of each month; try this month, then last month
    foreach ([0, 1] as $back) {
        $ym = date('Y-m', strtotime("first day of -$back month"));
        $url = "https://download.db-ip.com/free/dbip-city-lite-$ym.mmdb.gz";
        say("Downloading $url");
        $gz = @file_get_contents($url);
        if ($gz === false || strlen($gz) < 1000000) {
            continue;
        }
        $raw = @gzdecode($gz);
        if ($raw === false) {
            continue;
        }
        file_put_contents($file . '.tmp', $raw);
        rename($file . '.tmp', $file);
        return $file;
    }
    // keep using an older file rather than none
    return is_file($file) ? $file : null;
}

/* ------------------------------------------------------------ presence list */

function presence_list(): ?array
{
    global $dlt_connect_mode, $dlt_host;
    if (($dlt_connect_mode ?? 'http') === 'ssh') {
        require_once __DIR__ . '/../include/ssh.php';
        require_once __DIR__ . '/../include/ixian.php';
        $ssh = connectToIxianServer();
        if (!$ssh) {
            return null;
        }
        $r = callIxianAPI($ssh, 'pl');
        $ssh->disconnect();
        return is_array($r) ? $r : null;
    }
    $ch = curl_init(rtrim($dlt_host, '/') . '/pl');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 10]);
    $res = curl_exec($ch);
    curl_close($ch);
    $j = $res ? json_decode($res, true, 64, JSON_BIGINT_AS_STRING) : null;
    return is_array($j) && isset($j['result']) && is_array($j['result']) ? $j['result'] : null;
}

/** "1.2.3.4:10234", "[2001:db8::1]:10234" or "host.example:10234" to an IP, or null */
function ip_of(string $address): ?string
{
    $host = $address;
    if (preg_match('/^\[([^\]]+)\](?::\d+)?$/', $address, $m)) {
        $host = $m[1];
    } elseif (substr_count($address, ':') === 1) {
        $host = explode(':', $address)[0];
    }
    if (!filter_var($host, FILTER_VALIDATE_IP)) {
        $resolved = gethostbyname($host);
        if ($resolved === $host) {
            return null;
        }
        $host = $resolved;
    }
    // private and reserved ranges have no location
    return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) ? $host : null;
}

function name_of(?array $names): string
{
    return is_array($names) ? (string) ($names['en'] ?? reset($names) ?: '') : '';
}

/* ------------------------------------------------------------ main */

$geoPath = geo_database($geo_dir, $geo_file);
if (!$geoPath) {
    say('No geo database: cannot place nodes. Put a GeoIP2-City compatible .mmdb at ' . $geo_file);
    exit(1);
}
$geo = new MaxMind\Db\Reader($geoPath);

$pl = presence_list();
if ($pl === null) {
    say('The node did not answer `pl`; the previous node map is kept.');
    exit(1);
}

$now = time();
$state = is_file($state_file) ? json_decode((string) file_get_contents($state_file), true) : [];
if (!is_array($state)) {
    $state = [];
}
$nodes = [];
$seen = [];
foreach ($pl as $presence) {
    $wallet = is_array($presence['wallet'] ?? null) ? (string) ($presence['wallet']['base58Address'] ?? json_encode($presence['wallet'])) : (string) ($presence['wallet'] ?? '');
    foreach ((array) ($presence['addresses'] ?? []) as $a) {
        $type = (string) ($a['type'] ?? '');
        $kind = $type === 'M' ? 'dlt' : ($type === 'R' ? 's2' : null);
        if ($kind === null) {
            continue;
        }
        $last = (int) ($a['lastSeenTime'] ?? 0);
        if ($last > 100000000000) {
            $last = intdiv($last, 1000); // milliseconds
        }
        if ($last && $now - $last > ONLINE_WINDOW) {
            continue;
        }
        $key = sha1($wallet . '|' . json_encode($a['device'] ?? '') . '|' . $kind);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $ip = ip_of((string) ($a['address'] ?? ''));
        $rec = $ip ? $geo->get($ip) : null;
        if (!$rec || !isset($rec['location']['latitude'])) {
            continue;
        }
        $country = name_of($rec['country']['names'] ?? null);
        $city = name_of($rec['city']['names'] ?? null) ?: $country;
        // uptime: continuous presence since this script first saw the node (a gap over the window restarts it)
        $first = $state[$key]['first'] ?? $now;
        if (isset($state[$key]['last']) && $now - $state[$key]['last'] > ONLINE_WINDOW) {
            $first = $now;
        }
        $state[$key] = ['first' => $first, 'last' => $now];
        $h = hexdec(substr($key, 0, 8)) / 0xffffffff;
        $h2 = hexdec(substr($key, 8, 8)) / 0xffffffff;
        $nodes[] = [
            'id' => $kind . '-' . substr($key, 0, 6),
            'kind' => $kind,
            'city' => $city,
            'country' => $country,
            'countryCode' => (string) ($rec['country']['iso_code'] ?? ''),
            'lat' => round((float) $rec['location']['latitude'] + ($h - 0.5) * JITTER, 2),
            'lon' => round((float) $rec['location']['longitude'] + ($h2 - 0.5) * JITTER, 2),
            'version' => (string) ($a['nodeVersion'] ?? ''),
            'uptime' => max(0, $now - $first),
            'lastSeen' => $last ?: $now,
        ];
    }
}
$geo->close();

// forget nodes not seen for a week
foreach ($state as $k => $v) {
    if ($now - (int) ($v['last'] ?? 0) > 7 * 86400) {
        unset($state[$k]);
    }
}
usort($nodes, fn($a, $b) => strcmp($a['id'], $b['id']));

global $ixiscope_nodes_file;
file_put_contents($ixiscope_nodes_file . '.tmp', json_encode($nodes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
rename($ixiscope_nodes_file . '.tmp', $ixiscope_nodes_file);
file_put_contents($state_file, json_encode($state));
$dlt = count(array_filter($nodes, fn($n) => $n['kind'] === 'dlt'));
say('Placed ' . count($nodes) . " nodes ($dlt DLT, " . (count($nodes) - $dlt) . ' S2).');
