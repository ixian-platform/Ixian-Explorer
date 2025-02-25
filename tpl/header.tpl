<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <title>Ixian Block Explorer | Analyze Blocks, Transactions & Network Activity</title>
    <meta name="description"
          content="Explore the Ixian blockchain with real-time transaction tracking, block details, and network insights.">
    <meta name="keywords" content="Ixian,DLT,Blockchain,Cryptocurrency,Crypto,IXI,Explorer,Spixi, transactions, blocks, nodes, statistics, emissions">

    <meta property="og:title" content="Ixian Block Explorer | Analyze Blocks, Transactions & Network Activity" />
    <meta property="og:description" content="Explore the Ixian blockchain with real-time transaction tracking, block details, and network insights." />
    <meta property="og:image" content="https://explorer.ixian.io/gfx/og-ixiscope.jpg" />
    <meta property="og:url" content="https://explorer.ixian.io" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ixiscope" />

    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />

    <link href="vendor/fontawesome-free-6.7.1-web/css/all.css" rel="stylesheet" type="text/css">
    <link href="<?php echo versionedAsset('css/sb-admin-2.css'); ?>" rel="stylesheet">
    <link href="<?php echo versionedAsset('css/explorer.css'); ?>"  rel="stylesheet">
    <link href="<?php echo versionedAsset('css/header.css'); ?>"  rel="stylesheet">
    <link href="<?php echo versionedAsset('css/footer.css'); ?>"  rel="stylesheet">

    <link href="vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">

    <!-- Bootstrap core JavaScript-->
    <script src="vendor/jquery/jquery.min.js"></script>
    <script src="vendor/bootstrap/js/popper.min.js"></script>
    <script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>

    <!-- Core plugin JavaScript-->
    <script src="vendor/jquery-easing/jquery.easing.min.js"></script>

</head>
<body>
    <main class="mainContent">
        <div class="bg-3 posSticky">
            <div class="navSearchMobile">
                <form class="navSearchInput" method="get">
                    <input type="hidden" name="p" value="search"/>
                    <input class="input" aria-label="Search" name="q" value="<?php echo $this->q;?>" type="text" placeholder="Type or paste blocks, addresses or transaction ID"/>
                    <button type="submit" class="button btn-p">Go <i class="fa fa-arrow-right"></i></button>
                </form>
            </div>
            <nav class="navbar navbar-expand-lg navbar-light header pageLimitWrapper">
                <div class="navLeftSide">
                    <a class="navbar-brand" href="index.php">
                        <img src="gfx/ixiscope-logotype.svg" alt="ixiscope-logo" width="118px" />
                    </a>
                    <form class="navSearchInput navLeftSideInput" method="get">
                        <input type="hidden" name="p" value="search"/>
                        <input class="input" aria-label="Search" name="q" value="<?php echo $this->q;?>" type="text" placeholder="Type or paste blocks, addresses or transaction ID"/>
                        <button type="submit" class="button btn-p">Go <i class="fa fa-arrow-right"></i></button>
                    </form>
                </div>

                <button class="navbar-toggler menuButton" type="button" data-toggle="collapse" data-target="#navbarNavDropdown" aria-controls="navbarNavDropdown" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse justify-content-end" id="navbarNavDropdown">
                    <ul class="navbar-nav headerUl">
                        <li>
                            <a class="headerItem label-sm" href="index.php">Blocks</a>
                        </li>
                        <li>
                            <a class="headerItem label-sm" href="?p=nodes">Nodes</a>
                        </li>
                        <li>
                            <a class="headerItem label-sm" href="?p=network">Statistics</a>
                        </li>
                        <li>
                            <a class="headerItem label-sm" href="?p=top">Top 20</a>
                        </li>
                        <li>
                            <a class="headerItem label-sm" href="?p=emissions">IXI Emissions</a>
                        </li>
                        <li>
                            <i class="fa fa-moon themeToggle" id="theme-toggle"></i>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>

            <script>
                document.addEventListener('DOMContentLoaded', () => {
                    const currentSearch = window.location.search;
                    const themeToggleButton = document.getElementById('theme-toggle');
                    const rootElement = document.documentElement;

                    if (currentSearch === "") {
                        // Select the element to hide
                        const navSearchMobile = document.querySelector('.navSearchMobile');
                        const navLeftSideSearch = document.querySelector('.navLeftSideInput');

                        // Hide the element if it exists
                        if (navSearchMobile) {
                            navSearchMobile.style.display = 'none';
                            navLeftSideSearch.style.display = 'none';
                        }
                    }

                    const updateThemeIcon = () => {
                        if (rootElement.classList.contains('dark-mode')) {
                            themeToggleButton.classList.add('fa-sun');
                            themeToggleButton.classList.remove('fa-moon');
                        } else {
                            themeToggleButton.classList.add('fa-moon');
                            themeToggleButton.classList.remove('fa-sun');
                        }
                        updateImagesForTheme()
                    };

                    // Load saved theme from localStorage
                    const savedTheme = localStorage.getItem('theme');
                    if (savedTheme) {
                        rootElement.classList.add(savedTheme);
                    }

                    updateThemeIcon();

                    themeToggleButton.addEventListener('click', () => {
                        // Toggle the dark-mode class
                        rootElement.classList.toggle('dark-mode');

                        // Save the current theme to localStorage
                        if (rootElement.classList.contains('dark-mode')) {
                            localStorage.setItem('theme', 'dark-mode');
                        } else {
                            localStorage.removeItem('theme');
                        }

                        updateThemeIcon();
                    });

                    function getThemePath() {
                        const theme = localStorage.getItem('theme');
                        return theme === 'dark-mode' ? 'gfx/icons/dark' : 'gfx/icons/light';
                    }

                    function updateImagesForTheme() {
                        const themePath = getThemePath();
                        document.querySelectorAll('.theme-dependent').forEach(img => {
                            const iconName = img.getAttribute('data-icon');
                            img.src = `${themePath}/${iconName}`;
                        });
                    }
                });

        </script>

            <?php if($this->alert > 0) {?>
            <div class="alertContainer">
            <div class="alertCardWarning">
            <i class="fa fa-hourglass-start"></i>
            <p class="body-sm"><span class="label-sm">ixiscope DLT Node is synchronizing.</span> Data may be out of date, please try again later.</p>
            </div>
            </div>
            <?php }?>