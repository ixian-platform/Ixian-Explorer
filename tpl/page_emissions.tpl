<script src="vendor/chart.js/Chart.min.js"></script>
<link rel="stylesheet" href="<?php echo versionedAsset('css/statistics.css'); ?>"/>
<link rel="stylesheet" href="<?php echo versionedAsset('css/emissions.css'); ?>"/>

<section class="pageContainer">
        <section class="emissionsHeader pageLimitWrapper">
            <h1 class="heading-lg">IXI Emissions</h1>
            <p class="body-md"> This page contains all information regarding the IXI emission model, which includes the Argon2 mining and PoCW signing block rewards, as well as the projected number of total IXI in circulation at any given block height.</p>
        </section>
    <div class="bg-1">
        <section class="emissionBlocks pageLimitWrapper flexCGap32">
            <div class="blockStatusCard">
                <div class="blockStatusCardHeader">
                    <div>
                        <h3 class="heading-sm">Argon2 Block Mining Reward Chart</h3>
                        <p class="body-md">Data below shows the mining reward for every block mined.</p>
                    </div>
                </div>
                <div class="blockStatusCardBottomSection">
                    <div class="chart-area">
                        <canvas id="chart-0"></canvas>
                    </div>
                    <div class="rewardsRules">
                        <p class="label-md">IXI emission model for Argon2 mining rewards:</p>
                            <ul>
                                <li>
                                    Argon2 mining reward starts with 10 IXI and increases by 0.009 IXI with every block until block height #1051200.
                                    Last block reward in this period is 4740 IXI.
                                </li>
                                <li>Argon2 mining reward is set to 4740 IXI per block until block height #1802000.</li>
                                <li>Argon2 mining reward is set to 2304 IXI per block until block height #6307200.</li>
                            </ul>
                    </div>
                </div>
            </div>

            <div class="blockStatusCard">
                <div class="blockStatusCardHeader">
                    <div>
                        <h3 class="heading-sm">Block Signing Reward Chart</h3>
                        <p class="body-md">Data below shows the projected signing reward for every block signed.</p>
                    </div>
                </div>
                <div class="blockStatusCardBottomSection">
                    <div class="chart-area">
                        <canvas id="chart-1"></canvas>
                    </div>
                    <div class="rewardsRules">
                        <p class="label-md">Emission model for signing rewards:</p>
                            <ul>
                                <li>
                                    Signing reward is set to 0.1% of the total supply per year until block height #86400.
                                    Last block reward in this period is 2 IXI.
                                </li>
                                <li>Signing reward is set to 5% of the total supply per year until block height #1802000.</li>
                                <li>Signing reward is set to 576 IXI per block until block height #6307200.</li>
                                <li>Signing reward is set to 864 IXI per block until block height #9460800.</li>
                                <li>Signing reward is set to 432 IXI per block until block height #12614400.</li>
                                <li>Signing reward is set to 81 IXI per block until block height #15768000.</li>
                                <li>Signing reward is set to 45 IXI per block until block height #105120000.</li>
                                <li>Signing reward is fixed to 36 IXI per block after block height #105120000.</li>
                            </ul>
                        </div>
                </div>
            </div>

            <div class="blockStatusCard">
                <div class="blockStatusCardHeader">
                    <div>
                        <h3 class="heading-sm">Projected Total IXI in Circulation at Each Block Height</h3>
                        <p class="body-md" style="max-width: 640px"> Data below shows the projected total IXI in circulation at each block height. One block represents approximately 30 seconds. The supply increases according to the Argon2 mining and PoCW signing rewards.</p>
                    </div>
                </div>
                <div class="blockStatusCardBottomSection">
                    <div class="chart-area">
                        <canvas id="chart-2"></canvas>
                    </div>
                    <div class="rewardsRules">
                        <p class="label-md">IXI emission model total supply:</p>
                            <ul>
                                <li>
                                    Block: <strong>#1</strong><br/>
                                    Total supply: <strong>2,000,320,000 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#1051199</strong> (roughly one year later)<br/>
                                    Supply increased in the period: <strong>+1,369,643,634 IXI</strong><br/>
                                    Total supply: <strong>3,369,963,634 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#2102399</strong> (roughly one year later)<br/>
                                    Supply increased in the period: <strong>+2,461,374,354 IXI</strong><br/>
                                    Total supply: <strong>5,831,337,988 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#3153599</strong> (roughly one year later)<br/>
                                    Supply increased in the period: <strong>+1,816,473,600 IXI</strong><br/>
                                    Total supply: <strong>7,647,811,588 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#4204799</strong> (roughly one year later)<br/>
                                    Supply increased in the period: <strong>+1,816,473,600 IXI</strong><br/>
                                    Total supply: <strong>9,464,285,188 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#5256000</strong> (roughly one year later)<br/>
                                    Supply increased in the period: <strong>+1,816,476,480 IXI</strong><br/>
                                    Total supply: <strong>11,280,761,668 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#12614400</strong> (roughly 7 years later)<br/>
                                    Supply increased in the period: <strong>+5,903,536,410 IXI</strong><br/>
                                    Total supply: <strong>17,184,298,078 IXI</strong>
                                </li>
                                <li>
                                    Block: <strong>#65174400</strong> (roughly 50 years later)<br/>
                                    Supply increased in the period: <strong>+2,478,729,564 IXI</strong><br/>
                                    Total supply: <strong>19,663,027,642 IXI</strong>
                                </li>
                                <li>
                                    <strong>Target supply after 100 years (#105120000): 21,460,579,624 IXI</strong>
                                </li>
                            </ul>
                        </div>
                </div>
            </div>
        </section>
    </div>

</section>

<script>
var blockHeight = <?php echo $this->bh; ?>;

var ctx = document.getElementById("chart-0");

var blockMiningLabels = [1, 86399, 250000, 500000, 750000, 1000000, 1051199, 1051200, 1250000, 1500000, 1750000, 1801999, 1802000, 2000000, 2102399, 2102400, 2250000, 2500000, 2750000, 3000000, 3153599, 3153600, 3250000, 3500000, 3750000, 4000000, 4204799, 4204800, 4250000, 4500000, 4750000, 5000000, 5250000, 5256000, 5256001, 5500000, 5750000, 6000000, 6250000, 6307199, 6307200, 6500000, 6750000, 7000000, 7250000, 7500000, 7750000, 8000000, 8250000, 8500000, 8750000, 9000000, 9250000, 9460799, 9460800, 9500000, 9750000, 10000000, 10250000, 10500000, 10750000, 11000000, 11250000, 11500000, 11750000, 12000000, 12250000, 12500000, 12614399, 12614400, 12750000, 13000000, 13250000, 13500000, 13750000, 14000000, 14250000, 14500000, 14750000, 15000000, 15250000, 15500000, 15750000, 16000000
];
var closestBlockMiningLabel = blockMiningLabels.reduce(function(prev, curr) {
  return (Math.abs(curr - blockHeight) < Math.abs(prev - blockHeight) ? curr : prev);
});

var myLineChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: blockMiningLabels,
    datasets: [{
      label: "Mining Reward",
      lineTension: 0,
      backgroundColor: "rgba(78, 115, 223, 0.05)",
      borderColor: "rgba(78, 115, 223, 1)",
      pointRadius: 1,
      pointBackgroundColor: "rgba(78, 115, 223, 1)",
      pointBorderColor: "rgba(78, 115, 223, 1)",
      pointHoverRadius: 1,
      pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
      pointHoverBorderColor: "rgba(78, 115, 223, 1)",
      pointHitRadius: 1,
      pointBorderWidth: 1,
      steppedLine: true,
      data: [
        10, 399, 1135, 2260, 3385, 4510, 4740, 4740, 4740, 4740, 4740, 4740, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 2304, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      ],
      yAxisID: 'yaxis0'
    },
    {
        type: 'bar',
        label: "Today",
        data: [
          { x: closestBlockMiningLabel, y: 5000 }
        ],
        maxBarThickness: 3,
        borderColor: "#F09A1D",
        borderWidth: 2,
        borderSkipped: false,
        yAxisID: 'yaxis0'
    }                            
    ]
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
    scales: {
      x: {
          display: true,
          type: 'linear',
          bounds: 'data',
        gridLines: {
          display: true,
          drawBorder: true
        },
        ticks: {
            maxTicksLimit: 10,
            callback: function(value, index, values) {
                        return "#"+value;
            } 
        }
      },
      yaxis0: {
		    type: 'linear',
		    display: true,
		    position: 'left',
        ticks: {
            callback: function(value, index, values) {
                return value.toLocaleString() + " IXI";
            }
        }
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: {
        filter: ctx => ctx.datasetIndex == 0,
        callbacks: {
          title: ctx => {
            if (ctx.length) {
              var data = ctx[0].dataset.data;
              var value = data[ctx[0].dataIndex];
              var total = data.reduce((a, b) => a + b, 0);
              var percent = Math.round(value / total * 100);
              return "Block #" + blockMiningLabels[ctx[0].dataIndex];
            }
          },
          label: ctx => {
            var value = ctx.dataset.data[ctx.dataIndex];
            return "Mining Reward: " + value + " IXI";
          }
        },
      }
    }
  }
}); 
            
       
    
    

        
var blockSigningLabels = [1, 86399, 250000, 500000, 750000, 1000000, 1051199, 1051200, 1250000, 1500000, 1750000, 1801999, 1802000, 2000000, 2102399, 2102400, 2250000, 2500000, 2750000, 3000000, 3153599, 3153600, 3250000, 3500000, 3750000, 4000000, 4204799, 4204800, 4250000, 4500000, 4750000, 5000000, 5250000, 5256000, 5256001, 5500000, 5750000, 6000000, 6250000, 6307199, 6307200, 6500000, 6750000, 7000000, 7250000, 7500000, 7750000, 8000000, 8250000, 8500000, 8750000, 9000000, 9250000, 9460799, 9460800, 9500000, 9750000, 10000000, 10250000, 10500000, 10750000, 11000000, 11250000, 11500000, 11750000, 12000000, 12250000, 12500000, 12614399, 12614400, 12750000, 13000000, 13250000, 13500000, 13750000, 14000000, 14250000, 14500000, 14750000, 15000000, 15250000, 15500000, 15750000, 15767999, 15768000, 16000000
];
var closestBlockSigningLabel = blockSigningLabels.reduce(function(prev, curr) {
  return (Math.abs(curr - blockHeight) < Math.abs(prev - blockHeight) ? curr : prev);
});
    
