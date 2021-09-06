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
 * Fetches the given {@param url} with optional {@param payload}. (optionally with authorization header using the given
 * {@param auth} value). The received response is processed with the given {@param callbackFunction}.
 *
 * @param url the url to call.
 * @param payload optional payload for the request.
 * @param auth optional authorization header for the request.
 * @param callbackFunction the callback function to be called to process the response received for the request.

 * @returns {Promise<*>} of the called fetch.
 */
const fetchAndProcess = (url, payload, auth, callbackFunction) => {
	return fetch(url, {
		method: payload ? 'POST' : 'GET',
		body: payload ? payload : null,
		headers: auth ? { Authorization: auth } : {},
	})
		.then((res) =>
			url.includes('recentBlocked') ? res.text() : res.json(),
		)
		.then((res) => callbackFunction(res))
		.then(({ msg, res }) => {
			if (!msg.includes('ignore')) {
				spinner.succeed(msg);
			}
			return Promise.resolve(res);
		})
		.catch((errorMsg) => {
			console.log(errorMsg);
			spinner.fail(errorMsg.message);
			return Promise.reject(errorMsg.message);
		});
};

/**
 * Checks if connection to pi hole can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
const piHoleTest = () => {
	logIfDebug('Debug Mode Enabled');
	console.log(`Starting Pi-Hole for LaMetric ${config.version}...`);
	spinner.succeed(`Testing Pi-Hole Connection @ ${config.PiHole.IP}...`);

	return fetchAndProcess(
		`http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`,
		null,
		null,
		handlePiholeLoginResponse,
	);
};

/**
 * Handles the given {@param response} from Pihole login.
 * @param response the response to handle.
 * @returns {Promise<{msg: string, res: ({querytypes}|*)}>} Resolves the promise in case of a valid response. Otherwise an error is thrown.
 */
const handlePiholeLoginResponse = (response) => {
	spinner.succeed(
		`Pi-Hole Connection @ ${config.PiHole.IP} Successful! Testing Pi-Hole Auth...`,
	);
	spinner.start();
	if (response.querytypes == null) {
		throw new Error(
			'Pi-Hole Auth Invalid! Make sure the supplied key is correct.',
		);
	}

	return Promise.resolve({ msg: 'Pi-Hole Auth Valid!', res: response });
};

/**
 * Checks if connection to lametric can be established. In case everything works fine a resolved promise is returned, otherwise a rejected promise.
 */
const laMetricTest = () => {
	spinner.succeed(
		`Testing Connection to LaMetric @ ${config.LaMetric.IP}...`,
	);
	spinner.start();

	const lametricCalls = [
		fetchAndProcess(
			`http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
			null,
			laMetricAuthKey,
			handleLametricLoginResponse,
		),
		fetchAndProcess(
			`http://${config.LaMetric.IP}:8080/api/v2/device`,
			null,
			laMetricAuthKey,
			handleLametricDataResponse,
		),
	];

	return Promise.all(lametricCalls).then(([lametricLogin, lametricData]) => {
		spinner.succeed(
			`Connected to LaMetric @ ${config.LaMetric.IP} running OS v${lametricLogin.os_version} & Pi-Hole Status v${lametricLogin.version}! (${lametricData.serial_number})`,
		);
		return Promise.resolve();
	});
};

/**
 * Handles the given {@param response} from Lametric login.
 *
 * @param response the response to handle.
 * @returns {Promise<{msg: string, res}>} Resolves the promise in case of a valid response. Otherwise an error is thrown.
 */
const handleLametricLoginResponse = (response) => {
	if (isUnauthorized(response)) {
		throw new Error('Connection to Lametric is unauthorized');
	}
	return Promise.resolve({
		msg: 'ignore',
		res: response,
	});
};

/**
 * Handles the given {@param response} from Lametric data request.
 *
 * @param response the response to handle.
 * @returns {Promise<{msg: string, res: ({name}|*)}>} Resolves the promise in case of a valid response. Otherwise an error is thrown.
 */
