# Asterisk-analyze

#### Prerequisites
1. Node
2. MySQL
3. Redis


#### Configure
1. Create MySQL table
```sql
CREATE TABLE calls (
`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
stamp datetime NOT NULL,
data text null
)ENGINE=innodb DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
2. Create config file
```bash
cp config.json.sample config.json
```
3. Edit ```config.json``` and edit the MySQL credentials, etc 


#### Install and run
```bash
# Production
npm install
npm run build	# Run tests, lint, transcode frontend app to ES5, minify bundle.js 
node syslogd.js	# Back end, gather data
node server.js  # Front end, pretty graphs

# Development
npm install
npm run dev		# Automatically watches and runs nodemon, browsersync, lint, webpack.  Browse to http://localhost:3001/ 
```


#### Configure Asterisk (FreePBX) to send log files to us 

If you don't want to install on the asterisk machine itself, you can stream the log files from asterisk to the analyzer.  This is a two step process, since asterisk doesn't seem to use syslog by default.  

1. First configure asterisk to use the syslog.  Edit ```/etc/asterisk/logger_logfiles_custom.conf``` (or ```logger.conf``` on pure asterisk systems) and add a line like the following: 
```
; Send logs to syslog so we can stream them offsite and analyze
syslog.local0 =>  verbose
```
2. Now tell syslog to stream the log to your analyze server. Edit ```/etc/syslog.conf``` (or rsyslog.conf, or for Debian place a new .conf file into /etc/rsyslog.d)
```
# Send asterisk logs to the analyzer
local0.*            @my.server.address
```
3. Restart asterisk: ```asterisk -rx "logger reload"```
4. Restart syslog: ```service syslogd restart``` (or rsyslogd)


#### Manual data import
0. ```node etl.js --gulp --dry-run``` to do a one time analysis.  Stats written to the console.
0. ```node etl.js --gulp``` to ingest the input file and log to the database.
1. ```node etl.js``` to run the ETL daemon.  Input file is watched rather than ingested.  Data goes to database.
2. ```npm run build``` to build
3. ```npm start``` to start the server
4. Navigate to server/index.html to see the pretty graphs


In ```--gulp``` mode, etl will read the whole input file specified in the config and exit rather than following file modificaitons.   Add --dry-run to print stats without adding anything to the database.  For example, reading an asterisk log file called "december" and giving some stats would look like this:

```bash
node etl.js --general.input=december --gulp --dry-run
```

Without the ```--gulp``` switch (or gulp in the config), etl watches the input file for new data.

etl merges the new data with the unclosed calls in the database, so you should be able to ingest the same data more than once without getting duplicates.  Be aware, however, that syslogd.js uses the current time from Date() since no timestamp is sent with the logs.  This means that a different date might be logged to the asterisk log than what is streamed via syslog.  If you then re-ingest those files you might get duplicates.  TODO: this could be fixed later by reading all calls and comparing using SIP ID instead of limiting our duplicate search to calls that happened at that moment.  syslogd.js does not check for duplicates.


#### TODO
- etl should not require database connection in --dry-run mode
- Use bootstrap to organize the views
- Add more graphs
- etl does duplicate detection, but it may not be able to detect duplicates added by syslogd because syslogd must use its own time source (TODO: add some time fuzz here so we rely more on the SIP ID of the caller)
- syslogd may accumulate garabage SIP IDs over time if it sees but does not properly understand outgoing calls. This may effectively constitute a memory leak.  Prune calls older than a week (or something).


