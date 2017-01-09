var express=require('express');
var app = express();
var morgan=require('morgan');
var body_parser = require("body-parser");
var log = require("bunyan").createLogger({"name":"asterisk-analyze"});
var promise=require("bluebird");
var nconf = require('nconf');
var stream=require('stream');
var mysql = require("promise-mysql");


// Read the config
nconf.argv().env().file({ file: 'config.json' });


// A stream to pipe morgan (http logging) to bunyan
(info_log_stream=new stream.Writable())
._write=(chunk, encoding, done) => {

    log.info(chunk.toString().replace(/^[\r\n]+|[\r\n]+$/g,""));
    done();
};

// Connect to the databsae
var db;
mysql
	.createConnection(nconf.get('mysql'))
	.then((c)=>{

		log.info("Connected to database");
		db=c;
		app.listen(3000, function() {

	    	log.info("webservice listening on %s", 3000);
		});
	});


app
	.use(morgan(':remote-addr ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms', { "stream" : info_log_stream }))   // Morgan HTTP logging
	.use(express.static("public"))

	// TODO... should we really be sending call data?  Shouldn't we analyze it locally, then send the results?  It depends on what metrics we expect to expose

	.get("/api/calls/:year/:month",(req, res)=>{

		// Calculate date ranges
		let [year, month]=[req.params.year, req.params.month];
		let from=`${year}-${month}-01`;
		month++;if(month>12) {month=1; year++;}
		let to=`${year}-${month}-01`;

		// Fetch from database
		db.query("SELECT id, data FROM calls WHERE stamp BETWEEN ? AND ? ORDER BY stamp",[from, to])// WHERE stamp = ?", [moment(call.start).format('YYYY-MM-DD HH:mm:ss')])
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
