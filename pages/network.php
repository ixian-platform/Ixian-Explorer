<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/
include_once("include/ixian.php");

$page = new Template();

$numblocks = 2880;
$blockPowCalculationTime = 900; // 900 seconds (30 blocks)

$page->numblocks = $numblocks;

$data = db_fetch("SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT $numblocks", [ ]);
if ($data != 0) {

}

$difflabels = "";
$diff = "";
$hash = "";

$blocktime = "";
$txcount = "";
$sigcount = "";
$reqsigcount = "";
$totalsigdiff = "";
$reqsigdiff = "";

//$totalAmount = 0;
foreach($data as $block) {
    $blockNum = $block["id"];
    $difflabels = " $blockNum, ".$difflabels;
//    $totalAmount += $block["amount"];
    $difficulty = $block['difficulty'];
    $diff = " $difficulty, ".$diff;
    
    $hashrate = $block['hashrate'];
    $hash = " $hashrate, ".$hash;
    
    $bt = $block['blocktime'];
    $blocktime = " $bt, ".$blocktime;
    
    $tx = $block['txCount'];
    $txcount = " $tx, ".$txcount;
        
    $sig = $block['sigCount'];
    $sigcount = " $sig, ".$sigcount;
    $sig = $block['sigRequired'];
    $reqsigcount = " $sig, ".$reqsigcount;    
    
    $sdiff = $block['totalSignerDifficulty'];
    $totalsigdiff = " $sdiff, ".$totalsigdiff;    
    $sdiff = $block['requiredSignerDifficulty'];
    $reqsigdiff = " $sdiff, ".$reqsigdiff;       
    
}
$diff = $diff." ";
$page->diff = $diff;
$difflabels = $difflabels." ";
$page->difflabels = $difflabels;


$hash = $hash. " ";
$page->hash = $hash;

$page->blocktime = $blocktime;
$page->txcount = $txcount;
$page->sigcount = $sigcount;
$page->reqsigcount = $reqsigcount;
$page->totalsigdiff = $totalsigdiff;
$page->reqsigdiff = $reqsigdiff;

$signers = 0;
$requiredsigners = 0;
$data = db_fetch("SELECT * FROM ixi_blocks ORDER BY id DESC LIMIT 1", [ ]);
if ($data != 0) {
    $signers = $data[0]["sigCount"];
    $requiredsigners = $data[0]["sigRequired"];
}

$laststat = db_fetch("SELECT * FROM ixi_nodestats ORDER BY blockheight DESC LIMIT 1", [])[0];
if ($laststat != 0) {

}

$page->bh = $laststat['blockheight'];
$page->blockratio = $laststat['blockratio'];
$page->hashrate = number_format($totalsigdiff / $blockPowCalculationTime);

$page->m = $laststat['nodes-m'];
$page->r = $laststat['nodes-r'];
$page->c = $laststat['nodes-c'];


$page->miningreward = number_format(calculateMiningRewardForBlock($page->bh),2);

$page->blockstake = calculateStakingReward($laststat['blockheight'], $laststat['totalixi']);
$page->signers = $signers;
$page->requiredsigners = $requiredsigners;

$page->render('page_network.tpl');


?>
