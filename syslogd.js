var promise=require("bluebird");
var asterisklog=require("./lib/asterisklog.js");
var nconf = require('nconf');
var log = require("bunyan").createLogger({"name":"asterisk-analyze-syslog"});
var mysql = require("promise-mysql");
var moment = require("moment");
var Redis = require("ioredis"); //promise.promisifyAll(require("redis"));
var syslogd = require("syslogd");

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
	.on("enqueued", ()=>{

		log.info("Call in queue");
		redis.publish("calls",JSON.stringify(call));
	})
	.on("end", (call) => {

		log.info("Call ended. Inserting into database");
		redis.publish("calls",JSON.stringify(call));
		pool.query("INSERT INTO calls (stamp, data) VALUES ( ?, ?)",[moment(call.start).format('YYYY-MM-DD HH:mm:ss'),JSON.stringify(call)])
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


