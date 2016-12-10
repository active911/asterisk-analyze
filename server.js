var express=require('express');
var app = express();
var morgan=require('morgan');
var body_parser = require("body-parser");
var log = require("bunyan").createLogger({"name":"asterisk-analyze"});
var promise=require("bluebird");
var nconf = require('nconf');
var stream=require('stream');


// Read the config
nconf.argv().env().file({ file: 'config.json' });


// A stream to pipe morgan (http logging) to bunyan
(info_log_stream=new stream.Writable())
._write=(chunk, encoding, done) => {

    log.info(chunk.toString().replace(/^[\r\n]+|[\r\n]+$/g,""));
    done();
};


app
	.use(morgan(':remote-addr ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms', { "stream" : info_log_stream }))   // Morgan HTTP logging
	.use(express.static("public"))
	.listen(3000, function() {

    	log.info("FFRS API service listening on %s", 3000);
	});
