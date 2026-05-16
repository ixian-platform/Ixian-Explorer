<link rel="stylesheet" href="vendor/bootstrap-cookie-alert/cookiealert.css">
<link rel="stylesheet" href="<?php echo versionedAsset('css/home.css'); ?>"/>

<section class="pageContainer">
    <div class="pageLimitWrapper homeHero">
        <div class="home-search">
            <h1 class="heading-lg">Welcome to ixiscope</h1>
            <p class="body-lg">The official <span class="label-lg">Block Explorer</span> for the Ixian Platform.</p>
            <form class="inputContainer" method="get">
                <input type="hidden" name="p" value="search"/>
                <input class="input" aria-label="Search" name="q" value="<?php echo $this->q;?>" type="text" placeholder="Type or paste blocks, addresses or transaction ID"/>
                <button type="submit" class="button btn-p label-md">Go <i class="fa fa-arrow-right"></i></button>
            </form>
            <p class="label-sm t-gray">Use the search bar to scan for transactions, wallets, names and blocks.</p>
        </div>

        <!-- Statistics data cards -->
        <div class="cardGroup">
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->supply;?></p>
                    <div class="tooltipWrapperHelper">
                        <p class="label-sm t-gray">IXI Circulating Supply</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">The entire amount of IXI in circulation including the Genesis wallets with vesting amounts.</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="ixian_logo.svg" src="" alt="ixi" />
                </div>
            </div>
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->m;?></p>
                    <div class="tooltipWrapperHelper">
                    <p class="label-sm t-gray">Active IXI DLT Nodes</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">Number of all active Ixian DLT Nodes connected to the network.</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="linked_services.svg" alt="linked_services" />
                </div>
            </div>
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->hashrate;?></p>
                    <div class="tooltipWrapperHelper">
                        <p class="label-sm t-gray">Estimated Hash-rate (h/s)</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">Current network hash-rate.</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="charger.svg"alt="charger" />
                </div>
            </div>

            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->tx24;?></p>
                    <p class="label-sm t-gray">Transactions Last 24H</p>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="history.svg" alt="history" />
                </div>
            </div>
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->txavg;?></p>
                    <div class="tooltipWrapperHelper">
                        <p class="label-sm t-gray">Average Transactions Per Day</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">Average number of transactions per day (last 30 days).</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="avg_pace.svg" alt="avg_pace" />
                </div>
            </div>
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo $this->txtotal;?></p>
                    <p class="label-sm t-gray">On-chain Transactions</p>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="sync_alt.svg" alt="sync_alt" />
                </div>
            </div>
        </div>
    </div>

    <div class="bg-1">
        <section class="blocks-wrapper pageLimitWrapper flexCGap8">
            <div class="blocks-wrapper-header">
                <h4 class="heading-sm">Latest Blocks</h4>
                <div class="what-are-blocks">
                    <p class="label-md">What are blocks</p>
                    <div class="tooltipWrapperHelper">
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle t-green"></i>
                            <span class="myTooltip">A block is a fundamental component of the Ixian DLT technology. Each block contains IDs of transactions and links to the previous block and to its associated Wallet State through its checksum fields. These verify that all of the transactions included in that particular block have been successfully applied, and also that the given block logically follows from the previous block.</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table id="tblocks" class="table myTable">
                    <thead class="myTableHead">
                    <tr>
                        <th scope="col" class="myTh" style="width: 100px">Height</th>
                        <th scope="col" class="myTh" >Hash</th>
                        <th scope="col" class="myTh" style="max-width: 28px">Added</th>
                        <th scope="col" class="myTh" style="max-width: 28px">TXs</th>
                    </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
        </section>
    </div>

    <!-- START Bootstrap-Cookie-Alert -->
    <div class="alert text-center cookiealert d-flex flex-column justify-content-center align-items-center" role="alert">
        <div>
            <p class="label-md">&#x1F36A; We use cookies to ensure you get the best experience on our website.</p>
            <a href="https://www.ixian.io/?page=cookie" target="_blank">Learn more</a>
        </div>
        <button type="button" class="button btn-p label-md acceptcookies">
            I agree
        </button>
    </div>
    <!-- END Bootstrap-Cookie-Alert -->
</section><!-- Page Content -->


<script src="vendor/bootstrap-cookie-alert/cookiealert.js"></script>
<script src="vendor/datatables/jquery.dataTables.min.js"></script>
<script src="vendor/datatables/dataTables.bootstrap4.min.js"></script>

<script>
    var etbl;
    $(function () {
        $etbl = $('#tblocks').DataTable({
            'paging': true,
            'pagingType': 'numbers',
            'lengthChange': false,
            'info': false,
            'ordering': true,
            'order': [[0, "desc"]],
            'searching': false,
            'serverSide': true,
            'processing': true,
            'autoWidth': false,
            'ajax': 'feeds/blocks.php'
        });
    })
</script>