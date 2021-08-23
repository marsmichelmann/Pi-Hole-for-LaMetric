const config = require(`./config.json`);
const fetch = require('node-fetch');
const spinner = require('ora')();
const laMetricAuthKey = `Basic ${Buffer.from(
	'dev:' + config.LaMetric.AuthKey,
).toString('base64')}`;

/**
 * Logs the given msg if debug mode is enabled.
 * @param msg the message to log.
 */
const logIfDebug = (msg) => {
	if (config.debugMode) {
		console.log(msg);
	}
};
/**
 * Checks if connection to pi hole can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
const piHoleTest = () => {
	logIfDebug('Debug Mode Enabled');
	console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
	spinner.text = `Testing Pi-Hole Connection @ ${config.PiHole.IP}...`;
	spinner.start();
	return fetch(
		`http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`,
	)
		.then((res) => res.json())
		.then((piHoleRes) => {
			spinner.succeed(
				`Pi-Hole Connection @ ${config.PiHole.IP} Successful!`,
			);
			spinner.text = 'Testing Pi-Hole Auth...';
			spinner.start();
			if (piHoleRes.querytypes != null) {
				spinner.succeed(`Pi-Hole Auth Valid!`);
				return Promise.resolve();
			} else {
				spinner.fail(
					'Pi-Hole Auth Invalid! Make sure the supplied key is correct.',
				);
				return Promise.reject();
			}
		})
		.catch(() => {
			let msg =
				'Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.';
			spinner.fail(msg);
			return Promise.reject(msg);
		});
};
/**
 * Triggers fetch get request for the given url with the given authorization header.
 * @param url the url to call.
 * @param auth the authorization header.
 * @returns {Promise<*>} of the called fetch.
 */
const fetchWithAuth = (url, auth) => {
	return fetch(url, {
		method: 'GET',
		headers: { Authorization: auth },
	}).then((res) => res.json());
};
/**
 * Checks if connection to lametric can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
const laMetricTest = () => {
	spinner.text = `Testing Connection to LaMetric @ ${config.LaMetric.IP}...`;
	spinner.start();
	return new Promise((resolve, reject) => {
		fetchWithAuth(
			`http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
			laMetricAuthKey,
		)
			.then((laMetricDeviceInfo) => {
				if (isUnauthorized(laMetricDeviceInfo)) {
					return reject('Connection to Lametric is unauthorized');
				}
				fetchWithAuth(
					`http://${config.LaMetric.IP}:8080/api/v2/device`,
					laMetricAuthKey,
				).then((laMetricDeviceInfo2) => {
					if (laMetricDeviceInfo2.name) {
						spinner.succeed(
							`Connected to "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} running OS v${laMetricDeviceInfo2.os_version} & Pi-Hole Status v${laMetricDeviceInfo.version}! (${laMetricDeviceInfo2.serial_number})`,
						);
						return resolve();
					} else {
						let msg = 'Lametric data is corrupt!';
						spinner.fail(msg);
						return reject(msg);
					}
				});
			})
			.catch((err) => {
				spinner.fail(
					`Connection to LaMetric @ ${config.LaMetric.IP} Failed. LaMetric does not seem to linked to this IP.`,
				);
				return reject(err);
			});
	});
};
const mapToBody = (
	piHoleSummaryData,
	piHoleTopItemsData,
	piHoleRecentBlockedData,
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
/**
 * Collects data from pi hole, combines it and sends the result to lametric instance.  In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
const updateLaMetric = () => {
	return new Promise((resolve, reject) => {
		// request data from pi hole and combine it
		const piHoleCalls = [
			fetch(
				`http://${config.PiHole.IP}/admin/api.php?summary&auth=${config.PiHole.AuthKey}`,
			).then((res) => res.json()),
			fetch(
				`http://${config.PiHole.IP}/admin/api.php?topItems&auth=${config.PiHole.AuthKey}`,
			).then((res) => res.json()),
			fetch(
				`http://${config.PiHole.IP}/admin/api.php?recentBlocked&auth=${config.PiHole.AuthKey}`,
			).then((res) => res.text()),
		];
		Promise.all(piHoleCalls).then(
			([
				piHoleSummaryData,
				piHoleTopItemsData,
				piHoleRecentBlockedData,
			]) => {
				let body = mapToBody(
					piHoleSummaryData,
					piHoleTopItemsData,
					piHoleRecentBlockedData,
				);

				spinner.text = `Connecting to LaMetric @ ${config.LaMetric.IP}...`;
				spinner.start();
				fetchWithAuth(
					`http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
					laMetricAuthKey,
				)
					.then((laMetricDeviceInfo) => {
						if (isUnauthorized(laMetricDeviceInfo)) {
							return reject(
								'Connection to Lametric is unauthorized',
							);
						}
						fetchWithAuth(
							`http://${config.LaMetric.IP}:8080/api/v2/device`,
							laMetricAuthKey,
						).then((laMetricDeviceInfo2) => {
							if (laMetricDeviceInfo2.name) {
								spinner.text = `Sending update for "${laMetricDeviceInfo2.name}" @ ${config.LaMetric.IP} to the server...`;
								fetch(
									`https://lametric.glitch.me/pihole/${laMetricDeviceInfo2.id}`,
									{
										method: 'POST',
										body: body,
									},
								).then(() => {
									spinner.succeed(
										`Sent update for "${
											laMetricDeviceInfo2.name
										}" @ ${
											config.LaMetric.IP
										} to the server (sent data: "${JSON.stringify(
											body,
											null,
											2,
										)}")!`,
									);
									return resolve();
								});
							} else {
								let msg =
									'Lametric data not available Invalid! Make sure the supplied key is correct.';
								spinner.fail(msg);
								return reject(msg);
							}
						});
					})
					.catch((err) => {
						spinner.fail(
							`Update failed to send for LaMetric @ ${config.LaMetric.IP}. LaMetric does not seem to linked to this IP.`,
						);
						return reject(err);
					});
			},
		);
	});
};
/**
 * Starts interval timer for calling the given callback function based on the config.
 * @param callback the function to call
 */
const startUpdateTimer = (callback) => {
	setInterval(() => {
		callback();
	}, config.updateInterval * 1000);
};
/**
 * Main program.
 *
 */
const main = () => {
	piHoleTest()
		.then(laMetricTest)
		// send initial update
		.then(updateLaMetric)
		.then(() => startUpdateTimer(updateLaMetric))
		.catch((err) => {
			logIfDebug(err);
		});
};

/**
 * Checks if we have a unauthorized connection to lametric.
 * @param response the response to check.
 */
const isUnauthorized = (response) => {
	return (
		response.errors &&
		response.errors[0].message &&
		response.errors[0].message === 'Authorization is required'
	);
};

/**
 * Maps the given index of the given data map to human readable string.
 * @param data.
 * @param index the desired index.
 */
const mapKeyValuePairToString = (data, index) => {
	let keys = Object.keys(data);
	let values = Object.values(data);
	return `${keys[index].toString()} (${values[index].toString()} Queries)`;
};

// call main program directly
//main();

module.exports = {
	main,
	spinner,
};