var ctx1 = document.getElementById("chart-1");
var myLineChart1 = new Chart(ctx1, {
  type: "line",
  data: {
    labels: blockSigningLabels,
    datasets: 
    [
        {
          label: "Signing Reward",
          lineTension: 0,
          backgroundColor: "rgba(78, 115, 223, 0.05)",
          borderColor: "rgba(78, 115, 223, 1)",
          pointRadius: 1,
          pointBackgroundColor: "rgba(78, 115, 223, 1)",
          pointBorderColor: "rgba(78, 115, 223, 1)",
          pointHoverRadius: 1,
          pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
          pointHoverBorderColor: "rgba(78, 115, 223, 1)",
          pointHitRadius: 1,
          pointBorderWidth: 1,
          steppedLine: true,
          data: [        
            2, 2, 104, 116, 136, 162, 168, 168, 194, 226, 259, 266, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 576, 864, 864, 864, 864, 864, 864, 864, 864, 864, 864, 864, 864, 864, 864, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 432, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 81, 45, 45
          ],
          yAxisID: 'yaxis0'
        },
      {
        type: 'bar',
        label: "Today",
        data: [
          { x: closestBlockSigningLabel, y: 900 }
        ],
        maxBarThickness: 3,
        borderColor: "#F09A1D",
        borderWidth: 2,
        borderSkipped: false,
        yAxisID: 'yaxis0'
      }  

    ]
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
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        gridLines: {
          display: true,
          drawBorder: true
        },
        ticks: {
          maxTicksLimit: 10,
          callback: function(value, index, values) {
                        return "#"+value;
            } 
        }
      },
      yaxis0: {
            type: 'linear',
            display: true,
            position: 'left',
        ticks: {
            callback: function(value, index, values) {
                return value.toLocaleString() + " IXI";
            }
        }
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: {
        filter: ctx => ctx.datasetIndex == 0,
        callbacks: {
          title: ctx => {
            if (ctx.length) {
              var data = ctx[0].dataset.data;
              var value = data[ctx[0].dataIndex];
              var total = data.reduce((a, b) => a + b, 0);
              var percent = Math.round(value / total * 100);
              return "Block #" + blockSigningLabels[ctx[0].dataIndex];
            }
          },
          label: ctx => {
            var value = ctx.dataset.data[ctx.dataIndex];
            return "Signing Reward: " + value + " IXI";
          }
        },
      }
    }
  }
});     
    
        
var blockProjectedLabels = [1, 250000, 500000, 750000, 1000000, 1250000, 1500000, 1750000, 1802000, 2000000, 2250000, 2500000, 2750000, 3000000, 3250000, 3500000, 3750000, 4000000, 4250000, 4500000, 4750000, 5000000, 5250000, 5500000, 5750000, 6000000, 6250000, 6500000, 6750000, 7000000, 7250000, 7500000, 7750000, 8000000, 8250000, 8500000, 8750000, 9000000, 9250000, 9500000, 9750000, 10000000, 10250000, 10500000, 10750000, 11000000, 11250000, 11500000, 11750000, 12000000, 12250000, 12500000, 12750000, 13000000, 13250000, 13500000, 13750000, 14000000, 14250000, 14500000, 14750000, 15000000, 15250000, 15500000, 15750000, 16000000
];
var closestBlockProjectedLabel = blockProjectedLabels.reduce(function(prev, curr) {
  return (Math.abs(curr - blockHeight) < Math.abs(prev - blockHeight) ? curr : prev);
});

