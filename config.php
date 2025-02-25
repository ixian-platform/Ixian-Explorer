<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

// For testing and development only
//ini_set('display_errors', 1);
//ini_set('display_startup_errors', 1);
//error_reporting(E_ALL);
//*/

// Database configuration
$db_host = "localhost"; // Database host
$db_user = "explorer01"; // Database username
$db_pass = "myPassword"; // Database password
$db_name = "explorer01"; // Database name

// Ixian Node configuration
$dlt_connect_mode = "http"; // http or ssh
$dlt_host = "http://localhost:8081"; // DLT Node that the explorer connects to

// Uncomment when using ssh mode
/*
$ssh_host = "example.com";
$ssh_port = "22";

$ssh_username = "explorer01";
$ssh_public_key = "/path/to/file/key.pub";
$ssh_private_key = "/path/to/file/key.ppk";
$ssh_password = "password";
*/

$nodestatus_url = "https://resources.ixian.io/nodeStatus.txt"; // URL to node status

// Convenience configuration and failsafes
$sql_details = array('user' => $db_user,'pass' => $db_pass,'db' => $db_name,'host' => $db_host);

// Additional includes files
include_once("include/database.php");
include_once("include/helpers.php");

?>
