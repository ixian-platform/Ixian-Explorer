<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

include_once("config.php");
include_once("include/template.php");
include_once("wallets.php");

$current_page = "home";

//ixiscope version
$ixiscope_version = "0.1.1";

if(isset($_GET['p']))
{
    $new_page = $_GET['p'];
    
    if($new_page === 'search' || $new_page === 'address' || $new_page === 'block' || $new_page === 'transaction'
      || $new_page === 'network' || $new_page === 'top' || $new_page === 'emissions'
      || $new_page === 'devblocks' || $new_page === 'superblocks' || $new_page === 'nodes'   
      )
    {
        $current_page = $new_page;
    }
}

db_connect();

$page = new Template();

$page->cpage = $current_page;

$page->q = "";
if(isset($_GET['q'])) {  
    if($current_page === 'search' && $_GET['q'] != "") 
    {
        $page->q = htmlspecialchars($_GET['q']);
        redirectSearch($page->q);
    }
    else {
        header("Location: index.php");
        exit;
    }
}

// Fetch the current network blockheight
$laststat = db_fetch("SELECT * FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1", []);
if ($laststat == null)
{
	$laststat = array("blockheight" => 0);
}
else
{
	$laststat = $laststat[0];
}
$networkbh = $laststat['blockheight'];

// Fetch the lastest stored block
$laststat = db_fetch("SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT 1", []);
if ($laststat == null)
{
	$laststat = array("id" => 0);
}else
{
	$laststat = $laststat[0];
}
$explorerbh = $laststat['id'];


$page->alert = 0;
// If the explorer is more than 10 blocks behind the network blockheight, show the synchronizing alert
if($explorerbh < $networkbh - 10)
{
    $page->alert = 1; // Synchronizing
}

$page->render('header.tpl'); 

include_once('pages/'.$current_page.'.php');

$page->render('footer.tpl');

?>