const handleLametricDataResponse = (response) => {
	if (response.name) {
		return Promise.resolve({ msg: 'ignore', res: response });
	}

	throw new Error('Lametric data is corrupt!');
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
	spinner.succeed(
		`Connecting to LaMetric @ ${config.LaMetric.IP}... for sending update`,
	);

	const lametricCalls = [
		fetchAndProcess(
			`http://${config.LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`,
			null,
			laMetricAuthKey,
			handleLametricLoginResponse,
		),
		fetchAndProcess(
			`http://${config.LaMetric.IP}:8080/api/v2/device`,
			null,
			laMetricAuthKey,
			handleLametricDataResponse,
		),
	];

	return Promise.all(lametricCalls)
		.then(async ([lametricLogin, lametricData]) => {
			spinner.succeed(
				`Connected to LaMetric @ ${config.LaMetric.IP} for sending update`,
			);

			let piholeData = await getPiholeData();
			spinner.start(
				`Sending update for "${lametricData.name}" @ ${config.LaMetric.IP} to the server`,
			);

			// TODO switch to fetchAndProcess
			// return fetchAndProcess(
			// 	`https://lametric.glitch.me/pihole/${lametricData.id}`,
			// 	piholeData,
			// 	null,
			// 	(res) => handleLametricUpdateResponse(res, piholeData),
			// );
			return fetch(
				`https://lametric.glitch.me/pihole/${lametricData.id}`,
				{
					method: 'POST',
					body: piholeData,
				},
			)
				.then((res) => handleLametricUpdateResponse(res, piholeData))
				.catch((err) => {
					spinner.fail(
						`Update failed to send for LaMetric @ ${config.LaMetric.IP}. LaMetric does not seem to linked to this IP.`,
					);
					return Promise.reject(err);
				});
		})
		.catch((err) => {
			return Promise.reject(err);
		});
};

/**
 * Handles the given {@param response} from Lametric update request.
 *
 * @param response the response to handle.
 * @param payload the sent payload.
 * @returns {Promise<void>} Resolves the promise in case of a valid response. Otherwise an error is thrown.
 */
const handleLametricUpdateResponse = (response, payload) => {
	// TODO payload needed?
	//console.log('\nreceived response: ' + JSON.stringify(response, null, 2));
	spinner.succeed(
		`Sent data (${JSON.stringify(payload, null, 2)}) to lametric server`,
	);
	return Promise.resolve({ msg: 'ignore', res: response });
};

/**
 * Collects and combines relevant data from pihole.
 * @returns {Promise<{adsBlockedToday: *, totalClientsSeen: *, totalDNSQueries: *, topQuery: string, topBlockedQuery: string, dnsQueriesToday: *, lastBlockedQuery: *, blockListSize: *}>}
 */
const getPiholeData = () => {
	const piHoleCalls = [
		fetchAndProcess(
			`http://${config.PiHole.IP}/admin/api.php?summary&auth=${config.PiHole.AuthKey}`,
			null,
			null,
			handlePiholeDataResponse,
		),
		fetchAndProcess(
			`http://${config.PiHole.IP}/admin/api.php?topItems&auth=${config.PiHole.AuthKey}`,
			null,
			null,
			handlePiholeDataResponse,
		),
		fetchAndProcess(
			`http://${config.PiHole.IP}/admin/api.php?recentBlocked&auth=${config.PiHole.AuthKey}`,
			null,
			null,
			handlePiholeDataResponse,
		),
	];

	return Promise.all(piHoleCalls).then(
		([piHoleSummaryData, piHoleTopItemsData, piHoleRecentBlockedData]) =>
			mapToBody(
				piHoleSummaryData,
				piHoleTopItemsData,
				piHoleRecentBlockedData,
			),
	);
};

/**
 * Handles the given {@param response} from Pihole data request.
 *
 * @param response the response to handle.
 * @returns {{msg: string, res}} Resolves the promise in case of a valid response. Otherwise an error is thrown.
 */
const handlePiholeDataResponse = (response) => {
	return { msg: 'ignore', res: response };
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
	fetchAndProcess,
	getPiholeData,
};
