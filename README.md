# Asterisk-analyze


#### Install

```bash
npm install
```

#### Configure
```bash
cp config.json.sample config.json
vi config.cfg
```

#### SQL
```sql
CREATE TABLE calls (
`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
start datetime not null,
data text null
)ENGINE=innodb;
```

#### Run the program
1. ``` node etl.js``` to run the ETL daemon (add ```--gulp``` to ingest the whole file)
2. ```npm run build``` to build
3. ```npm start``` to start the server
4. Navigate to server/index.html to see the pretty graphs


In ```--gulp``` mode, etl will read the whole input file specified in the config and exit rather than following file modificaitons.  It will also merge the new data with the unclosed calls in the database.  This is slower, but keeps you from adding duplicates.

Without the ```--gulp``` switch (or gulp in the config), etl watches the input file for new data.

#### TODO
- calls.json should not be embedded in the build (go to AJAX)
- Use bootstrap to organize the views
- Add more graphs


