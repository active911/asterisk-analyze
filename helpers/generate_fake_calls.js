var redis = new (require("ioredis"))(); 


// Set up a chain of events
var events=["start", "enqueued", "ring", "answered", "end"];
var events_index=-1;
var extensions=["Local/213", "unanswered", "Local/212", "Local/210"];
var call;		// We just do one at a time for now!

// Kick things off
iterate();


function iterate(){

	let ev=events[events_index=(events_index+1)%events.length];
	switch(ev) {

		case "start":

			call={
				"id"				:	"SIP/"+Math.random().toString(36).replace(/[^a-z]/g,"").substr(-10),
				"start"				:	new Date(),
				"end"				:	null,
				"enqueued"			:	null,
				"answered"			:	null,
				"answered_by"		:	null,
				"caller_id"			:	"",
				"rang"				:	{}
			};
			break;

		case "ring":

				// Ring all extensions
				extensions.forEach((e)=>call.rang[e]=new Date());
			break;

		case "answered":
			// call.answered_by=extensions[2];
			call.answered_by=extensions[Math.round(Math.random()*extensions.length)];

		default:
			call[ev]=new Date();
			break; 
	}

	redis.publish("calls", JSON.stringify(call));
	console.log(call.id+":"+ev);

	// Call ourself again in a random number of seconds
	let t=setTimeout(iterate, Math.round(Math.random()*500));

}





















