<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/
require_once("ixianlib.php");

function insertTxIndex($walletidx, $txidx, $amountdelta)
{
    db_fetch("INSERT INTO `ixi_txidx` (`aidx`, `txidx`, `amountdelta`) VALUES (:1, :2, :3)",
            [ ":1" => $walletidx, ":2" => $txidx, ":3" => $amountdelta]);
}

function updateAddress($ssh, $walletid, $blockNum) 
{
    $adx = 0;
    $justupdate = false;
    $res = db_fetch("SELECT id, lastblock from `ixi_addresses` WHERE address = :1 LIMIT 1", [ ":1" => $walletid]);
    if($res != null)
    {
        $adx = $res[0]["id"];        
        $lastblockNum = $res[0]["lastblock"];
        if($lastblockNum >= $blockNum)
            return $adx;    
        $justupdate = true;
    }
    
	$api_url = "getbalance?address=$walletid";
	$wdata = callIxianAPI($ssh, $api_url); 
	
    if(!$wdata)
    {
        return $adx;
    }
    
    if($justupdate == true)
    {
        db_fetch("UPDATE `ixi_addresses` SET `amount` = :1 , `lastblock` = :2 WHERE `ixi_addresses`.`id` = :3 ", 
                 [ ":1" => $wdata, ":2" =>$blockNum, ":3" => $adx]);
        return $adx;
    }
    
    db_fetch("INSERT INTO `ixi_addresses` (`address`, `amount`, `lastblock`) VALUES (:1, :2, :3 )", 
             [ ":1" => $walletid, ":2" => $wdata, ":3" => $blockNum]);
    
    $res = db_fetch("SELECT id from `ixi_addresses` WHERE address = :1 LIMIT 1", [ ":1" => $walletid]);
    if($res != null)
    {
        $adx = $res[0]["id"];
    }    
    return $adx;
}

