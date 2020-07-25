const config = require(`./config.json`);
const fetch = require("node-fetch");
const ora = require("ora");

var successfulLaMetricConnections = 0;
var availableLaMetrics = [];
logIfDebug("Debug Mode Enabled");

console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
let PiHoleResult = fetchPihole();
authentificatePihole(PiHoleResult);
let laMetricTest = (indexNumber) => {
  if (config.LaMetric[indexNumber] != null) {
    let spinner = ora(
      `Testing Connection to LaMetric @ ${config.LaMetric[indexNumber].IP}...`
    ).start();
    fetchWithAuth(
      `http://${config.LaMetric[indexNumber].IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
      createBasicAuth(config.LaMetric[indexNumber])
    )
      .then((LaMetricDeviceInfo) => {
        successfulLaMetricConnections++;
        fetchWithAuth(
          `http://${config.LaMetric[indexNumber].IP}:8080/api/v2/device`,
          createBasicAuth(config.LaMetric[indexNumber])
        ).then((LaMetricDeviceInfo2) => {
          spinner.succeed(
            `Connected to "${LaMetricDeviceInfo2.body.name}" @ ${config.LaMetric[indexNumber].IP} running OS v${LaMetricDeviceInfo2.body.os_version} & Pi-Hole Status v${LaMetricDeviceInfo.body.version}! (${LaMetricDeviceInfo2.body.serial_number})`
          );
          availableLaMetrics.push(config.LaMetric[indexNumber]);
          laMetricTest(indexNumber + 1);
        });
      })
      .catch((err) => {
        logIfDebug(err);
        if (err.statusCode != null && err.body.errors != null) {
          if (err.statusCode == 401) {
            spinner.fail(
              `Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. Auth invalid.`
            );
          } else if (err.statusCode == 404) {
            spinner.fail(
              `Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. Pi-Hole Status app not installed on the LaMetric.`
            );
          } else {
            spinner.fail(
              `Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. LaMetric does not seem to linked to this IP.`
            );
          }
        } else {
          spinner.fail(
            `Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. LaMetric does not seem to linked to this IP.`
          );
        }
        laMetricTest(indexNumber + 1);
      });
  } else {
    if (successfulLaMetricConnections > 0) {
      spinner = ora(`Checking for updates...`).start();
      fetch(
        `https://raw.githubusercontent.com/iDerp/Pi-Hole-for-LaMetric/stable/example.config.json`
      )
        .then((res) => res.json())
        .then((jsonData) => {
          if (jsonData.version == config.version) {
            spinner.info("Up to date.");
          } else {
            spinner.warn(`New update available! (${jsonData.version})`);
          }
          let updateLaMetric = () => {
            fetch(
              `http://${config.PiHole.IP}/admin/api.php?summary&auth=${config.PiHole.AuthKey}`
            )
              .then((PiHoleSummaryData) => {
                fetch(
                  `http://${config.PiHole.IP}/admin/api.php?topItems&auth=${config.PiHole.AuthKey}`
                )
                  .then((res) => res.json())
                  .then((PiHoleTopItemsData) => {
                    fetch(
                      `http://${config.PiHole.IP}/admin/api.php?recentBlocked&auth=${config.PiHole.AuthKey}`
                    )
                      .then((PiHoleRecentBlockedData) => {
                        availableLaMetrics.forEach((LaMetric) => {
                          let updateIndex = 1;
                          let updateSpinner = ora(
                            `Connecting to LaMetric @ ${LaMetric.IP}...`
                          ).start();
                          fetchWithAuth(
                            `http://${LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
                            createBasicAuth(LaMetric)
                          )
                            .then((LaMetricDeviceInfo) => {
                              fetchWithAuth(
                                `http://${LaMetric.IP}:8080/api/v2/device`,
                                createBasicAuth(LaMetric)
                              ).then((LaMetricDeviceInfo2) => {
                                updateSpinner.text = `Sending update for "${LaMetricDeviceInfo2.body.name}" @ ${LaMetric.IP} to the server...`;
                                let topQueryArray = Object.values(
                                  PiHoleTopItemsData.top_queries
                                );
                                let topBlockedQueryArray = Object.values(
                                  PiHoleTopItemsData.top_ads
                                );
                                fetch(
                                  `https://lametric.iderp.io/pihole/${LaMetricDeviceInfo2.body.id}`,
                                  {
                                    method: "POST",
                                    body: {
                                      blockListSize:
                                        PiHoleSummaryData.body
                                          .domains_being_blocked,
                                      dnsQueriesToday:
                                        PiHoleSummaryData.body
                                          .dns_queries_today,
                                      adsBlockedToday:
                                        PiHoleSummaryData.body
                                          .ads_blocked_today,
                                      totalClientsSeen:
                                        PiHoleSummaryData.body
                                          .clients_ever_seen,
                                      totalDNSQueries:
                                        PiHoleSummaryData.body
                                          .dns_queries_ally_types,
                                      topQuery: `${Object.keys(
                                        PiHoleTopItemsData.top_queries
                                      )[0].toString()} (${topQueryArray[0].toString()} Queries)`,
                                      topBlockedQuery: `${Object.keys(
                                        PiHoleTopItemsData.top_ads
                                      )[0].toString()} (${topBlockedQueryArray[0].toString()} Queries)`,
                                      lastBlockedQuery: "N/A",
                                    },
                                  }
                                )
                                  .then(() => {
                                    updateIndex++;
                                    updateSpinner.succeed(
                                      `Sent update for "${LaMetricDeviceInfo2.body.name}" @ ${LaMetric.IP} to the server!`
                                    );
                                  })
                                  .catch((err) => console.error(err));
                              });
                            })
                            .catch((err) => {
                              logIfDebug(err);
                              if (
                                err.statusCode != null &&
                                err.body.errors != null
                              ) {
                                if (err.statusCode == 401) {
                                  updateSpinner.fail(
                                    `Update failed to send for LaMetric @ ${LaMetric.IP}. Auth invalid.`
                                  );
                                } else if (err.statusCode == 404) {
                                  updateSpinner.fail(
                                    `Update failed to send for LaMetric @ ${LaMetric.IP}. Pi-Hole Status app not installed on the LaMetric.`
                                  );
                                } else {
                                  updateSpinner.fail(
                                    `Update failed to send for LaMetric @ ${LaMetric.IP}. LaMetric does not seem to linked to this IP.`
                                  );
                                }
                              } else {
                                updateSpinner.fail(
                                  `Update failed to send for LaMetric @ ${LaMetric.IP}. LaMetric does not seem to linked to this IP.`
                                );
                              }
                            });
                        });
                      })
                      .catch((err) => {
                        logIfDebug(err);
                        console.log(
                          "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
                        );
                      });
                  })
                  .catch((err) => {
                    logIfDebug(err);
                    console.log(
                      "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
                    );
                  });
              })
              .catch((err) => {
                logIfDebug(err);
                console.log(
                  "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
                );
              });
          };
          setInterval(() => {
            updateLaMetric();
          }, config.updateInterval * 1000);
          updateLaMetric();
        });
    } else {
      console.log(
        `At least 1 LaMetric must have a successful connection to continue.`
      );
      process.exit();
    }
  }
};
laMetricTest(0);