var ctx2 = document.getElementById("chart-2");
var myLineChart2 = new Chart(ctx2, {
  type: 'line',
  data: {
    labels: blockProjectedLabels,
    datasets: [
        {
          label: "Projected IXI in circulation",
          lineTension: 0,
          backgroundColor: "rgba(78, 115, 223, 0.05)",
          borderColor: "rgba(78, 115, 223, 1)",
          pointRadius: 1,
          pointBackgroundColor: "rgba(78, 115, 223, 1)",
          pointBorderColor: "rgba(78, 115, 223, 1)",
          pointHoverRadius: 1,
          pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
          pointHoverBorderColor: "rgba(78, 115, 223, 1)",
          pointHitRadius: 1,
          pointBorderWidth: 1,
          data: [
            2000320002, 2088776452, 2328422958, 2712591418, 3243099696, 3877178318, 4522216104, 5175367465, 5312249560, 5654393560, 6086393560, 6518393560, 6950393560, 7382393560, 7814393560, 8246393560, 8678393560, 9110393560, 9542393560, 9974393560, 10406393560, 10838393560, 11270393560, 11702393560, 12134393560, 12566393560, 12998393560, 13263812920, 13479812920, 13695812920, 13911812920, 14127812920, 14343812920, 14559812920, 14775812920, 14991812920, 15207812920, 15423812920, 15639812920, 15838877800, 15946877800, 16054877800, 16162877800, 16270877800, 16378877800, 16486877800, 16594877800, 16702877800, 16810877800, 16918877800, 17026877800, 17134877800, 17195281570, 17215531570, 17235781570, 17256031570, 17276281570, 17296531570, 17316781570, 17337031570, 17357281570, 17377531570, 17397781570, 17418031570, 17438281570, 17450179534
          ],
          yAxisID: 'yaxis0'
        },
        {
        type: 'bar',
        label: "Today",
        data: [
          { x: closestBlockSigningLabel, y: 17450179534 }
        ],
        maxBarThickness: 3,
        borderColor: "#F09A1D",
        borderWidth: 2,
        borderSkipped: false,
        yAxisID: 'yaxis0'
      } 
    ]
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
    scales: {
      x: {
        type: 'linear',
        gridLines: {
          display: true,
          drawBorder: true
        },
        ticks: {
          maxTicksLimit: 10,
            callback: function(value, index, values) {
                        return "#"+value;
            }            
        }
      },
      yaxis0: {
		type: 'linear',
		display: true,
		position: 'left',
        ticks: {
            callback: function(value, index, values) {
                return value.toLocaleString() + " IXI";
            }
        }
      }
    },
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      tooltip: {
        filter: ctx => ctx.datasetIndex == 0,
        callbacks: {
          title: ctx => {
            if (ctx.length) {
              var data = ctx[0].dataset.data;
              var value = data[ctx[0].dataIndex];
              var total = data.reduce((a, b) => a + b, 0);
              var percent = Math.round(value / total * 100);
              return "Block #" + blockProjectedLabels[ctx[0].dataIndex];
            }
          },
          label: ctx => {
            var value = ctx.dataset.data[ctx.dataIndex];
            return "Projected IXI in circulation: " + value + " IXI";
          }
        },
      }
    }
  }
}); 
</script>