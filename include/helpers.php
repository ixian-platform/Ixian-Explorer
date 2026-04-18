<?php
/*
* Ixian Block Explorer
* Website: www.ixian.io 
*/

function api_error($message)
{
    if (!headers_sent()) 
    {
        header('Content-Type: application/json');
    }

    echo json_encode(["result" => null, "error" => ["code" => -32603, "message" => $message], "id" => null]);
    exit;
}

function humanTiming ($time)
{

    $time = time() - $time; // to get the time since that moment
    $time = ($time<1)? 1 : $time;
    $tokens = array (
        31536000 => 'year',
        2592000 => 'month',
        604800 => 'week',
        86400 => 'day',
        3600 => 'hour',
        60 => 'minute',
        1 => 'second'
    );

    foreach ($tokens as $unit => $text) {
        if ($time < $unit) continue;
        $numberOfUnits = floor($time / $unit);
        return $numberOfUnits.' '.$text.(($numberOfUnits>1)?'s':'');
    }
}

if (!function_exists("str_starts_with"))
{
    // Compatibility for PHP versions lower than 8
    function str_starts_with($str, $startstr) 
    {
        return strpos($str, $startstr) === 0;
    }
}

function timestampToDate($timestamp)
{
    return gmdate("Y-m-d H:i:s", $timestamp);
}

function calculateRewardForBlock($blockNum)
{
    $pow_reward = 0;
    if ($blockNum < 1051200) // first year
    {
        $pow_reward = ($blockNum * 9) + 9; // +0.009 IXI
    }else if ($blockNum < 2102400) // second year
    {
        $pow_reward = (1051200 * 9);
    }else if ($blockNum < 3153600) // third year
    {
        $pow_reward = (1051200 * 9) + (($blockNum - 2102400) * 9) + 9; // +0.009 IXI
    }
    else if ($blockNum < 4204800) // fourth year
    {
        $pow_reward = (2102400 * 9) + (($blockNum - 3153600) * 2) + 2; // +0.0020 IXI
    }
    else if ($blockNum < 5256001) // fifth year
    {
        $pow_reward = (2102400 * 9) + (1051200 * 2) + (($blockNum - 4204800) * 9) + 9; // +0.009 IXI
    }
    else // after fifth year if mining is still operational
    {
        $pow_reward = ((3153600 * 9) + (1051200 * 2))/2;
    }

    $pow_reward = ($pow_reward/2 + 10000); // Divide by 2 (assuming 50% block coverage) + add inital 10 IXI block reward
    return $pow_reward / 1000;
}

function redirectSearch($query)
{
    if(!ctype_digit($query))
    {
        $query = explode("_", $query)[0];
        $data = db_fetch("SELECT * FROM ixi_addresses WHERE BINARY address = :1  LIMIT 1", [ ":1" => $query ]);
        if ($data != false && count($data) > 0) {
            header("Location: index.php?p=address&id=$query");
            exit;
        }
    
        $data = db_fetch("SELECT * FROM ixi_transactions WHERE txid LIKE :1  LIMIT 1", [ ":1" => $query ]);
        if ($data != false && count($data) > 0) {
            header("Location: index.php?p=transaction&id=$query");
            exit;
        }
    }
    else {
        $data = db_fetch("SELECT * FROM ixi_blocks WHERE id = :1  LIMIT 1", [ ":1" => $query ]);
        if ($data != false && count($data) > 0) {
            header("Location: index.php?p=block&id=$query");
            exit;
        }
    }
}

function versionedAsset($path) {
    global $ixiscope_version;
    if (file_exists($path)) {
        //appends file modification time
        return $path . '?v=' . $ixiscope_version;
    } else {
        return $path;
    }
}

?>