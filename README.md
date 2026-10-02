# Ixian-Explorer

## About Ixian Explorer
Ixian Explorer implementation for Ixian DLT.
Discover Ixian in the main repository here: https://github.com/ProjectIxian


## Requirements
A typical LAMP/WAMP/MAMP setup is needed for proper functionality.
Development tests were done with the following software versions:
- Apache 2.4 (with mod_rewrite)
- Mariadb 10.1
- PHP 7.2

The explorer operator needs to run an Ixian DLT node for the explorer to connect to.
Explorer will fetch block, transaction and wallet data from Ixian DLT node.


## Deploying
1. Create SQL database and import the included pool.sql file
```
mysql -e "CREATE DATABASE explorer01"
mysql -e "CREATE USER 'explorer01'@'localhost' IDENTIFIED BY 'myPassword'"
mysql -e "GRANT ALL PRIVILEGES ON explorer01.* TO 'explorer01'@'localhost'"
mysql ixian < explorer.sql
```

2. Edit config.php and set the parameters as required, most important parameters are:
```
// Database configuration
$db_host = "127.0.0.1"; // Database host
$db_user = "explorer01"; // Database username
$db_pass = "myPassword"; // Database password
$db_name = "explorer01"; // Database name

// Ixian Node configuration
$dlt_host = "http://localhost:8081"; // DLT Node that the explorer connects to
```

3. Set crontab entries
```
crontab -l | { cat; echo "*/1 * * * * cd /var/www/html/internal && /usr/bin/php fetchstatus.php > /dev/null"; } | crontab -
crontab -l | { cat; echo "*/1 * * * * cd /var/www/html/internal && /usr/bin/php sync.php > /dev/null"; } | crontab -
crontab -l | { cat; echo "*/5 * * * * cd /var/www/html/internal && /usr/bin/php updatetxstats.php > /dev/null"; } | crontab -
```

## ixiscope (new front end)
The redesigned explorer front end lives in `web/` (a static Next.js site) and reads the explorer's database through the read-only API in `ixiscope-api/`. The existing pages and cron jobs keep working as they are. Setup, including the node map job: `ixiscope-api/README.md`.


## Usage
Navigate to the explorer's HTTP/s - i.e. http://localhost/index.php.



## License Mentions
Ixian Explorer uses Bootstrap, Chart.js, FontAwesome and jQuery among other software libraries.


## Get in touch / Contributing
If you feel like you can contribute to the project, or have questions or comments, you can get in touch with the team through Discord: (https://discord.gg/dbg9WtR)
