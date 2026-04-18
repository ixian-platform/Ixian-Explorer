<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

$page = new Template();

$walid = "";
if(isset($_GET['id']) && $_GET['id'] != "") {
    $walid = $_GET['id'];
    $walid = explode("_", $walid)[0];
/*    if(ctype_alnum($txid))
    {
        $page->render('page_error.tpl');
        return;
    }*/
}
else 
{
    $page->render('page_error.tpl');
    return;
}

$page->walletid = $walid;



$dbc = db_fetch("SELECT * FROM ixi_addresses WHERE address = :a LIMIT 1", [":a" => $walid]);

if($dbc == null) {
    $page->render('page_error.tpl');
    return;
}

$dba = $dbc[0];


$page->balance = $dba["amount"];
$page->adx = $dba["id"];

$dbc = db_fetch("SELECT count(idx) as txc FROM ixi_txidx WHERE aidx = :a LIMIT 1", [":a" => $page->adx]);
$dba = $dbc[0];
$page->txcount = $dba["txc"];


$page->known_wallets = $known_wallets;
$page->render('page_address.tpl');


?>