<script src="vendor/chart.js/Chart.min.js"></script>
<script src="vendor/chart.js/chartjs-plugin-zoom.min.js"></script>
<link rel="stylesheet" href="<?php echo versionedAsset('css/statistics.css'); ?>"/>

<section class="pageContainer">
    <div class="pageLimitWrapper statsHero">
        <div class="statsHeader">
            <div class="flexCGap8">
                <h1 class="heading-lg">Ixian Stats</h1>
                <p class="body-md">All ixian block signing stats.</p>
            </div>
            <div class="ixiCard">
                <div class="flexCGap8">
                    <p class="heading-sm"><?php echo number_format($this->bh);?></p>
                    <div class="tooltipWrapperHelper">
                        <p class="label-sm t-gray">Network Block Height</p>
                        <div class="tooltip-container">
                            <i class="fa fa-question-circle"></i>
                            <span class="myTooltip">The last block that was added to the blockchain.</span>
                        </div>
                    </div>
                </div>
                <div>
                    <img class="theme-dependent" data-icon="numbers.svg" alt="numbers" />
                </div>
            </div>
        </div>
        <div class="statsContent">
            <p class="heading-sm t-gray">Block Signing Stats</p>
            <div class="statsCardContainer">
                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->signers;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Last Block Signer Count</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">Number of nodes that signed the last valid block. Maximum number of signers is 1000 signers per block. Nodes with higher hash rate have priority.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="all_match.svg" alt="all_match" />
                    </div>
                </div>

                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->requiredsigners;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Required Signers</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">Minimum required signatures for the last block accepted.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="orbit.svg" alt="orbit" />
                    </div>
                </div>

                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->blockstake;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Block Signing Reward</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">The block signing reward is split between up to 1000 signers of the block.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="ixian_logo.svg" alt="ixi" />
                    </div>
                </div>
                
                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->lastTotalSigDiff;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Last Block Signer Difficulty</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">Combined SHA3-512 total difficulty of all block signers, signing the last block.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="charger.svg" alt="charger" />
                    </div>
                </div>
                
                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->lastReqSigDiff;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Required Block Signer Difficulty</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">Minimum combined SHA3-512 total difficulty of all block signers, required to sign the next block.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="charger.svg" alt="charger" />
                    </div>
                </div>
                
                <div class="ixiCard">
                    <div class="flexCGap8">
                        <p class="heading-sm"><?php echo $this->hashrate;?></p>
                        <div class="tooltipWrapperHelper">
                            <p class="label-sm t-gray">Estimated Hash-rate (h/s)</p>
                            <div class="tooltip-container">
                                <i class="fa fa-question-circle"></i>
                                <span class="myTooltip">Combined estimated total SHA3-512 hash rate of all block signers, signing the last block.</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <img class="theme-dependent" data-icon="charger.svg" alt="charger" />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="bg-1">
        <div class="blockCharts pageLimitWrapper">
            <div class="blockStatusCard">
                <div class="blockStatusCardHeader">
                    <div>
                        <h3 class="heading-sm">Block Status</h3>
                        <p class="body-md">Showing data for last <span class="t-blue label-sm"><?php echo $this->numblocks;?></span> blocks.</p>
                    </div>
                </div>
                <div>
                    <div class="chart-area">
                        <canvas id="chart-1"></canvas>
                    </div>
                </div>
            </div>
            <div class="blockStatusCard">
                <div class="blockStatusCardHeader">
                    <div>
                        <h3 class="heading-sm">Block Signing Status</h3>
                        <p class="body-md">Showing data for last <span class="t-blue label-sm"><?php echo $this->numblocks;?></span> blocks.</p>
                    </div>
                </div>
                <div>
                    <div class="chart-area">
                        <canvas id="chart-2"></canvas>
                    </div>
                </div>
            </div>
        </div>
    </div>

</section>

<script>
   
$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

const decimation = {
  enabled: true,
  algorithm: 'min-max',
};

var ctx = document.getElementById("chart-0");
var mininStatsChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [<?php echo $this->difflabels;?>],
    datasets: [{
      label: "Difficulty",
      lineTension: 0,
      backgroundColor: "rgba(78, 115, 223, 0.05)",
      borderColor: "rgba(78, 115, 223, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(78, 115, 223, 1)",
      pointBorderColor: "rgba(78, 115, 223, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->diff; ?>],
      yAxisID: 'yaxis1',
    },
              
{
      label: "Hashrate",
      lineTension: 0,
      backgroundColor: "rgba(78, 223, 115, 0.05)",
      borderColor: "rgba(78, 223, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(78, 223, 115, 1)",
      pointBorderColor: "rgba(78, 223, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->hash; ?>],
      yAxisID: 'yaxis2',
    }              
              
              ],
  },
  options: {
    maintainAspectRatio: false,
    animation: false,
    spanGaps: true,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 0
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      decimation: decimation
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        gridLines: {
          display: true,
          drawBorder: true
        },
        ticks: {
          count: 10,
          precision: 0,
          callback: function(value, index, values) {
                        return "#"+value;
            } 
        }
      },
      yaxis1: {
            type: 'linear',
            display: false,
						position: 'left',
          },
      yaxis2: {
            type: 'linear',
            display: false,
            gridLines: {
								drawOnChartArea: false,
							}
          },
    },
    legend: {
      display: true
    }
  }
}); 
    

