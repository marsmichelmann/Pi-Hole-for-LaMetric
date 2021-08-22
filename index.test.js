// import mock data
const {
	piHoleErrorResponse,
	piHoleInvalidResponse,
	piHoleResponse,
	piHoleSummaryData,
	piHoleTopItemsData,
	piHoleRecentBlockedData,
	lametricNotFoundErrorResponse,
	lametricUnauthorizedResponse,
	laMetricDeviceInfo,
	laMetricDeviceInfo2,
} = require('./index.mockdata');

// import private functions to test
const logIfDebug = require('./index.js').__get__('logIfDebug');
const piHoleTest = require('./index.js').__get__('piHoleTest');
const mapToBody = require('./index.js').__get__('mapToBody');
const mapKeyValuePairToString = require('./index.js').__get__(
	'mapKeyValuePairToString',
);
const startUpdateTimer = require('./index.js').__get__('startUpdateTimer');
const fetchWithAuth = require('./index.js').__get__('fetchWithAuth');
const laMetricTest = require('./index.js').__get__('laMetricTest');
const updateLaMetric = require('./index.js').__get__('updateLaMetric');

// const { main } = require('./index');

// mock fetch
const fetchMock = require('node-fetch');
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

// mock config
jest.mock('./config.json', () => require('./index.mockdata').mockConfig);

