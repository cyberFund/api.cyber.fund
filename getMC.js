var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');

var fs = require("fs");

var es = new esLib.Client({

  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
  //  log: 'trace'
});

var timestamp = moment().utc().subtract(1, 'days').valueOf();
console.log(timestamp);
es.search({
  index: 'market-cap-data',
  type: 'market',
  "size": 1,
  "body": {
    "query": {
      "bool": {
        "must": [
          {
            "range": {
              "timestamp": {
                "from": "now-1d/h"
              }
            }
          },
          {
            "prefix": {"system": "bit"}
          }
        ]
      }
    },
    "aggs": {
      "by_system": {
        "terms": {
          "field": "system"
        },
        "aggs": {
          "latest_supply": {
            "top_hits": {
              "size": 1,
              "sort": [{"timestamp": {"order": "desc"}}],
              "_source": {
                "include": [
                  "supply_current"
                ]
              }
            }
          },
          "hourly": {
            "date_histogram": {
              "field": "timestamp",
              "interval": "hour"
            },
            "aggs": {
              "avg_cap_btc": {
                "avg": {
                  "field": "cap_btc"
                }
              },
              "avg_cap_usd": {
                "avg": {
                  "field": "cap_usd"
                }
              }
            }
          }
        }
      }
    }
  }
}).
  then(function (result) {
    console.log(result);
    console.log("total hits: " + result.hits.total);
    console.log(result.hits.hits[0]);
    console.log(result.aggregations.by_system.buckets[0].hourly.buckets[0]);
    fs.writeFileSync("sample.json", JSON.stringify(result, null, 4));
  })