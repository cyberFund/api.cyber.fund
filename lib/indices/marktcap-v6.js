var utils = require("../utils")
  // put index map
function putmap(esClient, indexName) {

  var mapping1 = {
    index: indexName,
    type: "market",
    ignoreConflicts: true,
    body: {
      "market": {
        properties: {
          "cap_btc": {
            "type": "double",
            "doc_values": true
          },
          "cap_usd": {
            "type": "double",
            "doc_values": true
          },
          "consensus": {
            "type": "object",
            "properties": {
              "consensus_type": utils.esMappingObjects.notAnalyzedString,
              "consensus_name": utils.esMappingObjects.notAnalyzedString,
              "hashing": utils.esMappingObjects.notAnalyzedString
            }
          },
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


          "events": {
            "type": "object",
            "properties": {
              "name": utils.esMappingObjects.notAnalyzedString,
              "start_date": {
                "type": "date",
                "format": "dateOptionalTime",
                "doc_values": true
              },
              "url": utils.esMappingObjects.notAnalyzedString,
              "announcement": utils.esMappingObjects.chainGearDate,
              "genesis": utils.esMappingObjects.chainGearDate
            }
          },
          "price_btc": {
            "type": "double",
            "doc_values": true
          },
          "price_usd": {
            "type": "double",
            "doc_values": true
          },
          "ranking_coinmarketcap": utils.esMappingObjects.notAnalyzedString,
          "rating_cyber": {
            "type": "long",
            "doc_values": true
          },
          "specs": {
            "properties": {
              "block_time": {
                "type": "integer",
                "doc_values": true
              },
              "txs_confirm": {
                "type": "integer",
                "doc_values": true
              }
            }
          },
          "supply_current": {
            "type": "long",
            "doc_values": true
          },
          "tags": utils.esMappingObjects.notAnalyzedString,

          "timestamp": {
            "type": "date",
            "format": "dateOptionalTime",
            "doc_values": true
          },
          "volume24_btc": {
            "type": "double",
            "doc_values": true
          },
          "volume24_usd": {
            "type": "long",
            "doc_values": true
          }
        }
      }
    }
  };
  var mapping2 = {
    index: indexName,
    type: "exchange-rates",
    ignoreConflicts: true,
    body: {
      "exchange-rates": {
        properties: {
          "aud": {
            "type": "double",
            "doc_values": true
          },
          "cad": {
            "type": "double",
            "doc_values": true
          },
          "cny": {
            "type": "double",
            "doc_values": true
          },
          "eur": {
            "type": "double",
            "doc_values": true
          },
          "gbp": {
            "type": "double",
            "doc_values": true
          },
          "hkd": {
            "type": "double",
            "doc_values": true
          },
          "jpy": {
            "type": "double",
            "doc_values": true
          },
          "rub": {
            "type": "double",
            "doc_values": true
          },
          "timestamp": {
            "type": "date",
            "format": "dateOptionalTime",
            "doc_values": true
          },
          "usd": {
            "type": "long",
            "doc_values": true
          }
        }
      }
    }
  };

  return [esClient.indices.putMapping(mapping1),
    esClient.indices.putMapping(mapping2)
  ];
}

module.exports = {
  putMapping: putmap
}
