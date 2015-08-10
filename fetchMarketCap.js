var _ = require('underscore');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');
var CG = require("./lib/chaingear-fetcher");
var utils = require("./lib/utils");
var logger = require("log4js").getLogger("marketCap fetcher");

var es = new esLib.Client({
  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
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

// using this to import data from coinmarketcap data fetch.
function transformMarketCapData(market, cg_item) {
  function pickCurrencies(item) {
    return _.pick(item, ['usd', 'btc']);
  }

  if (!cg_item.token || !cg_item.token.token_symbol) {
    logger.warn("no proper symbol for " + cg_item.system);
    logger.warn("CG.symbol is " + cg_item.symbol);
    return null;
  }

  var markt = {
    cap_usd: utils.tryParseFloat(market.marketCap.usd),
    cap_btc: utils.tryParseFloat(market.marketCap.btc),
    price_usd: utils.tryParseFloat(market.price.usd),
    price_btc: utils.tryParseFloat(market.price.btc),
    volume24_btc: utils.tryParseFloat(market.volume24.btc),
    volume24_usd: utils.tryParseFloat(market.volume24.usd),
    tags: market.category,
    ranking_coinmarketcap: market.position,
    supply_current: utils.tryParseFloat(market.availableSupplyNumber)
  };

  markt = extendMarktByCG(markt, cg_item);
  return markt;
}

// using this to re-import elasticsearch data from previous versions
function transformMarktCapData_v2(market, cg_item){
  if (!cg_item.token || !cg_item.token.token_symbol) {
    logger.warn("no proper symbol for " + cg_item.system);
    logger.warn("CG.symbol is " + cg_item.symbol);
    return null;
  }

  var markt = {
    cap_usd: utils.tryParseFloat(market.cap_usd),
    cap_btc: utils.tryParseFloat(market.cap_btc),
    price_usd: utils.tryParseFloat(market.price_usd),
    price_btc: utils.tryParseFloat(market.price_btc),
    volume24_btc: utils.tryParseFloat(market.volume24_btc),
    volume24_usd: utils.tryParseFloat(market.volume24_usd),
    tags: market.tags,
    timestamp: market.timestamp,
    ranking_coinmarketcap: market.ranking_coinmarketcap,
    supply_current: utils.tryParseFloat(market.supply_current)
  };

  markt = extendMarktByCG(markt, cg_item);
  return markt;
}

function transformMarktCapData_log(market, cg_item){
  if (!cg_item.token || !cg_item.token.token_symbol) {
    logger.warn("no proper symbol for " + cg_item.system);
    logger.warn("CG.symbol is " + cg_item.symbol);
    return null;
  }
  var markt = {
    cap_usd: utils.tryParseFloat(market.metrics.cap_usd),
    cap_btc: utils.tryParseFloat(market.metrics.cap_btc),
    price_usd: utils.tryParseFloat(market.metrics.price_usd),
    price_btc: utils.tryParseFloat(market.metrics.price_btc),
    volume24_btc: utils.tryParseFloat(market.metrics.volume24_btc),
    volume24_usd: utils.tryParseFloat(market.metrics.volume24_usd),
    //tags: market.tags,
    timestamp: market.timestamp,
    //ranking_coinmarketcap: market.ranking_coinmarketcap,
    supply_current: utils.tryParseFloat(market.metrics.supply)
  };

  markt = extendMarktByCG(markt, cg_item);
  return markt;
}

// rest of data from cg being added to records here.
function extendMarktByCG(markt, cg_item){
  var symbol = cg_item.token.token_symbol;
  var rating_cyber = cg_item.ratings ? (cg_item.ratings.rating_cyber || 0) : 0;

  _.extend(markt, {
    source: "CoinMarketCap",
    system: cg_item.system,
    symbol: symbol,
    sym_sys: symbol + "|" + cg_item.system,
    genesis_id: cg_item.genesis_id,
    dependencies: cg_item.dependencies,
    rating_cyber: rating_cyber
  });
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

  if (cg_item.events) {
    markt.events = cg_item.events;
  }

  return markt;
}

// using this to push (transformed) marketcap response to es
function handleMCResponse(response) {
  if (!CG.chaingear) return;

  var matchItemToCG = GC.matchCMCToCG;

  if (!response['timestamp']) {
    logger.warn("no response.timestamp");
  }
  var timestamp = response['timestamp'];
  timestamp = moment.utc(moment.unix(timestamp)).format("YYYY-MM-DD[T]HH:mm:ss");
  logger.info("new data fetched from coinmarketcap; timestamped  " + timestamp);
  var markets = response['markets'];
  var exchangeRates = response['currencyExchangeRates'];
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
  es.bulk({body: bulk});
}

// recreating index
function recreate() {
  es.indices.create({index: index_v});
}

// appluing mapping to index
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

  var current = 0;
  var size = 1000;

  function nextBatch(cbOk, cbErr) {
    // first we do a search, and specify a scroll timeout
    es.search({
      index: 'marktcap-v2',
      type: 'market',
      // Set to 30 seconds because we are calling right back
      from: current,
      size: size
    }).then(function (result) {
      if (result && result.hits && _.isArray(result.hits.hits)) {
        cbOk(result);
      }
    }, function (reason) {
      cbErr(reason);
    })
  }

  // importv2 branch.
  function allBatches(cbOk, cbErr) {
    function CALLBACK_OK(result) {
      current += result.hits.hits.length;
      var time = process.uptime();
      var time_total_est = time * result.hits.total / current;
      var time_left_est = time_total_est - time;
      logger.info(current + " / " + result.hits.total + " ( " + time + " / " +
        time_total_est.toFixed(2) + " seconds) " + time_left_est.toFixed(2) + " estimated time left");
      cbOk(result);
      if (current < result.hits.total) nextBatch(CALLBACK_OK, cbErr);
    }

    nextBatch(function (result) {
      CALLBACK_OK(result);
    }, function (err) {cbErr(err)});
  }

  var moo = setInterval(function () {
    if (CG.chaingear) {
      clearInterval(moo);
      var matchItemToCG = function(item) {
        var cg = CG;
        if (!cg.chaingear) return;

        var ret = _.find(cg.chaingear, function (cg_item) {
          if (!cg_item.aliases) return false;
          if (!cg_item.token) return false;
          // match marketcap name with CG marketcap alias
          return (cg_item.aliases.coinmarketcap == item.system)
              // match marketcap symbol with:
              //               # commented out 1. CG marketcap symbol alias;
              // 2. CG symbol
            //&& //((item.symbol == cg_item.aliases.coinmarketcap.symbol) ||
            //(item.symbol == cg_item.token.token_symbol);
        });
        return ret;
      };

      var fs = require("fs");
      var path = require("path");
      var walk = function (dir) {
        var results = [];

        var list = fs.readdirSync(dir);

        list.forEach(function (_file) {
          var file = path.join(dir, _file);
          var stat = fs.statSync(file);
          if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
          } else {
            if (file.split(".").pop() != "json") {
              console.log("found non-toml file^" + dir + "/" + file);
              return;
            }
            results.push(file)
          }
        });
        return results
      };
      var matched = [];
      var unmatched = [];
      var empty = [];
      var bad_result = [];
      var files = walk("./cmc-history/");

      var i = -1;
      var next = true;
      var stop = false;

      function iterate() {
        i++;
        next = false;
        var file = files[i];
        var data = require("./" + file);
        if (!data.length) {
          empty.push(file);
        //  console.log("empty file encountered");
          next = true;

        } else {
          var matched_system = matchItemToCG(data[0]);
          if (!matched_system) {
            console.log("no matching system encountered");
            next = true;
            unmatched.push(data[0].symbol + "|" + data[0].name);

          } else {
            if (data[0].name.match(/^Bytecoin$/) || data[0].name.match(/^InstaMineNugget/)) {
              next = true;
              console.log("bad system name encountered");
              return;
            }
            var bulk = [];

            _.each(data, function(item){
              // normalizing data
              item.timestamp = moment.utc(moment.unix(item.timestamp)).format("YYYY-MM-DD[T]HH:mm:ss");
              if (item.metrics) {
                item.metrics.volume24_usd = item.metrics.volume;
              }
              if (item.metrics.price_usd && item.metrics.price_btc) {
                item.metrics.volume24_btc =
                  item.metrics.volume *  item.metrics.price_btc / item.metrics.price_usd
              }
              if (item.metrics.price_btc) {
                item.metrics.cap_btc = item.metrics.supply * item.metrics.price_btc;
              }
              delete item.metrics.volume;

              var markt = transformMarktCapData_log(item, matched_system);
              if (markt) {
                bulk.push({
                  index: {
                    _index: alias_write,
                    _type: 'market'
                  }
                });
                bulk.push(markt);
              }
            });

            logger.info("pushing " + bulk.length / 2 + " records to elasticsearch");
            logger.info("file " + i + " of " +files.length);
            try {
              es.bulk({body: bulk}, function (err, result) {
                if (err) {
                  bad_result.push(file);
                  console.log("bad result received");
                  next = true;
                }
                else {
                 console.log("response ok");
                  next = true;
                }
              });
            } catch (e) {
              bad_result.push(file);
              console.log("bad result thrown");
              next = true;
            }
          }
        }
      }

      var cycle = setInterval (function(){
        if (!next) return;
        if (next) {
          if (stop) {
            console.log("bad_result: ");
            console.log(bad_result );
            clearInterval(cycle);
          } else {
            if (i >= files.length-1) {
              stop = true;
            }
            else {
              iterate();
            }
          }
        }
      }, 40);

     /* allBatches(function cbOk(result) {
        var bulk = [];
        _.each(result.hits.hits, function(hit){
          var item = hit._source;
          if (item.system.match(/^Bytecoin$/) || item.system.match(/^InstaMineNugget/)) {
            return;
          }
          var cg_item = matchItemToCG(item);
          if (cg_item) {

            var markt = transformMarktCapData_v2(item, cg_item);
            if (markt) {
              bulk.push({
                index: {
                  _index: alias_write,
                  _type: 'market'
                }
              });
              bulk.push(markt);
            }
          }
        });
        logger.info("pushing " + bulk.length / 2 + " records to elasticsearch");
        es.bulk({body: bulk}, function(result){

        });
      }, function cbErr(err) {
        logger.warn(err);
      }); */


      //* replace count to deleteByQuery to delete.
      /*  es.count({
        index: 'marketcap-read',
        type: 'market',
        body: {
          query: {
            range: {
              timestamp: {
                lte: "now-7d"
              }
            }
          }
        }
      }).then(function(result){
        console.log(result);
      }); */


      //fetchMC();
      //setInterval(function () {
      //  fetchMC();
      //}, fetchIntervalMC);
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
