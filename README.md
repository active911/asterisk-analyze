# Asterisk-analyze

#### Prerequisites
1. Node
2. MySQL
3. Redis


#### Install

```bash
npm install
```

#### Configure
```bash
cp config.json.sample config.json
vi config.cfg
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


#### SQL
```sql
CREATE TABLE calls (
`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
start datetime not null,
data text null
)ENGINE=innodb;
```

#### Run the program
0. ```node analyze.js``` to do a one time analysis.  Output JSON is written to the output file specified in general.output.  Stats written to the console.
1. ```node etl.js``` to run the ETL daemon (add ```--gulp``` to ingest the whole file).  Data goes to database.
2. ```npm run build``` to build
3. ```npm start``` to start the server
4. Navigate to server/index.html to see the pretty graphs


In ```--gulp``` mode, etl will read the whole input file specified in the config and exit rather than following file modificaitons.  It will also merge the new data with the unclosed calls in the database.  This is slower, but keeps you from adding duplicates.

Without the ```--gulp``` switch (or gulp in the config), etl watches the input file for new data.

#### TODO
- calls.json should not be embedded in the build (go to AJAX)
- Use bootstrap to organize the views
- Add more graphs


