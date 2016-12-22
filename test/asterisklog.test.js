var assert=require("assert");
var asterisklog=require("../lib/asterisklog.js");
var linebyline=require("line-by-line");


describe("Normal call",()=>{

	it("Start",(done)=>{

		var a=new asterisklog({queues: "299" });
		(new linebyline("./test/normal.log"))
			.on("line", (line)=>a.add(line))
			.on("error", (err)=>{throw err})
			.on("end",()=>{

				var calls=a.get_calls();
				assert.equal(calls.length,1);
				assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),		// Conversion to/from JSON is to convert Date() objects to strings
					  {
					    "id": "SIP/fpbx-1-f04d84a7-0029dad8",
					    "start": "2016-12-01T15:10:46.000Z",
					    "end": "2016-12-01T15:18:01.000Z",
					    "enqueued": "2016-12-01T15:11:02.000Z",
					    "answered": "2016-12-01T15:11:04.000Z",
					    "answered_by": "210",
					    "caller_id": "15555553333"
					  });
				done();
			});
	});

});