var ctx2 = document.getElementById("chart-1");
var blockStatsChart = new Chart(ctx2, {
  type: 'line',
  data: {
    labels: [<?php echo $this->difflabels;?>],
    datasets: [{
      label: "Block Time",
      lineTension: 0,
      backgroundColor: "rgba(78, 115, 223, 0.05)",
      borderColor: "rgba(78, 115, 223, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(78, 115, 223, 1)",
      pointBorderColor: "rgba(78, 115, 223, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->blocktime; ?>],
      yAxisID: 'yaxis1',
    },
              
{
      label: "Transactions",
      lineTension: 0,
      backgroundColor: "rgba(78, 223, 115, 0.05)",
      borderColor: "rgba(78, 223, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(78, 223, 115, 1)",
      pointBorderColor: "rgba(78, 223, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->txcount; ?>],
      yAxisID: 'yaxis2',
    },
              
{
      label: "Signers",
      lineTension: 0,
      backgroundColor: "rgba(223, 223, 115, 0.05)",
      borderColor: "rgba(223, 223, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(223, 223, 115, 1)",
      pointBorderColor: "rgba(223, 223, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(223, 115, 223, 1)",
      pointHoverBorderColor: "rgba(223, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->sigcount; ?>],
      yAxisID: 'yaxis3',
    }           
              
              ],
  },
  options: {
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 0
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      decimation: decimation
    },
    scales: {
      x: {
          type: 'linear',
          bounds: 'data',
          gridLines: {
            display: true,
            drawBorder: true
          },
          ticks: {
            count: 10,
            precision: 0,
            callback: function(value, index, values) {
                        return "#"+value;
            } 
          }
      },
          yaxis1: {
            type: 'linear',
            display: false,
						position: 'left',
          },
          yaxis2: {
            type: 'linear',
            display: false,
            gridLines: {
								drawOnChartArea: false,
							}
          },
          yaxis3: {
            type: 'linear',
            display: false,
            gridLines: {
								drawOnChartArea: false,
							}
          },        
    },
    legend: {
      display: true
    }
  }
}); 
       
    
var ctx3 = document.getElementById("chart-2");
var signingStatsChart = new Chart(ctx3, {
  type: 'line',
  data: {
    labels: [<?php echo $this->difflabels;?>],
    datasets: [{
      label: "Total Signer Difficulty",
      lineTension: 0,
      backgroundColor: "rgba(78, 223, 115, 0.05)",
      borderColor: "rgba(78, 223, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(78, 223, 115, 1)",
      pointBorderColor: "rgba(78, 223, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->totalsigdiff; ?>],
      yAxisID: 'yaxis1',
    },
              
    {
      label: "Required Signer Difficulty",
      lineTension: 0,
      backgroundColor: "rgba(8, 153, 45, 0.05)",
      borderColor: "rgba(8, 153, 45, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(8, 153, 45, 1)",
      pointBorderColor: "rgba(8, 153, 45, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->reqsigdiff; ?>],
      yAxisID: 'yaxis1',
    },
              
    {
      label: "Signers",
      lineTension: 0,
      backgroundColor: "rgba(223, 223, 115, 0.05)",
      borderColor: "rgba(223, 223, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(223, 223, 115, 1)",
      pointBorderColor: "rgba(223, 223, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(223, 115, 223, 1)",
      pointHoverBorderColor: "rgba(223, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->sigcount; ?>],
      yAxisID: 'yaxis2',
    },
              
    {
      label: "Required Signers",
      lineTension: 0,
      backgroundColor: "rgba(223, 183, 115, 0.05)",
      borderColor: "rgba(223, 183, 115, 1)",
      pointRadius: 0,
      pointBackgroundColor: "rgba(223, 183, 115, 1)",
      pointBorderColor: "rgba(223, 183, 115, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(223, 115, 223, 1)",
      pointHoverBorderColor: "rgba(223, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      data: [<?php echo $this->reqsigcount; ?>],
      yAxisID: 'yaxis2',
    }          
    ],
  },
  options: {
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 0
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      decimation: decimation
    },
    scales: {
      x: {
          type: 'linear',
          bounds: 'data',
          gridLines: {
            display: true,
            drawBorder: true
          },
          ticks: {
            count: 10,
            precision: 0,
            callback: function(value, index, values) {
                        return "#"+value;
            } 
          }
      },
      yaxis1: {
        type: 'linear',
        display: false,
				position: 'left',
      },
      yaxis2: {
        type: 'linear',
        display: false,
        gridLines: {
					drawOnChartArea: false,
				}
      },        
    },
    legend: {
      display: true
    }
  }
}); 

</script>