function addBlock($ssh, $num, $prevBlockTimestamp = 0, $updateNextBlockTime = false) 
{
    echo "\n$num";

	$api_url = "getBlock?num=$num";
	$data = callIxianAPI($ssh, $api_url); 
	
    if(!$data)
    {
        return false;
    }

    $blockNum = $data["Block Number"];
    $res = db_fetch("SELECT id from `ixi_blocks` WHERE id = :1 LIMIT 1", [ ":1" => $blockNum]);
    if($res != null)
    {
        // Block already exists
	    echo "Block already exists";
        return false;
    }
    
    if($blockNum > 6)
    {
        $sigfreezeBlockNum = $blockNum - 5;
        $res = db_fetch("SELECT * FROM ixi_blocks WHERE id = :1 LIMIT 1", [ ":1" => $sigfreezeBlockNum])[0];
        if ($res != null) 
        {
            $sigChecksum = $res["sigChecksum"];
            $sigFreeze = $data["Sig freeze Checksum"];

            if (strcmp($sigChecksum, $sigFreeze) !== 0) 
            {
                $sbtimestamp = 0;
                $resPrev = db_fetch("SELECT * FROM ixi_blocks WHERE id = :1 LIMIT 1", [ ":1" => $sigfreezeBlockNum-1])[0];
                if ($resPrev != null)
                {
                    $sbtimestamp = $resPrev['timestamp'];
                }

                rollbackBlock($ssh, $sigfreezeBlockNum);
                addBlock($ssh, $sigfreezeBlockNum, $sbtimestamp);

                return false;
            }
        }
    }


    $blockVer = $data["Version"];
    $txids = json_decode($data["TX IDs"], true);

    $addrcache = array(); // Address cache to process stress-test blocks faster

    //$txs = json_decode($data["Transactions"], true);
    
    // Go through each transaction
    foreach($txids as &$txid)
	{
        $res = db_fetch("SELECT id from `ixi_transactions` WHERE txid = :1 LIMIT 1", [ ":1" => $txid]);
        if($res != null)
        {
            // Transaction already exists, but block does not.
            $txidx = $res[0]["id"];

            // First delete all related indices
            db_fetch("DELETE from `ixi_txidx` WHERE txidx = :1", [ ":1" => $txidx]);
            // Now delete the transaction itself
            db_fetch("DELETE FROM `ixi_transactions` WHERE txid = :1", [ ":1" => $txid]);
            //continue;
        }
        echo "*";

        //echo "$txid <br/>";
		$api_url = "gettransaction?id=$txid";
		$txdata = callIxianAPI($ssh, $api_url);

        //$txdata = array_values(array_filter($txs, function($value) use($txid) { return ($value["id"] == $txid); }))[0] ?? null;
		
        if(!$txdata)
        {
			echo "Error getting transaction $txid";
            return false;
        }

        $encodedArr = encodeFromAddresses($txdata["from"], $txdata["pubKey"]);
        $from = $encodedArr[0];
        $txfrom = json_encode($from);
        $txto = json_encode($txdata["to"]);


        // Handle older version transactions with no data field
        $txdatad = "";
        if(isset($txdata["data"]))
            $txdatad = $txdata["data"];

        db_fetch("INSERT INTO `ixi_transactions` (`txid`, `blockNr`, `nonce`, `signature`, `data`, `timestamp`, `type`, `amount`, `applied`, `checksum`, `from`, `to`, `fee`, `version`, `tainted`) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, 0)",
                [ ":1" => $txid, ":2" => $txdata["blockHeight"], ":3" => $txdata["nonce"], ":4" => $txdata["signature"], ":5" => $txdatad, ":6" => $data["Timestamp"], ":7" => $txdata["type"], ":8" => $txdata["amount"], ":9" => $txdata["applied"], ":10" => $txdata["checksum"], ":11" => $txfrom, ":12" => $txto, ":13" => $txdata["fee"], ":14" => $txdata["version"] ]);

        $txidx = 0;
        $res = db_fetch("SELECT id from `ixi_transactions` WHERE txid = :1 LIMIT 1", [ ":1" => $txid]);
        if($res != null)
        {
            // Transaction now exists
            $txidx = $res[0]["id"];
            
            foreach($from as $fromaddr => $fromamount) {
                $adx = 0;
                if(!isset($addrcache[$fromaddr])) {
                    $adx = updateAddress($ssh, $fromaddr, $blockNum);
                    $addrcache[$fromaddr] = $adx;
                }
                else
                {
                    $adx = $addrcache[$fromaddr];
                }   
                
                if($adx != 0)
                {
                    echo ".";
                    insertTxIndex($adx, $txidx, -$fromamount);
                }
            }

            foreach($txdata["to"] as $toaddr => $toamount) {
                $adx = 0;
                if(!isset($addrcache[$toaddr])) {
                    $adx = updateAddress($ssh, $toaddr, $blockNum);
                    $addrcache[$toaddr] = $adx;
                }
                else
                {
                    $adx = $addrcache[$toaddr];
                }
                
                if($adx != 0)
                {
                    echo ".";
                    insertTxIndex($adx, $txidx, $toamount);
                }
            }
        }

    }
    
    // Done with transactions
    
    // Calculate blocktime
    $blocktime = 0;
    if($prevBlockTimestamp > 0)
    {
        $blocktime = $data["Timestamp"] - $prevBlockTimestamp;
    }

    if (!isset($data["Required Signer Difficulty"]))
    {
        $data["Required Signer Difficulty"] = 0;
    }

    
    // Insert the actual block
    db_fetch("INSERT INTO `ixi_blocks` (`id`, `blockChecksum`, `lastBlockChecksum`, `wsChecksum`, `sigFreezeChecksum`, `powField`, `difficulty`, `sigCount`, `txCount`, `txAmount`, `timestamp`, `version`, `hashrate`, `blocktime`, `totalSignerDifficulty`, `sigRequired`, `requiredSignerDifficulty`, `sigChecksum`) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17, :18)", 
    [":1" => $blockNum, ":2" => $data["Block Checksum"], ":3" => $data["Last Block Checksum"], ":4" => $data["Wallet State Checksum"], ":5" => $data["Sig freeze Checksum"], ":6" => $data["PoW field"], ":7" => $data["Difficulty"], ":8" => $data["Signature count"], ":9" => $data["Transaction count"], ":10" => $data["Transaction amount"], ":11" => $data["Timestamp"], ":12" => $blockVer,
    ":13" => $data["Hashrate"], ":14" => $blocktime, ":15" => $data["Total Signer Difficulty"], ":16" => $data["Required Signature count"], ":17" => $data["Required Signer Difficulty"], ":18" => $data["Sig Checksum"]]);

    $res = db_fetch("SELECT id from `ixi_blocks` WHERE id = :1 LIMIT 1", [ ":1" => $blockNum]);
    if($res == null)
    {
        return false;
    }  
    
    // Used for downsync block time calculation
    if($updateNextBlockTime == true) {
        $laststat = db_fetch("SELECT * FROM ixi_blocks WHERE id = :1 LIMIT 1", [ ":1" => $blockNum+1])[0];
        if ($laststat != null) {
            $lasttimestamp = $laststat["timestamp"];
            $nextblocktime = $lasttimestamp - $data["Timestamp"];
            
            db_fetch("UPDATE ixi_blocks SET blocktime = :1 WHERE id = :2 LIMIT 1", [ ":1" => $nextblocktime, ":2" => $blockNum+1]);
        }
    }
    
    return true;
}

