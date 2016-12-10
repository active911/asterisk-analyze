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

#### Run the program
1. ```node analyze.js``` to generate calls.json
2. ```npm run build``` to build
3. ```npm start``` to start the server
4. Navigate to server/index.html to see the pretty graphs


#### TODO

- calls.json should not be embedded in the build (go to AJAX)
- Use bootstrap to organize the views
- Add more graphs


