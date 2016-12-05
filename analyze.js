var asterisklog=require("./lib/asterisklog.js");
var promise=require("bluebird");
var fs=promise.promisifyAll(require("fs"));
var linebyline=require("line-by-line");
var nconf = require('nconf');

// Read the config
nconf.argv().env().file({ file: 'config.json' });
var al=new asterisklog({queues: nconf.get('asterisk').queues});

// Pump a log file into the analyzer
(new linebyline(nconf.get('general').logfile))
	.on("line", (line)=>al.add(line))
	.on("end", ()=>{

		// Write calls to calls.json
		var calls=al.get_calls();
		fs
			.writeFileAsync("public/calls.json",JSON.stringify(calls))
			.then(()=>{

				console.log(calls.length+" calls written");

			})
			.catch((err)=>{

				console.log("Error: "+err);
			});
	});


// A new call has been found
al.on("start", (call) => {

	// Do something cool
});

