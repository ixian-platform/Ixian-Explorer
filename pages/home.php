<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

$current_page = "home";

$page = new Template();

$blockPowCalculationTime = 900; // 900 seconds (30 blocks)

$page->cpage = $current_page;

$page->q = "";
if(isset($_GET['q']))
    $page->q = htmlspecialchars($_GET['q']);

$laststat = db_fetch("SELECT * FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1", [])[0];
if ($laststat != 0) {

}

$bh = $laststat['blockheight'];

$page->supply = number_format($laststat['totalixi']);
$page->m = $laststat['nodes-m'];

$lastTotalSigDiff = 0;
$data = db_fetch("SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT 1", [ ]);
if ($data != 0) {
    $lastTotalSigDiff = $data[0]["totalSignerDifficulty"];
}
$page->hashrate = number_format($lastTotalSigDiff / $blockPowCalculationTime);

$page->txtotal = 0;
$page->tx24 = 0;
$page->txavg = 0;

$txstats = file_get_contents("cache/tx.ixi");
if($txstats)
{
    $txstats = json_decode($txstats, true);
    if(isset($txstats[0]["tx_total"]) && isset($txstats[1]["tx_24h"]) && isset($txstats[2]["tx_avg"]))
    {
        $page->txtotal = number_format($txstats[0]["tx_total"]);
        $page->tx24 = number_format($txstats[1]["tx_24h"]);
        $page->txavg = number_format($txstats[2]["tx_avg"]);
    }
}

$page->render('page_home.tpl');

?>