function updateBlockSignature($ssh, $num)
{
    if($num < 0)
    {
        return;
    }

    $api_url = "getblock?num=$num";
	$data = callIxianAPI($ssh, $api_url); 
	
    if(!$data)
    {
        return false;
    }

    $blockNum = $data["Block Number"];
    $res = db_fetch("SELECT id, sigCount from `ixi_blocks` WHERE id = :1 LIMIT 1", [ ":1" => $blockNum]);
    if($res == null)
    {
        // Block doesn't exist in the database
        return;
    }
    $previousSigCount = $res[0]["sigCount"];
    $newSigCount = $data["Signature count"];

    db_fetch("UPDATE ixi_blocks SET sigFreezeChecksum = :1, sigCount = :2 WHERE id = :3 LIMIT 1", 
    [ ":1" => $data["Sig freeze Checksum"], ":2" => $newSigCount, ":3" => $blockNum]); 
}

function rollbackBlock($ssh, $num)
{
    echo "\n!!! Rolling back block #$num... ";
    // Fetch all transactions and remove indices first
    $res = db_fetch("SELECT * from `ixi_transactions` WHERE applied = :1", [ ":1" => $num]);
    if($res != null)
    {
        // Go through each transaction
        foreach($res as $tx)
        {        
            $txidx = $tx["id"];
            $txid = $tx["txid"];
            echo "$txid; ";

            // First delete all related indices
            db_fetch("DELETE from `ixi_txidx` WHERE txidx = :1", [ ":1" => $txidx]);
            // Now delete the transaction itself
            db_fetch("DELETE FROM `ixi_transactions` WHERE txid = :1", [ ":1" => $txid]);
        }
    }

    // Move block to rollback table
    $block = db_fetch("SELECT * FROM ixi_blocks WHERE id = :1 LIMIT 1", [ ":1" => $num])[0];
    if ($block != null) {
        db_fetch("INSERT INTO `ixi_blocks_rollback` (`rollback_date`,`id`, `blockChecksum`, `lastBlockChecksum`, `wsChecksum`, `sigFreezeChecksum`, `powField`, `difficulty`, `sigCount`, `txCount`, `txAmount`, `timestamp`, `version`, `hashrate`, `blocktime`, `totalSignerDifficulty`, `sigRequired`, `requiredSignerDifficulty`, `sigChecksum`) VALUES (NOW(), :1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13, :14, :15, :16, :17, :18)", 
        [":1" => $block["id"], ":2" => $block["blockChecksum"], ":3" => $block["lastBlockChecksum"], ":4" => $block["wsChecksum"], ":5" => $block["sigFreezeChecksum"], ":6" => $block["powField"], ":7" => $block["difficulty"], ":8" => $block["sigCount"], ":9" => $block["txCount"], ":10" => $block["txAmount"], ":11" => $block["timestamp"], ":12" => $block["version"],
        ":13" => $block["hashrate"], ":14" => $block["blocktime"], ":15" => $block["totalSignerDifficulty"], ":16" => $block["sigRequired"], ":17" => $block["requiredSignerDifficulty"], ":18" => $block["sigChecksum"]]);
    }

    // Delete the block
    db_fetch("DELETE FROM `ixi_blocks` WHERE id = :1", [ ":1" => $num]);
    echo "DONE\n";
}

