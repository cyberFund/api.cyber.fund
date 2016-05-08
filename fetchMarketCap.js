process.chdir(__dirname);
var _ = require('lodash');
var rp = require('request-promise');
var esLib = require('elasticsearch');
var moment = require('moment');
var CG = require("./lib/chaingear-fetcher");
var utils = require("./lib/utils");
var logger = require("log4js").getLogger("marketCap fetcher");
var __debug__ = false;
var time = process.hrtime();

var es = new esLib.Client({
  host: 'http://' + process.env.ES_USERNAME + ':' + process.env.ES_PASSWORD + '@es.index.cyber.fund',
  //log: 'trace'
});

var sourceUrlMC = "http://coinmarketcap.northpole.ro/api/v5/all.json";

var alias_read = "marketcap-read";
var alias_write = "marketcap-write";

var countTries = 0;
var maxCountTries = 3;

function fetchMC() {
  var options = {
    method: 'GET',
    uri: sourceUrlMC,
    transform: utils.parseResponse,
    timeout: 40000
  };
  countTries++;
  rp(options).then(handleMCResponse, handleError);
}


function handleError(error) {
  console.log(error);
}

function transformMarketCapData(market, cg_item) {
  function pickCurrencies(item) {
    return _.pick(item, ['usd', 'btc']);
  }

  if (!cg_item.token || !cg_item.token.symbol) {
    logger.warn("no proper symbol for " + cg_item.system);
    logger.warn("CG.symbol is " + cg_item.symbol);
    return null;
  }

  var symbol = cg_item.token.symbol;
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
    return _.find(CG.chaingear, function(cg_item) {
      if ((!cg_item.aliases) ||
       (!cg_item.token) ||
       (!cg_item.aliases.coinmarketcap)) return false;
      if (cg_item.aliases.coinmarketcap.indexOf("+") == -1)
        return (cg_item.aliases.coinmarketcap == item.name) //&& (item.symbol == cg_item.token.symbol)
      else {
        var _split = cg_item.aliases.coinmarketcap.trim().split("+");
        return (_split[0] == item.name) && (_split[1] == item.symbol)
      }
    });
  }

  if (!response['timestamp']) {
    logger.warn("no response.timestamp");
    console.log(response)
    if (countTries <= maxCountTries) {
      fetchMC();
    }
    return;
  }
  var timestamp = response['timestamp'];
  timestamp = moment.utc(moment.unix(timestamp)).format("YYYY-MM-DD[T]HH:mm:ss");
  logger.info("new data fetched from coinmarketcap; timestamped  " + timestamp);
  var markets = response['markets'];
  var exchangeRates = response['currencyExchangeRates'];
  if (exchangeRates) {
    _.each(exchangeRates, function(v, k) {
      exchangeRates[k] = utils.tryParseFloat(v);
    });

    var bulk = [];
    bulk.push({
      index: {
        _index: alias_write,
        _type: 'exchange-rates'
      }
    });
    exchangeRates.timestamp = timestamp;
    bulk.push(exchangeRates);

  }

  _.each(markets, function(market) {
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
  //var fs = require('fs');

  //fs.writeFile('bulk.json', JSON.stringify(bulk, null, 2), function(err, ret){
  //  console.warn("get out");
  //});


  if (!__debug__)
    es.bulk({
      body: bulk
    });
  else {
    console.log (JSON.stringify(bulk, null, 2))
    logger.info("hehe")
  }
  clearTimeout(foo);
}

try{
CG.start();
} catch(e) {
  console.log ("Error loading chaingear");
  throw(e);
}

var moo = setInterval(function() {
  console.log (process.hrtime(time) + " waiting for chaingear");
  if (CG.chaingear) {
    clearInterval(moo);
    fetchMC();
  }
}, 1000);

var foo = setTimeout(function(){
  clearInterval(moo);
  clearTimeout(foo);
}, 40000)
