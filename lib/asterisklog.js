var EventEmitter=require("events").EventEmitter;
var inherits = require("util").inherits;
var moment=require("moment");
var queues="500|510|520|601|602";
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

	EventEmitter.call(this);

}
/**
 * get_calls
 *
 * Retrieve all calls that have been parsed so far
 * @return array of calls
 */
 Asterisklog.prototype.get_calls=function(){

 	return this.calls;
 }

/**
 * add
 *
 * @param line a line from the asterisk log file
 * Add a new line to the log
 */
Asterisklog.prototype.add=function(line){

	var self=this;

	// We only care about lines with a stamp and a SIP ID
	if(matches=line.match(/\[(\d\d\d\d-\d\d\-\d\d \d\d:\d\d:\d\d)\].*(SIP\/fpbx\-[a-z0-9\-]+)/i)) {

		var id=matches[2];
		var now=moment(matches[1]);
		var call;

		// If this is new, create a new entry
		if(!(call=self.ids[id])){

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

		} else if (matches=line.match(new RegExp("Goto\\(\""+id+"\", \"ext-queues,'"+self.config.queues+"',1\"\\)"))) {

			// Enqueued
			if(call.enqueued!=null) return;	// 1st time only

			call.enqueued=now;
			self.emit("enqueued", call);

		}



	}

};











