// import mock data
const {
	piHoleError,
	piHoleInvalidData,
	piHoleLogin,
	piHoleSummaryData,
	piHoleTopItemsData,
	piHoleRecentBlockedData,
	lametricNotFoundError,
	lametricUnauthorized,
	laMetricDeviceInfo,
	laMetricDeviceInfo2,
	laMetricDeviceInfoCorrupt,
	urlLametricUpdate,
} = require('./index.mockdata');

// mock fetch
const fetchMock = require('node-fetch');
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

// mock config
jest.mock('./config.json', () => require('./index.mockdata').mockConfig);

// mock ora
const { spinner } = require('./index');
spinner.start = jest.fn();
spinner.succeed = jest.fn();
spinner.fail = jest.fn();

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
const fetchAndProcess = require('./index.js').__get__('fetchAndProcess');
const fetchWithAuth = require('./index.js').__get__('fetchWithAuth');
const { main } = require('./index');

describe('testing pi hole for lametric (with debug mode)', () => {
	beforeEach(() => {
		fetchMock.config.fallbackToNetwork = true;
		jest.useFakeTimers('legacy');
	});

	afterEach(() => {
		jest.clearAllTimers();
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

	it('should fetch url without authorization header and without payload', async () => {
		// init
		let url = 'www.bla.de';
		let mockResponse = { 1: '123' };
		fetchMock.get(url, { status: 200, body: mockResponse });
		let callbackFunction = jest.fn().mockImplementation(() => 'ok');

		// run & validation
		await expect(
			fetchAndProcess(url, null, null, callbackFunction),
		).resolves.toBeUndefined();
		expect(callbackFunction).toBeCalledTimes(1);
		expect(callbackFunction).toBeCalledWith(mockResponse);
		expect(spinner.succeed).toBeCalledTimes(1);
		expect(spinner.succeed).toBeCalledWith('ok');
		jest.resetAllMocks();
		fetchMock.mockReset();
	});

	it('should fetch url with authorization header and without payload', async () => {
		// init
		let url = 'www.bla.de';
		let mockResponse = { 1: '123' };
		let mockAuth = 'secureTest';
		fetchMock.get(
			url,
			{ status: 200, body: mockResponse },
			{
				headers: { Authorization: mockAuth },
			},
		);
		let callbackFunction = jest.fn().mockImplementation(() => 'ok');

		// run & validation
		await expect(
			fetchAndProcess(url, null, mockAuth, callbackFunction),
		).resolves.toBeUndefined();
		expect(callbackFunction).toBeCalledTimes(1);
		expect(callbackFunction).toBeCalledWith(mockResponse);
		expect(spinner.succeed).toBeCalledTimes(1);
		expect(spinner.succeed).toBeCalledWith('ok');
		jest.resetAllMocks();
		fetchMock.mockReset();
	});

	it('should fetch url without authorization header and with payload', async () => {
		// init
		let url = 'www.bla.de';
		let mockPayload = { bla: 'abc' };
		let mockResponse = { 1: '123' };
		fetchMock.post(
			{
				url,
				body: mockPayload,
			},
			{
				status: 200,
				body: mockResponse,
			},
		);
		let callbackFunction = jest.fn().mockImplementation(() => 'ok');

		// run & validation
		await expect(
			fetchAndProcess(
				url,
				JSON.stringify(mockPayload),
				null,
				callbackFunction,
			),
		).resolves.toBeUndefined();
		expect(callbackFunction).toBeCalledTimes(1);
		expect(callbackFunction).toBeCalledWith(mockResponse);
		expect(spinner.succeed).toBeCalledTimes(1);
		expect(spinner.succeed).toBeCalledWith('ok');
		jest.resetAllMocks();
		fetchMock.mockReset();
	});

	it('should fetch url with authorization header and with payload', async () => {
		// init
		let url = 'www.bla.de';
		let mockPayload = { bla: 'abc' };
		let mockResponse = { 1: '123' };
		let mockAuth = 'secureTest';
		fetchMock.post(
			{
				url,
				body: mockPayload,
			},
			{
				status: 200,
				body: mockResponse,
			},
			{
				headers: { Authorization: mockAuth },
			},
		);
		let callbackFunction = jest.fn().mockImplementation(() => 'ok');

		// run & validation
		await expect(
			fetchAndProcess(
				url,
				JSON.stringify(mockPayload),
				mockAuth,
				callbackFunction,
			),
		).resolves.toBeUndefined();
		expect(callbackFunction).toBeCalledTimes(1);
		expect(callbackFunction).toBeCalledWith(mockResponse);
		expect(spinner.succeed).toBeCalledTimes(1);
		expect(spinner.succeed).toBeCalledWith('ok');
		jest.resetAllMocks();
		fetchMock.mockReset();
	});

	it('should catch error on fetch of url', async () => {
		// init
		let url = 'www.bla.de';
		let error = new Error('test');
		fetchMock.get(url, {
			status: 500,
			throws: error,
		});
		let callbackFunction = jest.fn();

		// run & validation
		await expect(
			fetchAndProcess(url, null, null, callbackFunction),
		).rejects.toEqual(error.message);
		expect(spinner.fail).toBeCalledTimes(1);
		expect(spinner.fail).toBeCalledWith(error.message);
		expect(callbackFunction).toBeCalledTimes(0);
		expect(spinner.succeed).toBeCalledTimes(0);
		fetchMock.mockReset();
	});

	it('should fetch Json Placeholder', async () => {
		// init
		console.warn = jest.fn();
		let url = 'https://jsonplaceholder.typicode.com/todos/1';
		let callbackFunction = jest.fn();

		// run & validation
		await expect(
			fetchAndProcess(url, null, null, callbackFunction),
		).resolves.toBeUndefined();
		expect(callbackFunction).toBeCalledTimes(1);
		expect(callbackFunction).toBeCalledWith({
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
		fetchMock.get(piHoleError.url, { status: 200, body: piHoleError.body });

		// run & validation
		await expect(piHoleTest()).rejects.toEqual(
			'Pi-Hole Auth Invalid! Make sure the supplied key is correct.',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(piHoleError.url, {
			body: null,
			headers: {},
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of pi hole leads to unexpected response', async () => {
		// init
		console.log = jest.fn();
		fetchMock.get(piHoleInvalidData.url, {
			status: 200,
			body: piHoleInvalidData.body,
		});

		// run & validation
		await expect(piHoleTest()).rejects.toEqual(
			'Pi-Hole Auth Invalid! Make sure the supplied key is correct.',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(piHoleInvalidData.url, {
			body: null,
			headers: {},
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should resolve promise, when init of pi hole is successful', async () => {
		// init
		console.log = jest.fn();
		fetchMock.get(piHoleLogin.url, {
			status: 200,
			body: piHoleLogin.body,
		});

		// run & validation
		await expect(piHoleTest()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(piHoleLogin.url, {
			body: null,
			headers: {},
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of lametric leads to error response', async () => {
		// init
		fetchMock.get(lametricNotFoundError.url, {
			throws: lametricNotFoundError.body,
		});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			lametricNotFoundError.body,
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(lametricNotFoundError.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when connection to found lametric is unauthorized', async () => {
		// init
		fetchMock.get(lametricUnauthorized.url, {
			status: 200,
			body: lametricUnauthorized.body,
		});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			'Connection to Lametric is unauthorized',
		);
		expect(fetchMock).toBeCalledTimes(1);
		expect(fetchMock).toBeCalledWith(lametricUnauthorized.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of lametric is successful, but data is corrupt', async () => {
		// init
		fetchMock
			.get(laMetricDeviceInfo.url, {
				status: 200,
				body: laMetricDeviceInfo.body,
			})
			.get(laMetricDeviceInfo2.url, {
				status: 200,
				body: laMetricDeviceInfoCorrupt,
			});

		// run & validation
		await expect(laMetricTest()).rejects.toEqual(
			'Lametric data is corrupt!',
		);
		expect(fetchMock).toBeCalledTimes(2);
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo2.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should resolve promise, when init of lametric is successful', async () => {
		// init
		fetchMock
			.get(laMetricDeviceInfo.url, {
				status: 200,
				body: laMetricDeviceInfo.body,
			})
			.get(laMetricDeviceInfo2.url, {
				status: 200,
				body: laMetricDeviceInfo2.body,
			});

		// run & validation
		await expect(laMetricTest()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(2);
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo2.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when connection to found lametric is unauthorized on calling updateLaMetric', async () => {
		// init
		fetchMock
			.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			})
			.get(piHoleTopItemsData.url, {
				status: 200,
				body: piHoleTopItemsData.body,
			})
			.get(piHoleRecentBlockedData.url, {
				status: 200,
				body: piHoleRecentBlockedData.body,
			})
			.get(laMetricDeviceInfo.url, {
				status: 200,
				body: lametricUnauthorized.body,
			});

		// run & validation
		await expect(updateLaMetric()).rejects.toEqual(
			'Connection to Lametric is unauthorized',
		);
		expect(fetchMock).toBeCalledTimes(4);
		expect(fetchMock).toBeCalledWith(piHoleSummaryData.url, undefined);
		expect(fetchMock).toBeCalledWith(piHoleTopItemsData.url, undefined);
		expect(fetchMock).toBeCalledWith(
			piHoleRecentBlockedData.url,
			undefined,
		);
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should reject promise, when init of lametric on calling updateLaMetric leads to error response', async () => {
		// init
		fetchMock
			.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			})
			.get(piHoleTopItemsData.url, {
				status: 200,
				body: piHoleTopItemsData.body,
			})
			.get(piHoleRecentBlockedData.url, {
				status: 200,
				body: piHoleRecentBlockedData.body,
			})
			.get(lametricNotFoundError.url, {
				status: 200,
				body: lametricNotFoundError.body,
			})
			.get(laMetricDeviceInfo2.url, {
				status: 200,
				body: {},
			});

		// run & validation
		await expect(updateLaMetric()).rejects.toEqual(
			'Lametric data not available Invalid! Make sure the supplied key is correct.',
		);
		expect(fetchMock).toBeCalledTimes(5);
		expect(fetchMock).toBeCalledWith(piHoleSummaryData.url, undefined);
		expect(fetchMock).toBeCalledWith(piHoleTopItemsData.url, undefined);
		expect(fetchMock).toBeCalledWith(
			piHoleRecentBlockedData.url,
			undefined,
		);
		expect(fetchMock).toBeCalledWith(lametricNotFoundError.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo2.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should map pi hole data', () => {
		// run
		let body = mapToBody(
			piHoleSummaryData.body,
			piHoleTopItemsData.body,
			piHoleRecentBlockedData.body,
		);

		// validation
		expect(body.blockListSize).toBe(
			piHoleSummaryData.body.domains_being_blocked,
		);
		expect(body.dnsQueriesToday).toBe(
			piHoleSummaryData.body.dns_queries_today,
		);
		expect(body.adsBlockedToday).toBe(
			piHoleSummaryData.body.ads_blocked_today,
		);
		expect(body.totalClientsSeen).toBe(
			piHoleSummaryData.body.clients_ever_seen,
		);
		expect(body.totalDNSQueries).toBe(
			piHoleSummaryData.body.dns_queries_all_types,
		);
		expect(body.topQuery).toBe(
			'data.iot.us-east-1.amazonaws.com (3741 Queries)',
		);
		expect(body.topBlockedQuery).toBe(
			'web.vortex.data.microsoft.com (928 Queries)',
		);
		expect(body.lastBlockedQuery).toBe(piHoleRecentBlockedData.body);
	});

	it('should map key value pair', () => {
		// run & validation
		expect(
			mapKeyValuePairToString(piHoleTopItemsData.body.top_queries, 0),
		).toBe('data.iot.us-east-1.amazonaws.com (3741 Queries)');
		expect(
			mapKeyValuePairToString(piHoleTopItemsData.body.top_queries, 1),
		).toBe('lametric.iderp.io (2854 Queries)');
		expect(
			mapKeyValuePairToString(piHoleTopItemsData.body.top_ads, 0),
		).toBe('web.vortex.data.microsoft.com (928 Queries)');
		expect(
			mapKeyValuePairToString(piHoleTopItemsData.body.top_ads, 1),
		).toBe('ichnaea.netflix.com (647 Queries)');
	});

	it('should reject promise, when error occurs on update of lametric', async () => {
		// init
		fetchMock
			.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			})
			.get(piHoleTopItemsData.url, {
				status: 200,
				body: piHoleTopItemsData.body,
			})
			.get(piHoleRecentBlockedData.url, {
				status: 200,
				body: piHoleRecentBlockedData.body,
			})
			.get(laMetricDeviceInfo.url, {
				throws: 'error on init of lametric',
			});

		// run & validation
		await expect(updateLaMetric()).rejects.toEqual(
			'error on init of lametric',
		);
		expect(fetchMock).toBeCalledTimes(4);
		expect(fetchMock).toBeCalledWith(piHoleSummaryData.url, undefined);
		expect(fetchMock).toBeCalledWith(piHoleTopItemsData.url, undefined);
		expect(fetchMock).toBeCalledWith(
			piHoleRecentBlockedData.url,
			undefined,
		);
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		fetchMock.mockReset();
	});

	it('should resolve promise, when update of lametric is successful', async () => {
		// init
		fetchMock
			.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			})
			.get(piHoleTopItemsData.url, {
				status: 200,
				body: piHoleTopItemsData.body,
			})
			.get(piHoleRecentBlockedData.url, {
				status: 200,
				body: piHoleRecentBlockedData.body,
			})
			.get(lametricNotFoundError.url, {
				status: 200,
				body: lametricNotFoundError.body,
			})
			.get(laMetricDeviceInfo2.url, {
				status: 200,
				body: laMetricDeviceInfo2.body,
			})
			.post(urlLametricUpdate, {
				// post request to lametric.iderp.io
				status: 200,
				body: laMetricDeviceInfo2.body,
			});

		// run & validation
		await expect(updateLaMetric()).resolves.toBeUndefined();
		expect(fetchMock).toBeCalledTimes(6);
		expect(fetchMock).toBeCalledWith(piHoleSummaryData.url, undefined);
		expect(fetchMock).toBeCalledWith(piHoleTopItemsData.url, undefined);
		expect(fetchMock).toBeCalledWith(
			piHoleRecentBlockedData.url,
			undefined,
		);
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo.url, {
			headers: { Authorization: 'Basic ZGV2OjQ1Ng==' },
			method: 'GET',
		});
		expect(fetchMock).toBeCalledWith(laMetricDeviceInfo2.url, {
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
		fetchMock.get(piHoleError.url, {
			status: 200,
			body: piHoleError.body,
		});

		// run
		main();
		await new Promise(setImmediate);

		// validation
		expect(spyConsole).toBeCalledWith(
			'Pi-Hole Auth Invalid! Make sure the supplied key is correct.',
		);
		fetchMock.mockReset();
	});

	it('should work integrativly with mocks', async () => {
		// init
		console.log = jest.fn();

		fetchMock
			// init pi hole
			.get(piHoleLogin.url, { status: 200, body: piHoleLogin.body })
			// init lametric (reused for update)
			.get(laMetricDeviceInfo.url, {
				status: 200,
				body: laMetricDeviceInfo.body,
			})
			.get(laMetricDeviceInfo2.url, {
				status: 200,
				body: laMetricDeviceInfo2.body,
			})
			// collect data
			.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			})
			.get(piHoleTopItemsData.url, {
				status: 200,
				body: piHoleTopItemsData.body,
			})
			.get(piHoleRecentBlockedData.url, {
				status: 200,
				body: piHoleRecentBlockedData.body,
			})
			// post request to lametric.iderp.io
			.post(urlLametricUpdate, {
				status: 200,
				body: laMetricDeviceInfo2.body,
			});

		// run & validation
		main();
		await new Promise(setImmediate);

		// validation
		// piHoleLogin.url, laMetricDeviceInfo.url (2x), laMetricDeviceInfo2.url (2x), piHoleSummaryData.url, piHoleTopItemsData.url, piHoleRecentBlockedData.url, lametric.iderp.io
		expect(fetchMock).toBeCalledTimes(9);
		fetchMock.mockReset();
	});
});

describe('testing pi hole for lametric (without debug mode)', () => {
	const config = require(`./config.json`);

	it("shouldn't log, when debug mode is disabled", () => {
		// init
		const spyConsole = jest.fn();
		console.log = spyConsole;
		config.debugMode = false;

		// run
		logIfDebug('test msg');

		// validation
		expect(spyConsole).toHaveBeenCalledTimes(0);
	});
});
