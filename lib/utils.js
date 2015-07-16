/* return float or string if not parsed */
function tryParseFloat(val) {
  try {
    return parseFloat(val);
  } catch (e) {
    return val;
  }
}

function tryParseInt(val) {
  try {
    return parseInt(val);
  } catch (e) {
    return val;
  }
}

function parseResponse(data) {
  var parsedData = {};
  try {
    parsedData = JSON.parse(data);
  } catch (e) {

  }
  return parsedData;
}

module.exports = {
  tryParseFloat: tryParseFloat,
  tryParseInt: tryParseInt,
  parseResponse: parseResponse,
  esMappingObjects: {
    notAnalyzedString: {
      "type": "string",
      "index": "not_analyzed"
    },
    chainGearDate: {
      "type" : "date",
      "format" : "d/MM/YYYY"
    }
  }
};