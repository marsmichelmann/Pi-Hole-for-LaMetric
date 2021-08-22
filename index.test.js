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

// mock fetch
const fetchMock = require('node-fetch');
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

// mock config
const config = require(`./config.json`);
jest.mock('./config.json', () => require('./index.mockdata').mockConfig);

// import private functions to test
const logIfDebug = require('./index.js').__get__('logIfDebug');
const piHoleTest = require('./index.js').__get__('piHoleTest');
const mapToBody = require('./index.js').__get__('mapToBody');
const mapKeyValuePairToString = require('./index.js').__get__(
	'mapKeyValuePairToString',
);
const startUpdateTimer = require('./index.js').__get__('startUpdateTimer');
const laMetricTest = require('./index.js').__get__('laMetricTest');
const updateLaMetric = require('./index.js').__get__('updateLaMetric');
const fetchWithAuth = require('./index.js').__get__('fetchWithAuth');
const { main } = require('./index');

describe('testing pi hole for lametric', () => {
	beforeEach(() => {
		fetchMock.config.fallbackToNetwork = true;
		jest.useFakeTimers('legacy');
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	it("shouldn't log, when debug mode is disabled", () => {
		const spyConsole = jest.fn();
		config.debugMode = false;
		console.log = spyConsole;

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
		fetchMock.get(urlLametricLogin, {
			throws: lametricNotFoundErrorResponse,
		});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			lametricNotFoundErrorResponse,
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(urlLametricLogin, {
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

	it('should reject promise, when connection to found lametric is unauthorized on calling updateLaMetric', async () => {
		// init
		let urlPiholeData = 'http://1.1.1.1/admin/api.php?summary&auth=123';
		let urlPiholeData2 = 'http://1.1.1.1/admin/api.php?topItems&auth=123';
		let urlPiholeData3 =
			'http://1.1.1.1/admin/api.php?recentBlocked&auth=123';
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
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
				body: lametricUnauthorizedResponse,
			});

		// run & validation
		await expect(updateLaMetric()).rejects.toEqual(
			'Connection to Lametric is unauthorized',
		);
		expect(fetchMock).toBeCalledTimes(4);
		expect(fetchMock).toBeCalledWith(urlPiholeData, undefined);
		expect(fetchMock).toBeCalledWith(urlPiholeData2, undefined);
		expect(fetchMock).toBeCalledWith(urlPiholeData3, undefined);
		expect(fetchMock).toBeCalledWith(urlLametricLogin, {
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

	it('should resolve promise, when update of lametric is successful', async () => {
		// init
		let urlPiholeData = 'http://1.1.1.1/admin/api.php?summary&auth=123';
		let urlPiholeData2 = 'http://1.1.1.1/admin/api.php?topItems&auth=123';
		let urlPiholeData3 =
			'http://1.1.1.1/admin/api.php?recentBlocked&auth=123';
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		let urlLametricData = 'http://2.2.2.2:8080/api/v2/device';
		let urlLametricUpdate = 'https://lametric.glitch.me/pihole/13233';
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
				body: laMetricDeviceInfo2,
			})
			.post(urlLametricUpdate, {
				// post request to lametric.iderp.io
				status: 200,
				body: laMetricDeviceInfo2,
			});

		// run & validation
		await expect(updateLaMetric()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(6);
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
		let body = {
			blockListSize: '1,399,949',
			dnsQueriesToday: '47,730',
			adsBlockedToday: '7,558',
			totalClientsSeen: '32',
			totalDNSQueries: '47,730',
			topQuery: 'data.iot.us-east-1.amazonaws.com (3741 Queries)',
			topBlockedQuery: 'web.vortex.data.microsoft.com (928 Queries)',
			lastBlockedQuery: 'analytics.ff.avast.com',
		};
		expect(fetchMock).toBeCalledWith(urlLametricUpdate, {
			method: 'POST',
			body: body,
		});
		fetchMock.mockReset();
	});

	it('should run into an error integrativly', async () => {
		// init
		const spyConsole = jest.spyOn(console, 'log').mockImplementation();
		let urlPiholeLogin =
			'http://1.1.1.1/admin/api.php?getQueryTypes&auth=123';
		fetchMock.get(urlPiholeLogin, {
			status: 200,
			body: piHoleErrorResponse,
		});

		// run
		main();
		await new Promise(setImmediate);

		// validation
		expect(spyConsole).toBeCalledWith(
			'Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.',
		);
		fetchMock.mockReset();
	});

	it('should work integrativly with mocks', async () => {
		// init
		console.log = jest.fn();
		let urlPiholeLogin =
			'http://1.1.1.1/admin/api.php?getQueryTypes&auth=123';
		let urlLametricLogin =
			'http://2.2.2.2:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d';
		let urlLametricData = 'http://2.2.2.2:8080/api/v2/device';
		fetchMock;
		let urlPiholeData = 'http://1.1.1.1/admin/api.php?summary&auth=123';
		let urlPiholeData2 = 'http://1.1.1.1/admin/api.php?topItems&auth=123';
		let urlPiholeData3 =
			'http://1.1.1.1/admin/api.php?recentBlocked&auth=123';
		let urlLametricUpdate = 'https://lametric.glitch.me/pihole/13233';

		fetchMock
			// init pi hole
			.get(urlPiholeLogin, { status: 200, body: piHoleResponse })
			// init lametric (reused for update)
			.get(urlLametricLogin, {
				status: 200,
				body: laMetricDeviceInfo,
			})
			.get(urlLametricData, {
				status: 200,
				body: laMetricDeviceInfo2,
			})
			// collect data
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
			// post request to lametric.iderp.io
			.post(urlLametricUpdate, {
				status: 200,
				body: laMetricDeviceInfo2,
			});

		// run & validation
		main();
		await new Promise(setImmediate);

		// validation
		// urlPiholeLogin, urlLametricLogin (2x), urlLametricData (2x), urlPiholeData, urlPiholeData2, urlPiholeData3, lametric.iderp.io
		expect(fetchMock).toBeCalledTimes(9);
		fetchMock.mockReset();
	});
});
