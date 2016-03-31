var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');
//var CG = require("./lib/chaingear-fetcher");
var utils = require("./lib/utils");
var logger = require("log4js").getLogger("marketCap fetcher");

var es = new esLib.Client({
  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
  //log: 'trace'
});


var bulk = {body: []};
_.each (["AU6Yy5eyVRXLQ4acPu64",
  'AU6Y0C79VRXLQ4acPvCi',
  'AU6Y4n2tVRXLQ4acPvhK',
  'AU6Y66WmVRXLQ4acPvwe',
  'AU6Y_fcLVRXLQ4acPwPq',
  'AU6ZBx6OVRXLQ4acPwfQ',
  'AU6ZIpidVRXLQ4acPxOC',
  'AU6ZK8JTVRXLQ4acPxdo',
  'AU6ZNOmMVRXLQ4acPxtO',
  'AU8YGGEJoI0Q7apJwto7',
  'AU6ZdQIHVRXLQ4acPzaY',
  'AU6ZeZbqVRXLQ4acPziL',
  'AU6ZwtnlVRXLQ4acP1e7',
  'AU6Z0JX9VRXLQ4acP12U',
  'AU6Z2b7fVRXLQ4acP2F6',
  'AU6Z7BBLVRXLQ4acP2lG',
  'AU6Z8KM4VRXLQ4acP2s5',
  'AU6aDB4TVRXLQ4acP3br',
  'AU6aHm15VRXLQ4acP363',
  'AU6aIwKbVRXLQ4acP4Cq',
  'AU6aJ5X6VRXLQ4acP4Kd',
  'AU6aQxAZVRXLQ4acP45P',
  'AU6agytXVRXLQ4acP6mZ',
  'AU6ah8B6VRXLQ4acP6uM',
  'AU6ajFQHVRXLQ4acP61_'], function(item){
  console.log(item);
 // bulk.body.push({ delete: { _index: 'marktcap-v3', _type: 'market', _id: item } })
});
/*
es.bulk(bulk, function(err, res){
  console.log(err);
  console.log(res)
});*/

/*
 curl -XPOST 'http://esserver:9200/_aliases' -d '
 {
 "actions" : [
 { "remove" : { "index" : "marktcap-v2", "alias" : "marketcap-read" } },
 { "add" : { "index" : "marktcap-v3", "alias" : "marketcap-read" } }
 ]
 }'
 */