function fetchLametric(config) {
  let spinner = ora(`Testing Connection to LaMetric @ ${config.IP}...`).start();
  fetchWithAuth(
    `http://${config.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,

    `Basic ${Buffer.from(`dev:${config.AuthKey}`).toString("base64")}`
  );
}

function createBasicAuth(config) {
  return `Basic ${Buffer.from(`dev:${config.AuthKey}`).toString("base64")}`;
}

function authentificatePihole(PiHoleResult) {
  fetch(
    `http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`
  ).then((PiHoleResult) => {
    let spinner = ora(`Testing Pi-Hole Auth...`).start();
    if (PiHoleResult.body == null) {
      spinner.fail(
        "Pi-Hole Auth Invalid! Make sure the supplied key is correct."
      );
      process.exit();
    }

    spinner.succeed(`Pi-Hole Auth Valid!`);
  });
}

function fetchPihole() {
  console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
  let spinner = ora(
    `Testing Pi-Hole Connection @ ${config.PiHole.IP}...`
  ).start();
  fetch(
    `http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`
  )
    .then((res) => {
      spinner.succeed(`Pi-Hole Connection @ ${config.PiHole.IP} Successful!`);
      return res;
    })
    .catch((err) => {
      logIfDebug(err);
      spinner.fail(
        "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
      );
      process.exit();
    });
}

function logIfDebug(msg) {
  if (config.debugMode) {
    console.log(msg);
  }
}

function fetchWithAuth(url, auth) {
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
  });
}
