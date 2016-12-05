var express=require('express');
var app = express();
var log = require("bunyan").createLogger({"name":"asterisk-analyze"});
var promise=require("bluebird");
var nconf = require('nconf');
var crossfilter = require('crossfilter');

// Read the config
nconf.argv().env().file({ file: 'config.json' });


// Data and dimensions
var data=require("./public/calls.json");
var cf=crossfilter(data);
log.info(cf.size()+" records found");

// Dimensions
var time_in_queue_dim=cf.dimension((d) => { return d.queued_duration; } );
var answered_dim=cf.dimension((d)=> d.answered_ct>0);
var caller_id_dim=cf.dimension((d)=>d.caller_id);
// var timestamp_dim=cf.dimension((d) => new Date(d.started*1000));
//var hours_dim=cf.dimension((d) => (new Date(d.started*1000)).getHours());
var extension_dim=cf.dimension((d)=>d.answered_by);

// Groups
//var hours_group=timestamp_dim.group((d) => d.getHours());
// var hours_group=hours_dim.group()
var extension_group=extension_dim.group()
log.info(extension_group.all());
log.info("Total of group values: "+extension_group.all().reduce((a,v)=>{ return a+v.value },0));

// Question 1: During what time periods are calls being lost?
// hours_group.reduce(
// 	(p,v) => { return v.answered_ct==0?p+1:p },	// Add unanswered calls
// 	(p,v) => { return v.answered_ct==0?p-1:p },	// Remove unanswered calls
// 	(p,v) => 0									// Initial
// 	);
// log.info(hours_group.all());
// hours_dim.filter(8);
//log.info(extension_group.top(Infinity));
//caller_id_dim.filter(15412300243);
// answered_dim.filter(false);
// log.info(answered_dim.top(Infinity).length);
//log.info(caller_id_dim.top(Infinity));
// log.info(caller_id_dim.top(10).map((v)=>{ return {

// 	caller_id	:	v.caller_id,
// 	time		:	new Date(v.started*1000),
// 	queued_time	:	v.queued_duration,
// 	answered	:	v.answered_ct>0
// 	};
// }));