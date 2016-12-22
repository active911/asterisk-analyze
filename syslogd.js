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

// Create analyzer
var al=new asterisklog({queues: nconf.get('asterisk').queues});


// Connect to the databsae
mysql
	.createConnection(nconf.get('mysql'))
	.then((c)=>{

		log.info("Connected to database");
		var redis=new Redis();

		// A new call has been found
		al.on("start", (call) => {

			log.info("New call started");
			redis.publish("calls",JSON.stringify(call));
		})
		.on("enqueued", ()=>{

			log.info("Call in queue");
			redis.publish("calls",JSON.stringify(call));
		})
		.on("end", (call) => {

			log.info("Call ended");
			redis.publish("calls",JSON.stringify(call));


			// See if this record already exists
			c
				.query("SELECT id, data FROM calls WHERE start = ?", [moment(call.start).format('YYYY-MM-DD HH:mm:ss')])
				.then((rows) =>{


					for(n in rows) {

						var data=JSON.parse(rows[n].data);
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

					if(b) c.query("INSERT INTO calls (start, data) VALUES ( ?, ?)",[moment(call.start).format('YYYY-MM-DD HH:mm:ss'),JSON.stringify(call)]);
				});		
		});	

		return promise.resolve(true);
	})
	.then(()=>{


		// Listen for incoming messages
		syslogd((entry) => {

			if(entry.address==nconf.get('general').syslogd.allow) {

				//log.info("Data: "+entry.msg);
				al.add(entry.msg.trim());

			} else {

				console.log("Disallowing remote data from "+entry.address);
			}

		},{ "address" : nconf.get("general").syslogd.address}).listen(nconf.get("general").syslogd.port, (err)=>{

			if(err){
				
				throw err;	// Typically because we forgot to sudo

			} else {

				log.info("Listening");
				return promise.resolve(true);
			}

		});

	})
	.catch((err) =>{

		log.error(err);
		log.error("Quitting");
		process.exit();
	});


