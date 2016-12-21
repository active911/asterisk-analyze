var promise=require("bluebird");
var asterisklog=require("./lib/asterisklog.js");
var nconf = require('nconf');
var log = require("bunyan").createLogger({"name":"asterisk-analyze-syslog"});
var mysql = require("promise-mysql");
var moment = require("moment");
var redis = new (require("ioredis"))(); //promise.promisifyAll(require("redis"));
var syslogd = require("syslogd");

// Read the config
nconf
	.argv()
	.env()
	.file({ file: 'config.json' })
	.defaults({ "general" : { "input" : "full", "output" : "calls.json", "mode" : "follow" } });

// Create analyzer
var al=new asterisklog({queues: nconf.get('asterisk').queues});

// // Listen for incoming messages
// syslogd((entry) => {

// 	console.log(JSON.stringify(entry));

// },{ "address" : nconf.get("general").syslogd.address}).listen(nconf.get("general").syslogd.port, (err)=>{

// 	if(err){
// 		console.log("error "+err);
// 	}

// 	console.log("listening");
// });

// Listen for incoming messages
syslogd((entry) => {

	console.log(JSON.stringify(entry));

},{ "address" : "127.0.0.1"}).listen(514, (err)=>{

	if(err){
		console.log("error "+err);
	}

	console.log("listening");
});