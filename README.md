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

Now run the program
```bash
node analyze.js
```

You will get a nice JSON blob with call data in ```public``` as well as some stats on the screen

#### TODO

The old analyze.pl was a more comprehensive stats generator.  This is now being rewritten into ETL and analyze components.  It's an incomplete work in progress.


