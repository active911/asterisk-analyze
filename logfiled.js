const promise=require("bluebird");
const asterisklog=require("./lib/asterisklog.js");
const nconf = require('nconf');
const fs=promise.promisifyAll(require("fs"));
const linebyline=require("line-by-line");
const Tail = require('always-tail2');
const log = require("bunyan").createLogger({"name":"asterisk-analyze-etl"});
const mysql = require("promise-mysql");
const moment = require("moment");
const Objectpath = require("object-path");

// Read the config
nconf
	.argv()
	.env()
	.file({ file: 'config.json' })
	.defaults({ "general" : { "input" : "full", "output" : "calls.json", "mode" : "follow" } });

// Create analyzer
var al=new asterisklog(nconf.get('asterisk'));

// Ensure input file exists
if(!fs.existsSync(nconf.get('general').input)){

	log.error("Error - cannot read from input file '"+nconf.get('general').input+"'");
}

// Create Redis client
//var redis

// Connect to the databsae
mysql
	.createConnection(nconf.get('mysql'))
	.then((c)=>{

		log.info("Connected to database");

		// A new call has been found
		al.on("start", (call) => {

			// Skip if in test mode
			if(nconf.get('dry-run')) return;

			log.info("New call started");
		})
		.on("enqueued", (call)=>{

			// Skip if in test mode
			if(nconf.get('dry-run')) return;

			log.info("Call in queue");
		})
		.on("end", (call) => {

			// Skip if in test mode
			if(nconf.get('dry-run')) return;

			log.info("Call ended");

			// See if this record already exists
			c
				.query("SELECT id, attributes FROM "+(nconf.get('mysql').table||"calls")+" WHERE start = ?", [moment(call.start).format('YYYY-MM-DD HH:mm:ss')])
				.then((rows) =>{


					for(let n in rows) {

						var data=JSON.parse(rows[n].attributes);
						if (call.id == data.id){

							if(call.end) {

								// This is a match.  Call already listed as ended.  Do not insert.
								log.info("Existing call found.  Not saving in database");
								return promise.resolve(false);
							}
						}
					}

					// No matching call.  Insert
					log.info("Inserting new call into database");
					return promise.resolve(true);

				})
				.then((b)=>{

					let start=Objectpath.get(call, "start", null)?parseInt(moment(Objectpath.get(call, "start")).format("X")):null;
					let answered=Objectpath.get(call, "answered", null)?parseInt(moment(Objectpath.get(call, "answered")).format("X")):null;
					let end=Objectpath.get(call, "end", null)?parseInt(moment(Objectpath.get(call, "end")).format("X")):null;
					let enqueued=Objectpath.get(call, "enqueued", null)?parseInt(moment(Objectpath.get(call, "enqueued")).format("X")):null;
					let duration=(start && end)?(end-start):null;		
					let caller_id=Objectpath.get(call, "caller_id", null);		
					let answered_by=Objectpath.get(call, "answered_by", null);		
					let attributes=Object.keys(call).filter((key)=>(["start", "answered", "end", "caller_id", "answered_by", "enqueued"].indexOf(key)==-1)).reduce((acc, cur)=>{ acc[cur]=call[cur]; return acc; },{});

					if(b) c.query("INSERT INTO "+(nconf.get('mysql').table||"calls")+" (start, answered, end, enqueued, duration, caller_id, answered_by, attributes) VALUES ( FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, ?, ?)",[start, answered, end, enqueued, duration, caller_id, answered_by, JSON.stringify(attributes) ])
					//if(b) c.query("INSERT INTO "+(nconf.get('mysql').table||"calls")+" (stamp, data) VALUES ( ?, ?)",[moment(call.start).format('YYYY-MM-DD HH:mm:ss'),JSON.stringify(call)]);
				});		
		});	

		// Start watching
		if(reader instanceof Tail) reader.watch();
		return promise.resolve(true);
	})
	.catch((err) =>{

		log.error(err);
		if(reader instanceof Tail) reader.unwatch();
		log.error("Quitting");
		exit();
	});


// Select a reader
var reader = (nconf.get('gulp'))?(new linebyline(nconf.get('general').input)):(new Tail(nconf.get('general').input));

reader
	.on("line", (line)=>al.add(line))
	.on('error', (err) => {

		log.error("Error - "+err);
		log.error("Quitting");
		if(reader instanceof Tail) reader.unwatch();
		exit();
	})
	.on("end",()=>{

		if(reader instanceof linebyline) {

		// Test mode exits with stats
		if(nconf.get('dry-run')){

			al.print_stats();
		}
			
			process.exit();
		}
		exit();		
	});




