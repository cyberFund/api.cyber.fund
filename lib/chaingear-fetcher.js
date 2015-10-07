var _ = require('underscore');
var rp = require('request-promise');
var fs = require("fs");
var when = require("when");
var utils = require("./utils");
var sourceUrlCG = "https://raw.githubusercontent.com/cyberFund/chaingear/gh-pages/chaingear.json";
var fetchIntervalCG = 5 * 60 * 1000;
var logger = require("log4js").getLogger("chaingear");


var etag = '';
try {
  etag = fs.readFileSync("chaingear.etag");
  logger.info("loaded previous etag");
} catch (e) {
  logger.info("no etag yet");
}

var CG = {
  /* send head request, compare with previously saved etag.
   return false if not changed, true if changed
   */
  _isEtagChanged: function () {
    var cg = this;
    return when.promise(function (resolve, reject) {
      function needFetch() {
        resolve(true);
      }

      function doNotNeedFetch() {
        resolve(false);
      }

      var options = {
        method: 'HEAD',
        uri: sourceUrlCG,
        transform: function (body, response) {
          return response.headers.etag;
        }
      };
      rp(options).then(function (result) {
        if (etag == result) {
          try {
            cg.chaingear = JSON.parse(fs.readFileSync("chaingear.json"));
          } catch (e) {
            needFetch();
          }
          doNotNeedFetch()
        } else {
          cg.newEtag = result;
          needFetch();
        }
      }, function (reason) {
        reject(reason);
      });
    });
  },
  /* fetch json file */
  _fetch: function () {
    var cg = this;
    var options = {
      method: 'GET',
      uri: sourceUrlCG,
      transform: utils.parseResponse
    };

    rp(options).then(function (result) {
      cg.chaingear = result;

      fs.writeFile("chaingear.json", JSON.stringify(result, null, 2), function (err) {
        if (err) {
          logger.error("could not write file chaingear.json, status: ");
          logger.error(err);
        } else {

          fs.writeFile("chaingear.etag", cg.newEtag, function (err) {
            if (err) {
              logger.error("could not write file chaingear.etag, status: ");
              logger.error(err);
            }
            cg.newEtag = "";
            logger.info("Chaingear updated.");
          })
        }
      })
    })
  },

  _update: function () {
    var cg = this;
    cg._isEtagChanged().then(function (result) {
        if (result) {
          cg._fetch();
        }
      },
      function (reason) {
        logger.warn("fetching chaingear fialed with reason: ");
        logger.warn(reason);
        console.log();
      });
  },
  start: function () {
    var cg = this;
    cg._update();
    setInterval(function () {
      cg._update();
    }, fetchIntervalCG);
  }
};
module.exports = CG;