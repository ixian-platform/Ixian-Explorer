<?php
/*
 * ixiscope API settings. The database and the node come from the explorer's
 * own config.php (one folder up); only what is specific to ixiscope is here.
 */

// Sites allowed to call this API from a browser (CORS). Add the ixiscope
// address here, e.g. "https://ixiscope.ixian.io". Leave empty when ixiscope is
// served from the same host as the explorer (no CORS needed then).
$ixiscope_origins = [
    // "https://ixiscope.ixian.io",
];

// Where computed answers (statistics, top addresses, the TPS record) are kept
// between requests. Must be writable by the web server user. When it isn't,
// the system temp folder is used instead.
$ixiscope_cache_dir = __DIR__ . "/../cache/ixiscope";

// Optional: the node list with city-level locations, in ixiscope's NodeInfo
// shape (see README.md). While this file does not exist, /nodes answers
// "not available" and ixiscope shows the node counts and versions without
// the map.
$ixiscope_nodes_file = __DIR__ . "/../cache/ixiscope-nodes.json";
