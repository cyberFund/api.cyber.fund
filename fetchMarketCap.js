var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');

var es = new esLib.Client({

  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',


  //log: 'trace'
});

//es.indices.create({index: 'market-cap'});

var sourceUrl = "http://coinmarketcap.northpole.ro/api/v5/all.json";
var fetchInterval = ("RARE_FETCH" in process.env ? 50 : 5) * 60 * 1000;

function fetch() {
  var options = {
    method: 'GET',
    uri: sourceUrl,
    transform: parseResponse
  };

  rp(options).then(handleResponse, handleError);
}


function parseResponse(data) {
  var parsedData = {};
  try {
    parsedData = JSON.parse(data);
  } catch (e) {

  }
  return parsedData;
}

function handleError(error) {
  console.log(error);
}

function handleResponse(response) {
  var timestamp = response['timestamp'];
  var markets = response['markets'];
  var exchangeRates = response['currencyExchangeRates'];

  var bulk = [];
  /*es.index({
   index: 'market-cap',
   type: 'exchange-rates',
   timestamp: timestamp,
   body: exchangeRates
   });*/
  bulk.push(
    {
      index: {
        _index: 'market-cap',
        _type: 'exchange-rates',
        timestamp: timestamp
      }
    });
  bulk.push(exchangeRates);

  _.each(markets, function (market) {
    bulk.push({
      index: {
        _index: 'market-cap',
        _type: 'market',
        timestamp: timestamp
      }
    });
    bulk.push(market);
  });

  console.log("pushing " + bulk.length / 2 + " records to elasticsearch");

  es.bulk({body: bulk});
}

fetch();
setInterval(fetch, fetchInterval);