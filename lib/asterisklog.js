var crossfilter=require("crossfilter");
var EventEmitter=require("events").EventEmitter;
var inherits = require("util").inherits;
//var moment=require("moment");
inherits(Asterisklog, EventEmitter);
module.exports=Asterisklog;

function Asterisklog (conf) {

	if(! (this instanceof Asterisklog) )return new Asterisklog;

	// Call stores
	this.ids={};	// By ID
	this.calls=[];	// In order

	// Config, and defaults
	this.config=conf;
	this.config.queues=this.config.queues||"";
	this.config.require_timestamps=(typeof(this.config.require_timestamps)=="boolean")?this.config.require_timestamps:true;
	this.config.regex=this.config.regex||/\[?(\d\d\d\d-\d\d\-\d\d \d\d:\d\d:\d\d)?\]?.*(SIP\/fpbx\-[a-z0-9\-]+)/i;

	EventEmitter.call(this);

}

/**
 * print_stats
 *
 * Print some useful statistics about the calls
 */
Asterisklog.prototype.print_stats=function(){

	console.log(this.calls.length+" calls analyzed");
	console.log(this.calls.reduce((a,v)=>{ return a+(v.answered)?1:0},0)+" still unanswered");
	console.log(this.calls.reduce((a,v)=>{ return a+(v.answered)?1:0},0)+" still unended");

	// Analyze with crossfilter
	var cf=crossfilter(this.calls);
	var extension_dim=cf.dimension((d)=>d.answered_by);
	var extension_group=extension_dim.group();
	console.log("Here is where all the calls went:");
	console.log(JSON.stringify(extension_group.all()));

	// Dimension hold time, and get only calls that did hold
	var queue_time_dim=cf.dimension((d)=>(d.enqueued && d.answered)?(d.answered-d.enqueued)/1000:0);
	queue_time_dim.filter((v)=>(v!=0));
	var queuers=queue_time_dim.top(Infinity);
	console.log("Average hold time: "+queuers.reduce((p,v)=>{return p+((v.answered-v.enqueued)/1000);},0)/queuers.length);
};

/**
 * get_calls
 *
 * Retrieve all calls that have been parsed so far
 * @return array of calls, sorted by start time
 */
 Asterisklog.prototype.get_calls=function(){

 	return this.calls
 		.slice()
 		.sort((a,b)=>{

 			return (a.start>b.start)?1:((a.start<b.start)?-1:0);
 		});
 };

 /**
 * set_calls
 *
 * Set calls that have been parsed so far
 * @param calls array of calls
 */
 Asterisklog.prototype.set_calls=function(calls){

 	// Save a copy
 	this.calls=calls.slice();

 	// Set ids hash, convert time strings to Date objects
 	for(var call of this.calls){

 		this.ids[call.id]=call;

 		for(var item of ["start", "end", "enqueued", "answered"]){

 			if(typeof call[item] =="string") {

 				call[item] = new Date(call[item]);
 			} 
 		}
 	}
 };

/**
 * add
 *
 * @param line a line from the asterisk log file
 * @throws exception if timestamp is missing and it should not be
 * Add a new line to the log
 */
Asterisklog.prototype.add=function(line){
	var self=this;

	// We only care about lines with a SIP ID.  We have a date in brackets for native asterisk logs, though not when received via syslog
	if(matches=line.match(this.config.regex)) {
//	if(matches=line.match(/(SIP\/fpbx\-[a-z0-9\-]+)/i)) {

		if(this.config.require_timestamps && (!matches[1])){

			throw new Error("Log entry missing a timestamp");
		}

		var id=matches[2];
		var now=(matches[1])?(new Date(matches[1])):new Date();
		var call;

		// If this is new, create a new entry
		if(!(call=self.ids[id])){

			// .. Unless it is a casual mention (I think this will kill outbound dialing)
			if(!line.match(/in new stack/))
				return;

			call={
				"id"				:	id,
				"start"				:	now,
				"end"				:	null,
				"enqueued"			:	null,
				"answered"			:	null,
				"answered_by"		:	null,
				"caller_id"			:	""
			};
			self.ids[id]=call;
			self.calls.push(call);
			self.emit("start", call);
			return;
		}

		if(matches=line.match(/Local\/([^\@]+)\@.*answered SIP/)) {

			// Answered
			if(call.answered_by!=null) return;	// 1st time only

			call.answered_by=matches[1];
			call.answered=now;
			self.emit("answered", call);

		} else if (matches=line.match(/hangup/i)) {		// hangupcall seems to mean that they hung up. If we hang up, it looks like 'Executing [h@ivr-3:1] Hangup("SIP/fpbx-1-f04d84a7-0028664a", "") in new stack'

			// Hangup
			if(call.end!=null) return;	// 1st time only

			call.end=now;
			self.emit("end", call);

		} else if (matches=line.match(/CALLERID\(name\)\=(\d+)/)) {

			// Caller ID
			call.caller_id=matches[1];

		} else if (matches=line.match(new RegExp("Goto\\(\""+id+"\", \"ext-queues,'?"+self.config.queues+"'?,1\"\\)"))) {

			// Enqueued
			if(call.enqueued!=null) return;	// 1st time only

			call.enqueued=now;
			self.emit("enqueued", call);

		}



	}

};











