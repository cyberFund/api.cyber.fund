var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');
var CG = require("./lib/chaingear-fetcher");
var utils = require("./lib/utils");
var logger = require("log4js").getLogger("marketCap fetcher");
var memwatch = require('memwatch');




var hd;
memwatch.on('leak', function(info) {
  console.log(memleak);
  console.error(info);
  if (!hd) {
    hd = new memwatch.HeapDiff();
  } else {
    var diff = hd.end();
    console.error(util.inspect(diff, true, null));
    hd = null;
  }
});

memwatch.on('leak', function(info) {
  console.error(info);
  var file = '/home/angelo/myapp-' + process.pid + '-' + Date.now() + '.heapsnapshot';
  heapdump.writeSnapshot(file, function(err){
    if (err) console.error(err);
    else console.error('Wrote snapshot: ' + file);
  });
});



var es = new esLib.Client({
  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
  //log: 'trace'
});

var sourceUrlMC = "http://coinmarketcap.northpole.ro/api/v5/all.json";
var fetchIntervalMC = 5 * 60 * 1000;

var index_old = "market-cap-data";
var index_v = "marktcap-v3";
var alias_read = "marketcap-read";
var alias_write = "marketcap-write";

function fetchMC() {
  var options = {
    method: 'GET',
    uri: sourceUrlMC,
    transform: utils.parseResponse
  };
  rp(options).then(handleMCResponse, handleError);
}

function handleError(error) {
  console.log(error);
}

function transformMarketCapData(market, cg_item) {
  function pickCurrencies(item) {
    return _.pick(item, ['usd', 'btc']);
  }

  if (!cg_item.token || !cg_item.token.token_symbol) {
    logger.warn("no proper symbol for " + cg_item.system);
    logger.warn("CG.symbol is " + cg_item.symbol);
    return null;
  }

  var symbol = cg_item.token.token_symbol;
  var rating_cyber = cg_item.ratings ? (cg_item.ratings.rating_cyber || 0) : 0;

  var markt = {
    cap_usd: utils.tryParseFloat(market.marketCap.usd),
    cap_btc: utils.tryParseFloat(market.marketCap.btc),
    price_usd: utils.tryParseFloat(market.price.usd),
    price_btc: utils.tryParseFloat(market.price.btc),
    volume24_btc: utils.tryParseFloat(market.volume24.btc),
    volume24_usd: utils.tryParseFloat(market.volume24.usd),
    tags: market.category,
    ranking_coinmarketcap: market.position,

    supply_current: utils.tryParseFloat(market.availableSupplyNumber),
    source: "CoinMarketCap",
    system: cg_item.system,
    symbol: symbol,
    sym_sys: symbol + "|" + cg_item.system,
    genesis_id: cg_item.genesis_id,
    dependencies: cg_item.dependencies,
    rating_cyber: rating_cyber
  };
  if (cg_item.descriptions) {
    _.extend(markt, {
      descriptions: {
        system_type: cg_item.descriptions.system_type,
        state: cg_item.descriptions.state,
        tags: cg_item.descriptions.tags
      }
    })
  }

  if (cg_item.consensus) {
    _.extend(markt, {
      consensus: {
        consensus_type: cg_item.consensus.consensus_type,
        consensus_name: cg_item.consensus.consensus_name,
        hashing: cg_item.consensus.hashing
      }
    })
  }

  if (cg_item.specs) {
    if (cg_item.specs.block_time) {
      markt.specs = markt.specs || {};
      markt.specs.block_time = utils.tryParseInt(cg_item.specs.block_time)
    }
    if (cg_item.specs.txs_confirm) {
      markt.specs = markt.specs || {};
      markt.specs.txs_confirm = utils.tryParseInt(cg_item.specs.txs_confirm)
    }
  }

 /* if (cg_item.events) {
    markt.events = cg_item.events;
  } */

  return markt;
}

