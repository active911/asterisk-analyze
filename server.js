var server=require("http").createServer();
var express=require('express');
var morgan=require('morgan');
//var url=require("url");
var log = require("bunyan").createLogger({"name":"asterisk-analyze"});
var nconf = require('nconf');
var stream=require('stream');
var mysql = require("promise-mysql");
var WebsocketServer=require("ws").Server;
var redis = new (require("ioredis"))(); 

// Read the config
nconf.argv().env().file({ file: 'config.json' });


// A stream to pipe morgan (http logging) to bunyan
(info_log_stream=new stream.Writable())
._write=(chunk, encoding, done) => {

    log.info(chunk.toString().replace(/^[\r\n]+|[\r\n]+$/g,""));
    done();
};


// Websockets server
var wss=new WebsocketServer({server: server});

// Alert clients when new call happens
redis.subscribe("calls",(err)=>console.log(err?err:"Subscribed to 'calls' on Redis"));
redis.on("message", (channel, msg)=>{

	// Verify channel
	if(channel!="calls") return;

	// Get the call
	let call=JSON.parse(msg);

	// Only send finished calls (so we don't complicate things and maybe cause the webapp to ingest mutating data)
	if(!call.end) return;

	// Broadcast call to all clients
	wss.clients.forEach((client)=>client.send(msg));
	log.info("Call ended, sending to all clients");
});

// wss.on("connection",(ws)=>{

// 	let location=url.parse(ws.upgradeReq.url, true);
// 	log.info("websocket client connected to path '"+location.pathname+"'");
// 	// ws.send("Hello...",()=>{});
// 	// ws.on("message",(msg)=>{

// 	// 	log.info("Websockets message: "+msg);
// 	// })
// 	.on("close",()=>{
// 		clearInterval(iv);
// 		log.info("websocket client closed");
// 	});
// });


// Web app
var app = express();
server.on("request", app);
app
	.use(morgan(':remote-addr ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms', { "stream" : info_log_stream }))   // Morgan HTTP logging
	.use(express.static("public"))
	.get("/api/calls/:year/:month",(req, res)=>{

		// Calculate date ranges
		let [year, month]=[req.params.year, req.params.month];
		let from=`${year}-${month}-01`;
		month++;if(month>12) {month=1; year++;}
		let to=`${year}-${month}-01`;

		// Fetch from database
		db.query("SELECT id, data FROM ? WHERE stamp BETWEEN ? AND ? ORDER BY stamp",[nconf.get('mysql').table, from, to])// WHERE stamp = ?", [moment(call.start).format('YYYY-MM-DD HH:mm:ss')])
		.then((rows) =>{

			var data=[];
			for(let r of rows) {

				data.push({
        			"type"			:	"call",
        			"id"			:	r.id,
        			"attributes"	:	JSON.parse(r.data)
        		});
			}

			res
		    	.set('Content-Type', 'text/json')
		        .status(200)
	            .send(JSON.stringify({
	            	"data" : data
	            }));
		})
		.catch((e)=>{

			log.error("Error: " + e);
            res
            	.set('Content-Type', 'text/json')
                .status(500)
	            .send(JSON.stringify({

	            	"errors" : [

	            		{
	            			"title" : "internal error",
	            			"detail": "See server logs for details"
	            		}
	            	]
	            }));

		});

	});


// Connect to the database and start the server
var db;
mysql
	.createConnection(nconf.get('mysql'))
	.then((c)=>{

		log.info("Connected to database");
		db=c;
		server.listen(3000, function() {

	    	log.info("webservice listening on %s", 3000);
		});
	});







