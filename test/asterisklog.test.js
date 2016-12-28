var assert=require("assert");
var asterisklog=require("../lib/asterisklog.js");
var linebyline=require("line-by-line");


describe("Ingest sample call data",()=>{

	it("Direct log",(done)=>{

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

	it("Remote syslog (no timestamps)",(done)=>{

		var a=new asterisklog({queues: "299", "require_timestamps" : false });
		(new linebyline("./test/syslog.log"))
			.on("line", (line)=>a.add(line))
			.on("error", (err)=>{throw err})
			.on("end",()=>{

				var calls=a.get_calls();
				assert.equal(calls.length,1);	
				assert.equal(calls[0].id, "SIP/fpbx-1-f04d84a7-002a75b6");	// Remote syslog does not have timestamps, so replaying the log results in incorrect times
				assert.equal(calls[0].caller_id, "15415559999");				
				assert.equal(calls[0].answered_by, "213");				
				done();
			});
	});


	it("Throw if required timestamp is missing",(done)=>{

			var a=new asterisklog({queues: "299" });

			assert.throws(()=>{
					a.add("VERBOSE[12684]: pbx.c:4256 in pbx_extension_helper:     -- Executing [s@ext-did:1] ExecIf(\"SIP/fpbx-1-f04d84a7-002a75b6\", \"1?Set(__FROM_DID=s)\") in new stack ");
			}, Error);
			done();
	});

});
