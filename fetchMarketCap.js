var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');

var es = new esLib.Client({

  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',


  //log: 'trace'
});


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

function convertMarketCapSource(market){
  function pickCurrencies(item){
    return _.pick(item, ['usd', 'btc']);
  }

  function _flo(val){
    var parsed= parseFloat(val);
    return isNaN(parsed) ? val : parsed
  }

  var markt = {
    cap_usd: _flo(market.marketCap.usd),
    cap_btc: _flo(market.marketCap.btc),
    price_usd: _flo(market.price.usd),
    price_btc: _flo(market.price.btc),
    volume24_btc: _flo(market.volume24.btc),
    volume24_usd: _flo(market.volume24.usd),
    system: market.name,
    tags: market.category,
    ranking_coinmarketcap: market.position,
    supply_current: _flo(market.availableSupplyNumber),
    source: "CoinMarketCap"
  };
  return markt
}

function handleResponse(response) {
  var timestamp = response['timestamp'];
  timestamp = moment.utc(moment.unix(timestamp)).format("YYYY-MM-DD[T]HH:mm:ss");
  console.log(timestamp);
  var markets = response['markets'];
  var exchangeRates = response['currencyExchangeRates'];

  var bulk = [];
  bulk.push(
    {
      index: {
        _index: 'market-cap-data',
        _type: 'exchange-rates'
      }
    });
  exchangeRates.timestamp = timestamp;
  bulk.push(exchangeRates);

  _.each(markets, function (market) {
    bulk.push({
      index: {
        _index: 'market-cap-data',
        _type: 'market'
      }
    });

    var markt = convertMarketCapSource(market);
    markt.timestamp = timestamp;
    bulk.push(markt);
  });
  console.log("pushing " + bulk.length / 2 + " records to elasticsearch");
  es.bulk({body: bulk});
}

function recreate() {
  es.indices.create({index: 'market-cap-data'});
}
function putmap() {
  return;/*
  es.indices.putMapping({
    index: "market-cap-data",
    type: "market",
    ignoreConflicts: true,
    body: {
      "market": {
        properties: {
          "timestamp": {"type": "date", "format": "date_time_no_millis"}
        }//,
       // "_timestamp": {
         // "enabled": true,
        //  "path": "timestamp"
       // }
      }
    }
  });*/
}

var param = process.argv[2];

if (param == 'recreate') {
  recreate()
}

if (param == 'map') {
  putmap()
}

if (!param) {
  fetch();
  setInterval(fetch, fetchInterval);
}
