var crossfilter=require("crossfilter");
var EventEmitter=require("events").EventEmitter;
var inherits = require("util").inherits;
var Moment=require("moment");
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
	this.config.regex=this.config.regex||/\[?(\d\d\d\d-\d\d\-\d\d \d\d:\d\d:\d\d)?\]?.*(SIP\/[a-z0-9\-]{15,})/i;

	EventEmitter.call(this);

}

/**
 * print_stats
 *
 * Print some useful statistics about the calls
 */
Asterisklog.prototype.print_stats=function(){

	console.log(this.calls.length+" calls analyzed");
	console.log(this.calls.reduce((a,v)=>{ return a+(v.answered===null)?1:0},0)+" still unanswered");
	console.log(this.calls.reduce((a,v)=>{ return a+(v.end===null)?1:0},0)+" still unended");


	// Calculate ringing time per extension.  Perhaps there is some way to do this more nicely with crossfilter???  The problem is that we are extracting multiple data points per call.  One call that rings 3 extensions before someone answers will generate 3 data points.
	var rings={};
	for(let c of this.calls){

		if(c.answered){

			for(let ext of Object.keys(c.rang)) {

				if(!rings[ext]) rings[ext]=[];

				rings[ext].push((c.answered-c.rang[ext])/1000);
			}
		}
	}

	for (let r of Object.keys(rings)){

		console.log("extension "+r+": "+rings[r].length+" ringing calls, average ringing time "+(rings[r].reduce((a,v)=>a+v, 0)/rings[r].length).toFixed(1) +"s");  
	}

	// Analyze with crossfilter
	var cf=crossfilter(this.calls);
	var extension_dim=cf.dimension((d)=>{

		return 	(d.answered_by===null)?"null":d.answered_by;	// Crossfilter doesn't like us mixing nulls and strings
	});
	var extension_group=extension_dim.group();
	console.log("Here is where all the calls went:");
	console.log(JSON.stringify(extension_group.all()));

	// Find calls that were enqueued and answered, or enqueued and rang.  Hangups that never rang are ignored.
	var queuers=this.calls.map((c)=>{

		if(c.enqueued){

			if(c.answered) {

				return (c.answered-c.enqueued)/1000;	// Call was enqueued and then answered
			} else {

				if(c.end && Object.keys(c.rang).length) {

					return (c.end-c.enqueued)/1000;		// Call was not answered, but rang at least once before it ended
				}				
			}
		}

		return null;	// Default is to exclude the call
	}).filter((c)=>(c!==null));
	console.log("Average queue time: "+queuers.reduce((a,v)=>a+v,0)/queuers.length);
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

		var call;
		var id=matches[2];

		// Get a date string.  We use Date or Moment depending on what we have to do since Moment is lots slower.  
		if(this.config.force_utc_offset){

			let m=(matches[1])?(new Moment(matches[1])):new Moment();		// Moment is slower than Date() but allows us to force timezones
			var now=m.utcOffset(this.config.force_utc_offset,true).toISOString();

		} else {

			var now=((matches[1])?(new Date(matches[1])):new Date()).toISOString();		
		}

	

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
				"caller_id"			:	"",
				"rang"				:	{}
			};
			self.ids[id]=call;
			self.calls.push(call);
			self.emit("start", call);
			return;
		}
			// -- SIP/210-00000d18 answered SIP/fpbx-1-f04d84a7-00000d15
			// -- Local/212@from-internal-2f36;1 answered SIP/fpbx-1-f04d84a7-00000d1a
			// -- Local/FMGL-15413313355#@from-internal-b6d8;1 answered SIP/fpbx-1-f04d84a7-00000450
		if(matches=line.match(/(Local\/[\-\w]+|SIP\/\d+).*answered SIP/)) {   

			// Answered
			if(call.answered_by!=null) return;	// 1st time only

			//call.answered_by=(matches[1]=="SIP"?"SIP\/":"")+matches[2];		// "Local" answered_by set to extension number. SIP answers set to "SIP/"+extension.
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

		} else if (matches=line.match(/(Local\/[\-\w]+|SIP\/\d+).*connected line has changed\. Saving it until answer/)) { // app_queue.c:     -- Local/212@from-internal-a08b;1 connected line has changed. Saving it until answer for SIP/fpbx-1-f04d84a7-00000eec

			// Ringing an extension
			var extension=matches[1];
			if(call.rang[extension]!=null) return;	// 1st time only

			call.rang[extension]=now;
			self.emit("ringing", call);

		} else if (matches=line.match(/VoiceMail.+, "(\w+)/)) { //VoiceMail("SIP/fpbx-1-f04d84a7-000001b8", "300@default,u""") in new stack

			// voicemail
			if(call.answered_by!=null) return;	// 1st time only

			call.answered_by="Voicemail\/"+matches[1];
			call.answered=now;
			self.emit("answered", call);


		} else if (matches=line.match(new RegExp("Goto\\(\""+id+"\", \"ext-queues,'?"+self.config.queues+"'?,1\"\\)"))) {

			// Enqueued
			if(call.enqueued!=null) return;	// 1st time only

			call.enqueued=now;
			self.emit("enqueued", call);

		}



	}

};