function callIxianAPI($ssh, $call)
{
	global $dlt_connect_mode, $dlt_host;
	$timeout = 1800;
	
	if($dlt_connect_mode == "ssh")
	{   
		$stream = $ssh->exec("curl -vs http://localhost:8081/$call");
		$res = $ssh->readStream($stream, $timeout);
    
		$plStream = json_decode($res, true)["result"];
		return $plStream;
	}
    else
	{
		$url = $dlt_host."/".$call;
		$ch = curl_init();

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);

		$res = curl_exec($ch);
		curl_close($ch);
		
		$plStream = json_decode($res, true)["result"];
		return $plStream;
	}
}

// Single API call
// $call - relevant API call with parameters included (wallet?=id)
// WARNING - unsecured $call
function singleCallIxianAPI($call)
{
    global $ssh_host, $ssh_port;
    global $ssh_username, $ssh_public_key, $ssh_private_key, $ssh_password;
	global $dlt_connect_mode, $dlt_host;
	$timeout = 1800;
	
	if($dlt_connect_mode == "ssh")
	{
		$ssh = new NSA_SSH();
		$plStream = null;
		if($ssh->connect($ssh_host, $ssh_port))
		{
			if($ssh->authKey($ssh_username, $ssh_public_key, $ssh_private_key, $ssh_password))
			{
				$stream = $ssh->exec("curl -vs http://localhost:8081/$call");
				$plStream = json_decode($ssh->readStream($stream, 1800), true)["result"];
				
			}else
			{
				echo "Error authenticating on ".$ssh_host.":".$ssh_port.".<br/>".PHP_EOL;
			}
			$ssh->disconnect();
		}else
		{
			echo "Error connecting to ".$ssh_host.":".$ssh_port.".<br/>".PHP_EOL;
		}
		return $plStream;
	}else
	{
		$url = $dlt_host."/".$call;
		$ch = curl_init();

		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);

		$res = curl_exec($ch);
		curl_close($ch);
		
		$plStream = json_decode($res, true)["result"];
		return $plStream;
	}
} 

// Connect via SSH
function connectToIxianServer()
{
    global $ssh_host, $ssh_port;
    global $ssh_username, $ssh_public_key, $ssh_private_key, $ssh_password;
    
    $ssh = new NSA_SSH();
    if($ssh->connect($ssh_host, $ssh_port))
    {
        if($ssh->authKey($ssh_username, $ssh_public_key, $ssh_private_key, $ssh_password))
        {
            return $ssh;
        }else
        {
            echo "Error authenticating on ".$ssh_host.":".$ssh_port.".<br/>".PHP_EOL;
        }
    }else
    {
        echo "Error connecting to ".$ssh_host.":".$ssh_port.".<br/>".PHP_EOL;
    }
    return null;
}
?>
