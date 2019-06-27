var promise=require("bluebird");
var asterisklog=require("./lib/asterisklog.js");
var nconf = require('nconf');
var log = require("bunyan").createLogger({"name":"asterisk-analyze-syslog"});
var mysql = require("promise-mysql");
var moment = require("moment");
var Redis = require("ioredis"); //promise.promisifyAll(require("redis"));
var syslogd = require("syslogd");
const Objectpath=require("object-path");

// Read the config
nconf
	.argv()
	.env()
	.file({ file: 'config.json' })
	.defaults({ "general" : { "input" : "full", "output" : "calls.json", "mode" : "follow" } });


// Redis
var redis=new Redis();

// MySQL pool.  We use this so we can have auto reconnect.
var pool=mysql.createPool(nconf.get('mysql'));

// Create analyzer
var al=new asterisklog({queues: nconf.get('asterisk').queues, "require_timestamps" : false });
al
	.on("start", (call) => {

		log.info("New call started");
		redis.publish("calls",JSON.stringify(call));
	})
	.on("enqueued", (call)=>{

		log.info("Call in queue");
		redis.publish("calls",JSON.stringify(call));
	})
	.on("end", (call) => {

		log.info("Call ended. Inserting into database");
		redis.publish("calls",JSON.stringify(call));

		// Extract safe values from call object, knowing that not all of them are guaranteed to exist
		let start=Objectpath.get(call, "start", null)?parseInt(moment(Objectpath.get(call, "start")).format("X")):null;
		let answered=Objectpath.get(call, "answered", null)?parseInt(moment(Objectpath.get(call, "answered")).format("X")):null;
		let end=Objectpath.get(call, "end", null)?parseInt(moment(Objectpath.get(call, "end")).format("X")):null;
		let duration=(start && end)?(end-start):null;		
		let caller_id=Objectpath.get(call, "caller_id", null);		
		let answered_by=Objectpath.get(call, "answered_by", null);		
		let attributes=Object.keys(call).filter((key)=>(["start", "answered", "end", "caller_id", "answered_by"].indexOf(key)==-1)).reduce((acc, cur)=>{ acc[cur]=call[cur]; return acc; },{});

		pool.query("INSERT INTO "+(nconf.get('mysql').table||"calls")+" (start, answered, end, duration, caller_id, answered_by, attributes) VALUES ( FROM_UNIXTIME(?), FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?, ?, ?, ?)",[start, answered, end, duration, caller_id, answered_by, JSON.stringify(attributes) ])
		// pool.query("INSERT INTO "+(nconf.get('mysql').table||"calls")+" (stamp, data) VALUES ( ?, ?)",[moment(call.start).format('YYYY-MM-DD HH:mm:ss'),JSON.stringify(call)])
			.then(()=>{
				log.info("Call inserted into database successfully.");
			})
			.catch((e)=>{
				log.error("Error inserting into database: "+e);
			});
	});	


// Listen for incoming messages
syslogd((entry) => {

	if(entry.address==nconf.get('general').syslogd.allow) {

//		log.info("Data: "+entry.msg);
		al.add(entry.msg.trim());

	} else {

		console.log("Disallowing remote data from "+entry.address);
	}

},{ "address" : nconf.get("general").syslogd.address}).listen(nconf.get("general").syslogd.port, (err)=>{

	if(err){
		
		throw err;	// Typically because we forgot to sudo

	} else {

		log.info("Listening");
	}
});


