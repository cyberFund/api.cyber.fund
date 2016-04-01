var _ = require('lodash');
var rp = require('request-promise');
var fs = require("fs");
var when = require("when");
var utils = require("./utils");
var sourceUrlCG = "https://cyber.fund/chg/current/full.json";
//"https://raw.githubusercontent.com/cyberFund/chaingear/gh-pages/chaingear.json";
var fetchIntervalCG = 5 * 60 * 1000;


var etag = '';
try {
  etag = fs.readFileSync("./chaingear.etag");
  console.log("loaded previous etag");
} catch (e) {
  console.log("no etag yet");
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
        },
        timeout: 20000
      };
      rp(options).then(function (result) {
        if (etag == result) {
          try {
            cg.chaingear = JSON.parse(fs.readFileSync("./chaingear.json"));
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
      transform: utils.parseResponse,
      timeout: 20000
    };

    rp(options).then(function (result) {
      cg.chaingear = result;

      fs.writeFile("./chaingear.json", JSON.stringify(result, null, 2), function (err) {
        if (err) {
          console.error("could not write file chaingear.json, status: ");
          console.error(err);
        } else {

          fs.writeFile("./chaingear.etag", cg.newEtag, function (err) {
            if (err) {
              console.error("could not write file chaingear.etag, status: ");
              console.error(err);
            }
            cg.newEtag = "";
            console.info("Chaingear updated.");
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
        console.warn("fetching chaingear failed with reason: ");
        console.warn(reason);
        console.log();
      });
  },
  start: function () {
    var cg = this;
    cg._update();
    /*setInterval(function () {
      cg._update();
    }, fetchIntervalCG);*/
  }
};
module.exports = CG;
