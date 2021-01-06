const config = require(`./config.json`);
const fetch = require("node-fetch");
const ora = require("ora");
let init = false;
let laMetricAuthKey = `Basic ${Buffer.from(
  `dev:${config.LaMetric.AuthKey}`
).toString("base64")}`;

if (config.debugMode) {
  console.log("Debug Mode Enabled");
}
console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
let spinner = ora(
  `Testing Pi-Hole Connection @ ${config.PiHole.IP}...`
).start();

fetch(
  `http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`
)
  .then((res) => res.json())
  .then((piHoleRes) => {
    spinner.succeed(`Pi-Hole Connection @ ${config.PiHole.IP} Successful!`);
    spinner = ora(`Testing Pi-Hole Auth...`).start();
    if (piHoleRes.querytypes != null) {
      spinner.succeed(`Pi-Hole Auth Valid!`);
      let successfulLaMetricConnections = 0;
      let laMetricTest = () => {
        if (init == false) {
          spinner = ora(
            `Testing Connection to LaMetric @ ${config.LaMetric.IP}...`
          ).start();
          fetchWithAuth(
            `http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
            laMetricAuthKey
          )
            .then((laMetricDeviceInfo) => {
              successfulLaMetricConnections++;
              fetchWithAuth(
                `http://${config.LaMetric.IP}:8080/api/v2/device`,
                laMetricAuthKey
              ).then((laMetricDeviceInfo2) => {
                spinner.succeed(
                  `Connected to "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} running OS v${laMetricDeviceInfo2.os_version} & Pi-Hole Status v${laMetricDeviceInfo.version}! (${laMetricDeviceInfo2.serial_number})`
                );
                init = true;
                laMetricTest();
              });
            })
            .catch((err) => {
              if (config.debugMode) {
                console.log(err);
              }
              if (err.statusCode != null && err.body.errors != null) {
                if (err.statusCode == 401) {
                  spinner.fail(
                    `Connection to LaMetric @ ${config.LaMetric.IP} Failed. Auth invalid.`
                  );
                } else if (err.statusCode == 404) {
                  spinner.fail(
                    `Connection to LaMetric @ ${config.LaMetric.IP} Failed. Pi-Hole Status app not installed on the LaMetric.`
                  );
                } else {
                  spinner.fail(
                    `Connection to LaMetric @ ${config.LaMetric.IP} Failed. LaMetric does not seem to linked to this IP.`
                  );
                }
              } else {
                spinner.fail(
                  `Connection to LaMetric @ ${config.LaMetric.IP} Failed. LaMetric does not seem to linked to this IP.`
                );
              }
              laMetricTest();
            });
        } else {
          let updateLaMetric = () => {
            var piHoleCalls = [
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
              let topQueryArray = Object.values(piHoleTopItemsData.top_queries);
              let topBlockedQueryArray = Object.values(
                piHoleTopItemsData.top_ads
              );
              let body = {
                blockListSize: piHoleSummaryData.domains_being_blocked,
                dnsQueriesToday: piHoleSummaryData.dns_queries_today,
                adsBlockedToday: piHoleSummaryData.ads_blocked_today,
                totalClientsSeen: piHoleSummaryData.clients_ever_seen,
                totalDNSQueries: piHoleSummaryData.dns_queries_all_types,
                topQuery: `${Object.keys(
                  piHoleTopItemsData.top_queries
                )[0].toString()} (${topQueryArray[0].toString()} Queries)`,
                topBlockedQuery: `${Object.keys(
                  piHoleTopItemsData.top_ads
                )[0].toString()} (${topBlockedQueryArray[0].toString()} Queries)`,
                lastBlockedQuery: piHoleRecentBlockedData,
              };

              let updateSpinner = ora(
                `Connecting to LaMetric @ ${config.LaMetric.IP}...`
              ).start();
              fetchWithAuth(
                `http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
                laMetricAuthKey
              )
                .then((laMetricDeviceInfo) => {
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
                        `Sent update for "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} to the server!`
                      );
                    });
                  });
                })
                .catch((err) => {
                  if (config.debugMode) {
                    console.log(err);
                  }
                  if (err.statusCode != null && err.body.errors != null) {
                    if (err.statusCode == 401) {
                      updateSpinner.fail(
                        `Update failed to send for LaMetric @ ${config.LaMetric.IP}. Auth invalid.`
                      );
                    } else if (err.statusCode == 404) {
                      updateSpinner.fail(
                        `Update failed to send for LaMetric @ ${config.LaMetric.IP}. Pi-Hole Status app not installed on the LaMetric.`
                      );
                    } else {
                      updateSpinner.fail(
                        `Update failed to send for LaMetric @ ${config.LaMetric.IP}. LaMetric does not seem to linked to this IP.`
                      );
                    }
                  } else {
                    updateSpinner.fail(
                      `Update failed to send for LaMetric @ ${config.LaMetric.IP}. LaMetric does not seem to linked to this IP.`
                    );
                  }
                });
            });
          };
          setInterval(() => {
            updateLaMetric();
          }, config.updateInterval * 1000);
          updateLaMetric();
        }
      };
      laMetricTest(0);
    } else {
      spinner.fail(
        "Pi-Hole Auth Invalid! Make sure the supplied key is correct."
      );
      process.exit();
    }
  })
  .catch((err) => {
    if (config.debugMode) {
      console.log(err);
    }
    spinner.fail(
      "Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct."
    );
    process.exit();
  });

function fetchWithAuth(url, auth) {
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth },
  }).then((res) => res.json());
}
