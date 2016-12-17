var asterisklog=require("./lib/asterisklog.js");
var promise=require("bluebird");
var fs=promise.promisifyAll(require("fs"));
var linebyline=require("line-by-line");
var nconf = require('nconf');
var crossfilter = require('crossfilter');


// Read the config
nconf
	.argv()
	.env()
	.file({ file: 'config.json' })
	.defaults({ "input" : "full", "output" : "src/calls.json" });

// Create analyzer
var al=new asterisklog({queues: nconf.get('asterisk').queues});

// If the output file exists, we will merge with it
if(fs.existsSync(nconf.get('general').output)){

	var data=JSON.parse(fs.readFileSync(nconf.get('general').output));
	console.log(data.length+" entries read from " + nconf.get('general').output + " will be merged with new data");
	al.set_calls(data);
}

// Pump a log file into the analyzer
(new linebyline(nconf.get('general').input))
	.on("line", (line)=>al.add(line))
	.on("end", ()=>{

		// Write calls to calls.json
		var calls=al.get_calls();
		fs
			.writeFileAsync(nconf.get('general').output, JSON.stringify(calls))
			.then(()=>{

				console.log(calls.length+" calls written");

			})
			.then(()=>{

				// Analyze with crossfilter
				var cf=crossfilter(calls);
				var extension_dim=cf.dimension((d)=>d.answered_by);
				var extension_group=extension_dim.group();
				console.log("Here is where all the calls went:");
				console.log(JSON.stringify(extension_group.all()));

				// Dimension hold time, and get only calls that did hold
				var queue_time_dim=cf.dimension((d)=>(d.enqueued && d.answered)?(d.answered-d.enqueued)/1000:0);
				queue_time_dim.filter((v)=>(v!=0));
				var queuers=queue_time_dim.top(Infinity);
				console.log("Average hold time: "+queuers.reduce((p,v)=>{return p+((v.answered-v.enqueued)/1000);},0)/queuers.length);


			})
			.catch((err)=>{

				console.log("Error: "+err);
			});
	});


// A new call has been found
al.on("start", (call) => {

	// Do something cool
});

