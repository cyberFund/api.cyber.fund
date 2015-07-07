var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');

var es = new esLib.Client({

  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
//  log: 'trace'
});

var timestamp = moment().utc().subtract(10, 'minutes').valueOf();
console.log(timestamp);
es.search({
  index: 'market-cap-data',
  type: 'market',
  size: 5,
  body: {
    query: {
      prefix:  {
        system: "b"
      }
    }
  },

  range: {
    timestamp: {
      gte: timestamp
    }
  },
  sort: ["system"]

}).then(function (result) {
  console.log(result);
  console.log("total hits: " + result.hits.total);
  console.log(result.hits.hits);
});