const config = require(`./config.json`);
const fetch = require("node-fetch");
const ora = require("ora");
let laMetricAuthKey = `Basic ${Buffer.from(
  `dev:${config.LaMetric.AuthKey}`
).toString("base64")}`;

/**
 * Main program.
 *
 */
let main = () => {
  piHoleTest()
    .then(laMetricTest)
    // send initial update
    .then(updateLaMetric)
    .then(startUpdateTimer(updateLaMetric))
    .catch((err) => {
      logIfDebug(err);
    });
};

/**
 * Checks if connection to pi hole can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
let piHoleTest = () => {
  logIfDebug("Debug Mode Enabled");
  console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
  let spinner = ora(
    `Testing Pi-Hole Connection @ ${config.PiHole.IP}...`
  ).start();
  return fetch(
    `http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`
  )
    .then((res) => res.json())
    .then((piHoleRes) => {
      spinner.succeed(`Pi-Hole Connection @ ${config.PiHole.IP} Successful!`);
      spinner = ora(`Testing Pi-Hole Auth...`).start();
      if (piHoleRes.querytypes != null) {
        spinner.succeed(`Pi-Hole Auth Valid!`);
        return Promise.resolve();
      } else {
        spinner.fail(
          "Pi-Hole Auth Invalid! Make sure the supplied key is correct."
        );
        return Promise.reject();
      }
    })
    .catch((err) => {
      spinner.fail(
        "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
      );
      return Promise.reject(err);
    });
};

/**
 * Checks if we have a unauthorized connection to lametric.
 * @param response the response to check.
 */
let isUnauthorized = (response) => {
  return (
    response.errors &&
    response.errors[0].message &&
    response.errors[0].message === "Authorization is required"
  );
};

/**
 * Checks if connection to lametric can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
let laMetricTest = () => {
  let spinner = ora(
    `Testing Connection to LaMetric @ ${config.LaMetric.IP}...`
  ).start();
  return new Promise((resolve, reject) => {
    fetchWithAuth(
      `http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
      laMetricAuthKey
    )
      .then((laMetricDeviceInfo) => {
        if (isUnauthorized(laMetricDeviceInfo)) {
          reject("Connection to Lametric is unauthorized");
        }
        fetchWithAuth(
          `http://${config.LaMetric.IP}:8080/api/v2/device`,
          laMetricAuthKey
        ).then((laMetricDeviceInfo2) => {
          spinner.succeed(
            `Connected to "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} running OS v${laMetricDeviceInfo2.os_version} & Pi-Hole Status v${laMetricDeviceInfo.version}! (${laMetricDeviceInfo2.serial_number})`
          );
          return resolve();
        });
      })
      .catch((err) => {
        spinner.fail(
          `Connection to LaMetric @ ${config.LaMetric.IP} Failed. LaMetric does not seem to linked to this IP.`
        );
        return reject(err);
      });
  });
};

/**
 * Collects data from pi hole, combines it and sends the result to lametric instance.  In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
let updateLaMetric = () => {
  return new Promise((resolve, reject) => {
    // request data from pi hole and combine it
    let piHoleCalls = [
      fetch(
        `http://${config.PiHole.IP}/admin/api.php?summary&auth=${config.PiHole.AuthKey}`
      ).then((res) => res.json()),
      fetch(
        `http://${config.PiHole.IP}/admin/api.php?topItems&auth=${config.PiHole.AuthKey}`
      ).then((res) => res.json()),
      fetch(
        `http://${config.PiHole.IP}/admin/api.php?recentBlocked&auth=${config.PiHole.AuthKey}`
      ).then((res) => res.text()),
    ];
    Promise.all(piHoleCalls).then(function ([
      piHoleSummaryData,
      piHoleTopItemsData,
      piHoleRecentBlockedData,
    ]) {
      let body = mapToBody(
        piHoleSummaryData,
        piHoleTopItemsData,
        piHoleRecentBlockedData
      );

      let updateSpinner = ora(
        `Connecting to LaMetric @ ${config.LaMetric.IP}...`
      ).start();
      fetchWithAuth(
        `http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
        laMetricAuthKey
      )
        .then((laMetricDeviceInfo) => {
          if (isUnauthorized(laMetricDeviceInfo)) {
            return reject("Connection to Lametric is unauthorized");
          }
          fetchWithAuth(
            `http://${config.LaMetric.IP}:8080/api/v2/device`,
            laMetricAuthKey
          ).then((laMetricDeviceInfo2) => {
            updateSpinner.text = `Sending update for "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} to the server...`;
            fetch(
              `https://lametric.iderp.io/pihole/${laMetricDeviceInfo2.id}`,
              {
                method: "POST",
                body: body,
              }
            ).then(() => {
              updateSpinner.succeed(
                `Sent update for "${laMetricDeviceInfo2.name}" @ ${
                  config.LaMetric.IP
                } to the server (sent data: "${JSON.stringify(
                  body,
                  null,
                  2
                )}")!`
              );
              return resolve();
            });
          });
        })
        .catch((err) => {
          updateSpinner.fail(
            `Update failed to send for LaMetric @ ${config.LaMetric.IP}. LaMetric does not seem to linked to this IP.`
          );
          return reject(err);
        });
    });
  });
};

/**
 * Starts interval timer for calling the given callback function based on the config.
 * @param callback the function to call
 */
let startUpdateTimer = (callback) => {
  setInterval(() => {
    callback();
  }, config.updateInterval * 1000);
};

/**
 * Logs the given msg if debug mode is enabled.
 * @param msg the message to log.
 */
let logIfDebug = (msg) => {
  if (config.debugMode) {
    console.log(msg);
  }
};

/**
 * Triggers fetch get request for the given url with the given authorization header.
 * @param url the url to call.
 * @param auth the authorization header.
 * @returns {Promise<*>} of the called fetch.
 */
let fetchWithAuth = (url, auth) => {
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
  }).then((res) => res.json());
};

/**
 * Maps the given index of the given data map to human readable string.
 * @param data.
 * @param index the desired index.
 */
let mapKeyValuePairToString = (data, index) => {
  let keys = Object.keys(data);
  let values = Object.values(data);
  return `${keys[index].toString()} (${values[index].toString()} Queries)`;
};

let mapToBody = (
  piHoleSummaryData,
  piHoleTopItemsData,
  piHoleRecentBlockedData
) => {
  return {
    blockListSize: piHoleSummaryData.domains_being_blocked,
    dnsQueriesToday: piHoleSummaryData.dns_queries_today,
    adsBlockedToday: piHoleSummaryData.ads_blocked_today,
    totalClientsSeen: piHoleSummaryData.clients_ever_seen,
    totalDNSQueries: piHoleSummaryData.dns_queries_all_types,
    topQuery: mapKeyValuePairToString(piHoleTopItemsData.top_queries, 0),
    topBlockedQuery: mapKeyValuePairToString(piHoleTopItemsData.top_ads, 0),
    lastBlockedQuery: piHoleRecentBlockedData,
  };
};

// call main program directly
// main();

module.exports = {
  main,
};
