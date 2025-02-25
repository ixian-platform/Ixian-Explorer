<script src="vendor/chart.js/Chart.min.js"></script>
<link rel="stylesheet" href="<?php echo versionedAsset('css/nodes.css'); ?>"/>
<!-- Begin Page Content -->

<section class="pageContainer">
    <div class="pageLimitWrapper nodesHero">
        <div>
            <h1 class="heading-lg">Ixian Nodes</h1>
            <p class="body-md">Explore the stats of IXI nodes and connected clients.</p>
        </div>
        <div class="cardGroup nodesSpecificGrid">
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
                    <p class="heading-sm"><?php echo $this->r;?></p>
                    <div class="tooltipWrapperHelper">
                        <p class="label-sm t-gray">Active IXI S2 Nodes</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">Number of all active Ixian S2 Nodes connected to the network.</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="s2_mark.svg" alt="s2" />
                </div>
            </div>
        </div>
    </div>

    <div class="bg-1">
        <div class="nodeStatsContainer pageLimitWrapper">
            <div class="nodeCard">
                <div class="nodeCardHeader">
                    <div class="flexCGap8">
                        <h3 class="heading-sm">IXI DLT Nodes</h3>
                        <p class="body-md">Data below shows all currently active DLT nodes.</p>
                    </div>
                </div>
                <div>
                    <div class="table-responsive">
                        <table id="tblocks" class="table myTable">
                            <thead class="thead myTableHead">
                            <tr>
                                <th scope="col" class="myTh">Node Count</th>
                                <th scope="col" class="myTh">Ixian Node Version</th>
                            </tr>
                            </thead>
                            <tbody>
                            <?php foreach($this->dltnodes as $nodeagent => $nodecount) {?>
                            <tr>
                            <td><?php echo $nodecount;?></td>
                            <td><?php echo $nodeagent;?></td>
                            </tr>
                            <?php } ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="chart-area" style="position: relative; height:30vh;">
                        <canvas id="chart-0"></canvas>
                    </div>
                </div>
            </div>
            <div class="nodeCard">
                <div class="nodeCardHeader">
                    <div>
                        <h3 class="heading-sm">IXI S2 Nodes</h3>
                        <p class="body-md">Data below shows all currently active S2 streaming nodes.</p>
                    </div>
                </div>
                <div>
                    <div class="table-aresponsive">
                        <table id="tblocks" class="table myTable">
                            <thead class="thead myTableHead">
                            <tr>
                                <th scope="col" class="myTh">Node Count</th>
                                <th scope="col" class="myTh">Ixian Node Version</th>
                            </tr>
                            </thead>
                            <tbody>
                            <?php foreach($this->s2nodes as $nodeagent => $nodecount) {?>
                            <tr>
                            <td><?php echo $nodecount;?></td>
                            <td><?php echo $nodeagent;?></td>
                            </tr>
                            <?php } ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="chart-area" style="position: relative; height:30vh;">
                        <canvas id="chart-1"></canvas>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<script>
    var ctx = document.getElementById("chart-0");
    var dltChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [<?php foreach($this->dltnodes as $nodeagent => $nodecount) { echo "\"".$nodeagent."\","; } ?>],
        datasets: [{
          data: [<?php foreach($this->dltnodes as $nodeagent => $nodecount) { echo $nodecount.","; } ?>],
          backgroundColor: ['#4e73df', '#1cc88a', '#FF0000', '#FFFF00'],
          hoverBackgroundColor: ['#2e59d9', '#17a673', '#FF0000', '#FFFF00'],
          hoverBorderColor: "rgba(234, 236, 244, 1)",
        }],
      },
      options: {
        maintainAspectRatio: false,
        tooltips: {
          backgroundColor: "rgb(255,255,255)",
          bodyFontColor: "#858796",
          borderColor: '#dddfeb',
          borderWidth: 1,
          xPadding: 15,
          yPadding: 15,
          displayColors: true,
          caretPadding: 10,
        },
        legend: {
          display: true
        },
        cutoutPercentage: 70,
      },
    });

    ctx = document.getElementById("chart-1");
    var s2Chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [<?php foreach($this->s2nodes as $nodeagent => $nodecount) { echo "\"".$nodeagent."\","; } ?>],
        datasets: [{
          data: [<?php foreach($this->s2nodes as $nodeagent => $nodecount) { echo $nodecount.","; } ?>],
          backgroundColor: ['#4e73df', '#1cc88a', '#FF0000', '#FFFF00'],
          hoverBackgroundColor: ['#2e59d9', '#17a673', '#FF0000', '#FFFF00'],
          hoverBorderColor: "rgba(234, 236, 244, 1)",
        }],
      },
      options: {
        maintainAspectRatio: false,
        tooltips: {
          backgroundColor: "rgb(255,255,255)",
          bodyFontColor: "#858796",
          borderColor: '#dddfeb',
          borderWidth: 1,
          xPadding: 15,
          yPadding: 15,
          displayColors: true,
          caretPadding: 10,
        },
        legend: {
          display: true
        },
        cutoutPercentage: 70,
      },
    });
    </script>
    