describe('testing pi hole for lametric', () => {
	beforeEach(() => {
		//fetchMock.config.fallbackToNetwork = true;
		jest.useFakeTimers('legacy');
	});

	it('should handle interval timer', async () => {
		// init
		const callbackMock = jest.fn();

		// run
		startUpdateTimer(callbackMock);

		// At this point in time, there should have been a single call to
		// setTimeout to schedule in 60 sec.
		expect(setInterval).toHaveBeenCalledTimes(1);
		expect(setInterval).toHaveBeenLastCalledWith(
			expect.any(Function),
			60000,
		);

		// Fast forward and exhaust only currently pending timers
		// (but not any new timers that get created during that process)
		jest.runOnlyPendingTimers();

		// At this point, our 1-second timer should have fired it's callback
		expect(callbackMock).toBeCalled();
		jest.clearAllTimers();
	});

	it('should fetch Json Placeholder via fetchWithAuth', async () => {
		// init
		console.warn = jest.fn();

		// run & validation
		await expect(
			fetchWithAuth('https://jsonplaceholder.typicode.com/todos/1'),
		).resolves.toEqual({
			completed: false,
			id: 1,
			title: 'delectus aut autem',
			userId: 1,
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of pi hole leads to error response', async () => {
		// init
		console.log = jest.fn();
		let url = 'http://1.1.1.1/admin/api.php?getQueryTypes&auth=123';
		fetchMock.get(url, { status: 200, body: piHoleErrorResponse });

		// run & validation
		await expect(piHoleTest()).rejects.toEqual(
			'Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(url, undefined);
		fetchMock.mockReset();
	});

	it('should reject promise, when init of pi hole leads to unexpected response', async () => {
		// init
		console.log = jest.fn();
		let url = 'http://1.1.1.1/admin/api.php?getQueryTypes&auth=123';
		fetchMock.get(url, { status: 200, body: piHoleInvalidResponse });

		// run & validation
		await expect(piHoleTest()).rejects.toEqual(
			'Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(url, undefined);
		fetchMock.mockReset();
	});

	it('should resolve promise, when init of pi hole is successful', async () => {
		// init
		console.log = jest.fn();
		let url = 'http://1.1.1.1/admin/api.php?getQueryTypes&auth=123';
		fetchMock.get(url, { status: 200, body: piHoleResponse });

		// run & validation
		await expect(piHoleTest()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(url, undefined);
		fetchMock.mockReset();
	});

	it('should reject promise, when init of lametric leads to error response', async () => {
		// init
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		let urlLamatricData = 'http://2.2.2.2:8080/api/v2/device';
		fetchMock
			.get(urlLametricLogin, {
				status: 200,
				body: lametricNotFoundErrorResponse,
			})
			.get(urlLamatricData, {
				status: 200,
				body: {},
			});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			'Lametric data not available Invalid! Make sure the supplied key is correct.',
		);
		expect(fetchMock).toBeCalledTimes(2);
		expect(fetchMock).toBeCalledWith(urlLametricLogin, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(urlLamatricData, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when connection to found lametric is unauthorized', async () => {
		// init
		let url =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		fetchMock.get(url, {
			status: 200,
			body: lametricUnauthorizedResponse,
		});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			'Connection to Lametric is unauthorized',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should resolve promise, when init of lametric is successful', async () => {
		// init
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		let urlLametricData = 'http://2.2.2.2:8080/api/v2/device';
		fetchMock
			.get(urlLametricLogin, {
				status: 200,
				body: laMetricDeviceInfo,
			})
			.get(urlLametricData, {
				status: 200,
				body: laMetricDeviceInfo2,
			});

		// run & validation
		await expect(laMetricTest()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(2);
		expect(fetchMock).toBeCalledWith(urlLametricLogin, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(urlLametricData, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of lametric on calling updateLaMetric leads to error response', async () => {
		// init
		let urlPiholeData = 'http://1.1.1.1/admin/api.php?summary&auth=123';
		let urlPiholeData2 = 'http://1.1.1.1/admin/api.php?topItems&auth=123';
		let urlPiholeData3 =
			'http://1.1.1.1/admin/api.php?recentBlocked&auth=123';
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		let urlLametricData = 'http://2.2.2.2:8080/api/v2/device';
		fetchMock
			.get(urlPiholeData, {
				status: 200,
				body: piHoleSummaryData,
			})
			.get(urlPiholeData2, {
				status: 200,
				body: piHoleTopItemsData,
			})
			.get(urlPiholeData3, {
				status: 200,
				body: piHoleRecentBlockedData,
			})
			.get(urlLametricLogin, {
				status: 200,
				body: lametricNotFoundErrorResponse,
			})
			.get(urlLametricData, {
				status: 200,
				body: {},
			});

		// run & validation
		await expect(updateLaMetric()).rejects.toEqual(
			'Lametric data not available Invalid! Make sure the supplied key is correct.',
		);
		expect(fetchMock).toBeCalledTimes(5);
		expect(fetchMock).toBeCalledWith(urlPiholeData, undefined);
		expect(fetchMock).toBeCalledWith(urlPiholeData2, undefined);
		expect(fetchMock).toBeCalledWith(urlPiholeData3, undefined);
		expect(fetchMock).toBeCalledWith(urlLametricLogin, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(urlLametricData, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	// it('should call catch callback function, when connection to found lametric is unauthorized on calling updateLaMetric', async () => {
	// 	// init
	// 	fetchMock.doMock();
	// 	fetchMock.mockResponses(
	// 		[JSON.stringify(piHoleSummaryData)],
	// 		[JSON.stringify(piHoleTopItemsData)],
	// 		[JSON.stringify(piHoleRecentBlockedData)],
	// 		[JSON.stringify(lametricUnauthorizedResponse)],
	// 	);
	// 	const callbackMock = jest.fn(() => {});
	// 	const flushPromises = () => new Promise(setImmediate);
	//
	// 	// run
	// 	updateLaMetric().catch(callbackMock);
	// 	await flushPromises();
	//
	// 	// validation
	// 	expect(callbackMock).toBeCalled();
	// 	fetchMock.dontMock();
	// });
	//
	// it('should call callback function, when update of lametric is successful', async () => {
	// 	// init
	// 	fetchMock.doMock();
	// 	fetchMock.mockResponses(
	// 		[JSON.stringify(piHoleSummaryData)],
	// 		[JSON.stringify(piHoleTopItemsData)],
	// 		[JSON.stringify(piHoleRecentBlockedData)],
	// 		[JSON.stringify(laMetricDeviceInfo)],
	// 		[JSON.stringify(laMetricDeviceInfo2)],
	// 		[JSON.stringify({})], // post request to lametric.iderp.io
	// 	);
	// 	const callbackMock = jest.fn(() => {});
	// 	const flushPromises = () => new Promise(setImmediate);
	//
	// 	// run
	// 	updateLaMetric().then(callbackMock);
	// 	await flushPromises();
	//
	// 	// validation
	// 	expect(callbackMock).toBeCalled();
	// 	fetchMock.dontMock();
	// });
	//
	// it('should work integrativly with mocks', async () => {
	// 	// init
	// 	fetchMock.doMock();
	// 	fetchMock.mockResponses(
	// 		[JSON.stringify(piHoleResponse)], // init pi hole
	// 		[JSON.stringify(laMetricDeviceInfo)], // init lametric
	// 		[JSON.stringify(laMetricDeviceInfo2)],
	// 		[JSON.stringify(piHoleSummaryData)], // update
	// 		[JSON.stringify(piHoleTopItemsData)],
	// 		[JSON.stringify(piHoleRecentBlockedData)],
	// 		[JSON.stringify(laMetricDeviceInfo)],
	// 		[JSON.stringify(laMetricDeviceInfo2)],
	// 		[JSON.stringify({})], // post request to lametric.iderp.io
	// 	);
	// 	const flushPromises = () => new Promise(setImmediate);
	// 	jest.spyOn(console, 'log').mockImplementation(); // ignore logging for unit test
	//
	// 	// run
	// 	main();
	// 	await flushPromises();
	//
	// 	// validation
	// 	fetchMock.dontMock();
	// 	jest.clearAllTimers();
	// });
	//
	// it('should run into an error integrativly', async () => {
	// 	// init
	// 	fetchMock.doMock();
	// 	fetchMock.mockReject(piHoleErrorResponse);
	// 	const spyConsole = jest.spyOn(console, 'log').mockImplementation();
	// 	const flushPromises = () => new Promise(setImmediate);
	//
	// 	// run
	// 	main();
	// 	await flushPromises();
	//
	// 	// validation
	// 	expect(spyConsole).toBeCalledWith(piHoleErrorResponse);
	// 	spyConsole.mockRestore();
	// 	fetchMock.dontMock();
	// });
	//
	xit("shouldn't log, when debug mode is disabled", () => {
		const spyConsole = jest.fn();
		console.log = spyConsole;
		mockDebugMode = false;

		// run
		logIfDebug('test msg');

		// validation
		expect(spyConsole).toHaveBeenCalledTimes(0);
	});

	it('should log, if debug mode is enabled', () => {
		// init
		const spyConsole = jest.fn();
		console.log = spyConsole;

		// run
		logIfDebug('test msg');

		// validation
		expect(spyConsole).toHaveBeenCalledTimes(1);
	});

	it('should map pi hole data', () => {
		// run
		let body = mapToBody(
			piHoleSummaryData,
			piHoleTopItemsData,
			piHoleRecentBlockedData,
		);

		// validation
		expect(body.blockListSize).toBe(
			piHoleSummaryData.domains_being_blocked,
		);
		expect(body.dnsQueriesToday).toBe(piHoleSummaryData.dns_queries_today);
		expect(body.adsBlockedToday).toBe(piHoleSummaryData.ads_blocked_today);
		expect(body.totalClientsSeen).toBe(piHoleSummaryData.clients_ever_seen);
		expect(body.totalDNSQueries).toBe(
			piHoleSummaryData.dns_queries_all_types,
		);
		expect(body.topQuery).toBe(
			'data.iot.us-east-1.amazonaws.com (3741 Queries)',
		);
		expect(body.topBlockedQuery).toBe(
			'web.vortex.data.microsoft.com (928 Queries)',
		);
		expect(body.lastBlockedQuery).toBe(piHoleRecentBlockedData);
	});

	it('should map key value pair', () => {
		// run & validation
		expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 0)).toBe(
			'data.iot.us-east-1.amazonaws.com (3741 Queries)',
		);
		expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 1)).toBe(
			'lametric.iderp.io (2854 Queries)',
		);
		expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 0)).toBe(
			'web.vortex.data.microsoft.com (928 Queries)',
		);
		expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 1)).toBe(
			'ichnaea.netflix.com (647 Queries)',
		);
	});
});