function handleMCResponse(response) {
  if (!CG.chaingear) return;
  /**
   *
   * @param item = marketcap item
   *  function is interested in fields 'system', 'symbol'
   * returns matching chaingear item or false
   */
  function matchItemToCG(item) {
    return  _.find(CG.chaingear, function (cg_item) {
      if (!cg_item.aliases) return false;
      if (!cg_item.token) return false;
      return (cg_item.aliases.coinmarketcap == item.name)
        &&
        (item.symbol == cg_item.token.token_symbol)
    });
  }

  if (!response['timestamp']) {
    logger.warn("no response.timestamp");
  }
  var timestamp = response['timestamp'];
  timestamp = moment.utc(moment.unix(timestamp)).format("YYYY-MM-DD[T]HH:mm:ss");
  logger.info("new data fetched from coinmarketcap; timestamped  " + timestamp);
  var markets = response['markets'];
  var exchangeRates = response['currencyExchangeRates'];
  if (exchangeRates) {
    _.each(exchangeRates, function (v, k) {
      exchangeRates[k] = utils.tryParseFloat(v);
    });

    var bulk = [];
    bulk.push(
      {
        index: {
          _index: alias_write,
          _type: 'exchange-rates'
        }
      });
    exchangeRates.timestamp = timestamp;
    bulk.push(exchangeRates);

  }

  _.each(markets, function (market) {
    var cg_item = matchItemToCG(market);

    if (cg_item) {
      bulk.push({
        index: {
          _index: alias_write,
          _type: 'market'
        }
      });
      var markt = transformMarketCapData(market, cg_item);
      markt.timestamp = timestamp;
      bulk.push(markt);
    }
  });
  logger.info("pushing " + bulk.length / 2 + " records to elasticsearch");
  /*logger.debug("last item: ");
   logger.info(bulk.pop());*/
  var fs = require('fs');
  //fs.writeFile('bulk.json', JSON.stringify(bulk, null, 2), function(err, ret){
  //  console.warn("get out");
  //});
  es.bulk({body: bulk});
}

// recreate index
function recreate() {
  es.indices.create({index: index_v});
}

// put index map
function putmap() {
  var mapping = {
    index: index_v,
    type: "market",
    ignoreConflicts: true,
    body: {
      "market": {
        properties: {
          "system": utils.esMappingObjects.notAnalyzedString,
          "symbol": utils.esMappingObjects.notAnalyzedString,
          "sym_sys": utils.esMappingObjects.notAnalyzedString,
          "genesis_id": utils.esMappingObjects.notAnalyzedString,
          "dependencies": utils.esMappingObjects.notAnalyzedString,
          "descriptions": {
            "type": "object",
            "properties": {
              "system_type": utils.esMappingObjects.notAnalyzedString,
              "state": utils.esMappingObjects.notAnalyzedString,
              "tags": utils.esMappingObjects.notAnalyzedString
            }
          },
          "consensus": {
            "type": "object",
            "properties": {
              "consensus_type": utils.esMappingObjects.notAnalyzedString,
              "consensus_name": utils.esMappingObjects.notAnalyzedString,
              "hashing": utils.esMappingObjects.notAnalyzedString
            }
          },
          "specs": {
            "type": "object",
            "properties": {
              "block_time": {"type": "integer"},
              "txs_confirm": {"type": "integer"}
            }
          },
          "events": {
            "type": "object",
            "properties": {
              "announcement": utils.esMappingObjects.chainGearDate,
              "genesis": utils.esMappingObjects.chainGearDate
            }
          }
        }
      }
    }
  };

  return es.indices.putMapping(mapping);
}

var param = process.argv[2];

if (param == 'recreate') {
  recreate()
}

if (param == 'map') {
  putmap()
}

if (!param) {
  CG.start();

  var moo = setInterval(function () {
    if (CG.chaingear) {
      clearInterval(moo);
      fetchMC();
      setInterval(function () {
        fetchMC();
      }, fetchIntervalMC);
    }
    console.log("waiting for chaingear");
  }, 1000);
}
/*
 curl -XPOST 'http://esserver:9200/_aliases' -d '
 {
 "actions" : [
 { "remove" : { "index" : "marktcap-v2", "alias" : "marketcap-read" } },
 { "add" : { "index" : "marktcap-v3", "alias" : "marketcap-read" } }
 ]
 }'
 */
