process.chdir(__dirname);
var _ = require('lodash');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');
var utils = require("./lib/utils");
var logger = require("log4js").getLogger("marketCap fetcher");
var __debug__ = false;

var es = new esLib.Client({
  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
  log: 'trace'
});

var sourceUrlMC = "http://coinmarketcap.northpole.ro/api/v5/all.json";

var index_v = "marktcap-v6";
var alias_read = "marketcap-read";
var alias_write = "marketcap-write";

var param = process.argv[2];

// recreate index
function recreate() {
  es.indices.create({
    index: index_v
  });
}


if (param == 'recreate') {
  recreate()
}

if (param == 'map') {
  var marktcapIndex = require("./lib/indices/"+index_v+".js")
  marktcapIndex.putMapping(es, index_v)
}

/*
 curl -XPOST 'http://esserver:9200/_aliases' -d '
 {
 "actions" : [
 { "remove" : { "index" : "marktcap-v5", "alias" : "marketcap-read" } },
 { "add" : { "index" : "marktcap-v4", "alias" : "marketcap-read" } }
 ]
 }'
 */

 /*
 curl -XPOST 'http://esserver:9200/_aliases' -d '
 {
 "actions" : [
 { "remove" : { "index" : "marktcap-v5", "alias" : "marketcap-write" } },
 { "add" : { "index" : "marktcap-v6", "alias" : "marketcap-write" } }
 ]
 }'
 */
