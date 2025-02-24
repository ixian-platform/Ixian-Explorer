<?php
/*
* Ixian basic PHP Library
* Website: www.ixian.io
* Github:  https://github.com/ProjectIxian
*/

require_once "base58/ServiceInterface.php";
require_once "base58/GMPService.php";
require_once "base58/Base58.php";

$base58CharMap = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function addAddressChecksum($address)
{
    $tmpChecksum = sha512sqTrunc($address, 0, 0, 3);
    return $address.$tmpChecksum;
}

function sha512sqTrunc($data, $offset = 0, $count = 0, $hashLength = 44)
{
    if($count == 0)
    {
        $count = strlen($data) - $offset;
    }
    $data = substr($data, $offset, $count);
    return substr(hash("sha512", hash("sha512", $data, true), true), 0, $hashLength);
}

function sha512quTrunc($data, $offset = 0, $count = 0, $hashLength = 32)
{
    if($count == 0)
    {
        $count = strlen($data) - $offset;
    }
    $data = substr($data, $offset, $count);
    return substr(hash("sha512", hash("sha512", hash("sha512", hash("sha512", $data, true), true), true), true), 0, $hashLength);
}

function sha3_512sqTrunc($data, $offset = 0, $count = 0, $hashLength = 44)
{
    if($count == 0)
    {
        $count = strlen($data) - $offset;
    }
    $data = substr($data, $offset, $count);
    return substr(hash("sha3-512", hash("sha3-512", $data, true), true), 0, $hashLength);
}



function addressFromNonce($addressOrPubKey, $nonce)
{
    $version = -1;
    if(strlen($addressOrPubKey) == 523)
    {
        $version = 0;
    }else
    {
        $version = unpack("C", $addressOrPubKey)[1];
    }

    if($version == 0)
    {
        return addressFromNonce_v0($addressOrPubKey, $nonce);
    }
    else if($version == 1)
    {
        return addressFromNonce_v1($addressOrPubKey, $nonce);
    }
    else if($version == 2)
    {
        return addressFromNonce_v2($addressOrPubKey, $nonce);
    }
    else
    {
        // error
        echo "Unknown address version ".$version." from pubkey/nonce".PHP_EOL;
        return "ERROR";
    }
}

function addressFromNonce_v0($addressOrPubKey, $nonce)
{
    $baseAddress = null;
    if(strlen($addressOrPubKey) == 36)
    {
        $baseAddress = $addressOrPubKey;
    }else
    {
        $public_key_offset = 5;
        if (strlen($addressOrPubKey) == 523)
        {
            $public_key_offset = 0;
        }
        $rawAddress = "\x00".sha512quTrunc($addressOrPubKey, $public_key_offset);
        $baseAddress = addAddressChecksum($rawAddress);
    }

    if(($nonce == 0 && strlen($nonce) == 1) 
        || $nonce === "\0" 
        || ($nonce == "" && strlen($nonce) == 0))
    {
        return $baseAddress;
    }
    else
    {
        $rawAddress = "\x00".sha512quTrunc($baseAddress.$nonce);
        $binAddress = addAddressChecksum($rawAddress);
        return $binAddress;
    }
}

function addressFromNonce_v1($addressOrPubKey, $nonce)
{
    $baseAddress = null;
    if(strlen($addressOrPubKey) == 48)
    {
        $baseAddress = $addressOrPubKey;
    }else
    {
        $rawAddress = "\x01".sha512sqTrunc($addressOrPubKey, 1);
        $baseAddress = addAddressChecksum($rawAddress);
    }
    
    if(($nonce == 0 && strlen($nonce) == 1)
        || $nonce === "\0" 
        || ($nonce == "" && strlen($nonce) == 0))
    {
        return $baseAddress;
    }
    else
    {
        $rawAddress = "\x01".sha512sqTrunc($baseAddress.$nonce, 5);
        $binAddress = addAddressChecksum($rawAddress);
        return $binAddress;
    }
}

function addressFromNonce_v2($addressOrPubKey, $nonce)
{
    $baseAddress = null;
    if(strlen($addressOrPubKey) == 48)
    {
        $baseAddress = $addressOrPubKey;
    }else
    {
        $rawAddress = "\x02".sha3_512sqTrunc($addressOrPubKey, 1);
        $baseAddress = $rawAddress;
    }
    
    if(($nonce == 0 && strlen($nonce) == 1) 
        || $nonce === "\0" 
        || ($nonce == "" && strlen($nonce) == 0))
    {
        return $baseAddress;
    }
    else
    {
        $rawAddress = "\x02".sha3_512sqTrunc($baseAddress.$nonce, 0);      
        return $rawAddress;
    }
}
    
function encodeFromAddresses($fromList, $pubKeyOrAddress)
{
    global $base58CharMap;
    $base58 = new StephenHill\Base58($base58CharMap);
    $newFromList = array();
    $rawPubKeyOrAddress = $base58->decode($pubKeyOrAddress);
    
    foreach($fromList as $nOnce=>$amount)
    {
        $fromAddress = $base58->encode(addressFromNonce($rawPubKeyOrAddress, $base58->decode("".$nOnce)));
        $newFromList[$fromAddress] = $amount;
    }
    return array($newFromList);
}

function pubkeyToAddress($pubkey, $nOnce = "1")
{
    global $base58CharMap;
    $base58 = new StephenHill\Base58($base58CharMap);
    $rawPubKeyOrAddress = $base58->decode($pubkey);
	return $base58->encode(addressFromNonce($rawPubKeyOrAddress, $base58->decode("".$nOnce)));
}

