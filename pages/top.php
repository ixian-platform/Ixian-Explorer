<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

$page = new Template();


$data = db_fetch("SELECT * FROM ixi_addresses ORDER BY amount DESC LIMIT 20", [ ]);
if ($data != 0) {

}

$totalAmount = 0;
$totalAmountWithoutKnownWallets = 0;

foreach($data as $addr) {
    $totalAmount += $addr["amount"];

    // Check if the address is not in the known wallets list and add it to the total amount without known wallets
    if (!array_key_exists($addr["address"], $known_wallets)) {
        $totalAmountWithoutKnownWallets += $addr["amount"];
    }
}

$page->totalAmount = number_format($totalAmount);
$page->totalAmountWithoutKnownWallets = number_format($totalAmountWithoutKnownWallets);
$page->data = $data;

$laststat = db_fetch("SELECT * FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1", [])[0];
if ($laststat != 0) {

}
$page->supply = number_format($laststat['totalixi']);

$lockedPremine = 1200000000;
$unlockedPremine = 800000000;
$totalAmountWoPremine = $totalAmount - ($lockedPremine + $unlockedPremine);
$num = 100 / $laststat['totalixi'];
$w100num = $num * $totalAmountWoPremine;
$lockedpreminenum = $num * $lockedPremine;
$unlockedpreminenum = $num * $unlockedPremine;
$othernum = 100 - $w100num - $lockedpreminenum - $unlockedpreminenum;

$page->w100num = number_format($w100num,2);
$page->othernum = number_format($othernum, 2);
$page->lockedpreminenum = number_format($lockedpreminenum, 2);
$page->unlockedpreminenum = number_format($unlockedpreminenum, 2);
$page->known_wallets = $known_wallets;
$page->render('page_top.tpl');

?>