function rsaKeyFromBytes($pubKey)
{
    global $base58CharMap;
    $base58 = new StephenHill\Base58($base58CharMap);
    $keyBytes = $base58->decode($pubKey);

    $offset = 0;
    $dataLen = 0;
    $version = 0;

    if (strlen($keyBytes) != 523 && strlen($keyBytes) != 2339)
    {
        $offset += 1; // skip address version
        $version = unpack("lint32", substr($keyBytes, $offset, 4))["int32"];
        $offset += 4;
    }

    $dataLen = unpack("lint32", substr($keyBytes, $offset, 4))["int32"];
    $offset += 4;
    $modulus = substr($keyBytes, $offset, $dataLen);
    $offset += $dataLen;

    $dataLen = unpack("lint32", substr($keyBytes, $offset, 4))["int32"];
    $offset += 4;
    $exponent = substr($keyBytes, $offset, $dataLen);
    $offset += $dataLen;
    return kimssl_pkey_get_public($modulus, $exponent);
}

function verifyRSASignature($data, $signature, $pubKey)
{
    $convertedPubKey = rsaKeyFromBytes($pubKey);
    return openssl_verify($data, $signature, $convertedPubKey, OPENSSL_ALGO_SHA512);
}


function calculateMiningRewardForBlock($blockNum)
{
    $reward = 0;
    
    if($blockNum < 1051200) // first year
    {
        $reward = ((($blockNum * 0.009) + 0.009) / 2) + 10;
    }else if($blockNum < 1802000) // second year, until first adjustment
    {
        $reward = ((1051200 * 0.009) / 2) + 10;
    }else if($blockNum < 6307200) // up to first halving
    {
        $reward = 2304;
    }else if($blockNum < 9460800) // up to second halving
    {
        $reward = 1152;
    }else if($blockNum < 12614400) // up to final reward
    {
        $reward = 576;
    
    }else if ($blockNum < 105120000)
    {
        $reward = 18;
    }
    
    return $reward;
}


function calculateStakingReward($blockNum, $totalSupply)
{
    $reward = 0;
    if($blockNum <= 86400)
    {
        $reward = ($totalSupply * 0.1) / 100000000; // 0.1%
    }else if($blockNum < 1802000)
    {
        $reward = ($totalSupply * 5) / 100000000; // 5%
    }else if($blockNum < 6307200)
    {
        $reward = 576;
    }else if($blockNum < 9460800)
    {
        $reward = 288;
    }else if($blockNum < 12614400)
    {
        $reward = 144;
    }else if($blockNum < 15768000)
    {
        $reward = 72;
    }else
    {
        $reward = 36; // 36 per block after block num > 15768000 (15 years)
    }
    return $reward;
}


/** Following functions are copied from https://www.identityblog.com/?p=389 **/

// this function makes up for the fact that openssl doesn't
// currently support direct use of modulus and exponent except
// when PEM encoded in publicKeyInfo or Certificate ASN.1 
// So, believe it or not, I convert it into a publicKeyInfo ASN
// structure and then turn it into PEM - then it works fine.

function kimssl_pkey_get_public ($modulus, $exponent)
{
    // make an ASN publicKeyInfo
    $exponentEncoding = makeAsnSegment(0x02, $exponent);    
    $modulusEncoding = makeAsnSegment(0x02, $modulus);    
    $sequenceEncoding = makeAsnSegment(0x30, $modulusEncoding.$exponentEncoding);
    $bitstringEncoding = makeAsnSegment(0x03, $sequenceEncoding);
    $rsaAlgorithmIdentifier = pack("H*", "300D06092A864886F70D0101010500"); 
    $publicKeyInfo = makeAsnSegment (0x30, $rsaAlgorithmIdentifier.$bitstringEncoding);

    // encode the publicKeyInfo in base64 and add PEM brackets
    $publicKeyInfoBase64 = base64_encode($publicKeyInfo);    
    $encoding = "-----BEGIN PUBLIC KEY-----\n";
    $offset = 0;
    while ($segment=substr($publicKeyInfoBase64, $offset, 64)){
       $encoding = $encoding.$segment."\n";
       $offset += 64;
    }
    $encoding = $encoding."-----END PUBLIC KEY-----\n";

    // use the PEM version of the key to get a key handle
    $publicKey = openssl_pkey_get_public ($encoding);

    return ($publicKey);
}

// this helper function is necessary because PHP's openssl
// currently requires that the public key be in PEM format
// This does the ASN.1 type and length encoding

function makeAsnSegment($type, $string)
{
    // fix up integers and bitstrings
    switch ($type){
        case 0x02:
            if (ord($string) > 0x7f)
                $string = chr(0).$string;
            break;
        case 0x03:
            $string = chr(0).$string;
            break;
    }

    $length = strlen($string);

    if ($length < 128){
       $output = sprintf("%c%c%s", $type, $length, $string);
    }
    else if ($length < 0x0100){
       $output = sprintf("%c%c%c%s", $type, 0x81, $length, $string);
    }
    else if ($length < 0x010000) {
       $output = sprintf("%c%c%c%c%s", $type, 0x82, $length/0x0100, $length%0x0100, $string);
    }
    else {
        $output = NULL;
    }

    return($output);
}

/** End of copied functions **/