// import mock data
const {
	mockConfig,
	authOkay,
	authInvalidPassword,
	unauthorizedError,
	piHoleSummaryData,
	piHoleTopQueriesData,
	piHoleTopBlockedData,
	piHoleTopQueriesEmpty,
	piHoleRecentBlockedData,
	piHoleRecentBlockedEmpty,
	mockPiHoleCombinedStats,
	mockLametricFrames,
} = require('./index.mockdata');

// mock fetch
const fetchMock = require('node-fetch');
jest.mock('node-fetch', () => require('fetch-mock-jest').sandbox());

// mock config
jest.mock('./config.json', () => require('./index.mockdata').mockConfig);

const index = require('./index.js');
const { login, collectPiholeStats, mapStatsToFrames, getFrames, startServer } =
	index;

// import private functions/state to test via babel-plugin-rewire
const authenticatedGet = index.__get__('authenticatedGet');
const handleRequest = index.__get__('handleRequest');
const logIfDebug = index.__get__('logIfDebug');

// mocks a fully successful round of Pi-hole stats calls (summary, both top
// domain queries, recent blocked) - shared by several higher-level tests.
const mockAllStatsEndpoints = () => {
	fetchMock
		.get(piHoleSummaryData.url, {
			status: 200,
			body: piHoleSummaryData.body,
		})
		.get(piHoleTopQueriesData.url, {
			status: 200,
			body: piHoleTopQueriesData.body,
		})
		.get(piHoleTopBlockedData.url, {
			status: 200,
			body: piHoleTopBlockedData.body,
		})
		.get(piHoleRecentBlockedData.url, {
			status: 200,
			body: piHoleRecentBlockedData.body,
		});
};

// mocks all four Pi-hole stats calls failing - used to test the "Pi-hole
// unreachable" paths without leaving unmatched-request warnings for the
// endpoints Promise.all still calls alongside the one under test.
const mockAllStatsEndpointsFailing = () => {
	fetchMock
		.get(piHoleSummaryData.url, { status: 500, body: {} })
		.get(piHoleTopQueriesData.url, { status: 500, body: {} })
		.get(piHoleTopBlockedData.url, { status: 500, body: {} })
		.get(piHoleRecentBlockedData.url, { status: 500, body: {} });
};

describe('pi-hole for lametric', () => {
	beforeEach(() => {
		index.__set__('cachedSid', null);
		index.__set__('cache', { expiresAt: 0, frames: null });
		mockConfig.Icons = {};
		fetchMock.post(authOkay.url, { status: 200, body: authOkay.body });
	});

	afterEach(() => {
		fetchMock.mockReset();
	});

	describe('logIfDebug', () => {
		it('logs when debug mode is enabled', () => {
			// init
			const spyConsole = jest.fn();
			console.log = spyConsole;

			// run
			logIfDebug('test msg');

			// validation
			expect(spyConsole).toHaveBeenCalledTimes(1);
		});

		it("doesn't log when debug mode is disabled", () => {
			// init
			const spyConsole = jest.fn();
			console.log = spyConsole;
			mockConfig.debugMode = false;

			// run
			logIfDebug('test msg');

			// validation
			expect(spyConsole).toHaveBeenCalledTimes(0);
			mockConfig.debugMode = true;
		});
	});

	describe('login', () => {
		it('resolves the session ID on a correct password', async () => {
			// run & validation
			await expect(login()).resolves.toEqual(authOkay.body.session.sid);
		});

		it('rejects with the Pi-hole message on an incorrect password', async () => {
			// init
			fetchMock.post(
				authOkay.url,
				{ status: 400, body: authInvalidPassword.body },
				{ overwriteRoutes: true },
			);

			// run & validation
			await expect(login()).rejects.toThrow('password incorrect');
		});
	});

	describe('authenticatedGet', () => {
		it('logs in first if no session is cached yet, then requests with the sid header', async () => {
			// init
			fetchMock.get(piHoleSummaryData.url, {
				status: 200,
				body: piHoleSummaryData.body,
			});

			// run & validation
			await expect(authenticatedGet('/stats/summary')).resolves.toEqual(
				piHoleSummaryData.body,
			);
			expect(fetchMock).toHaveLastFetched(piHoleSummaryData.url, {
				headers: { sid: authOkay.body.session.sid },
			});
		});

		it('re-logs in and retries once when the cached session has expired', async () => {
			// init
			index.__set__('cachedSid', 'stale-sid');
			fetchMock
				.getOnce(
					piHoleSummaryData.url,
					{ status: 401, body: unauthorizedError.body },
					{ name: 'expired-session' },
				)
				.getOnce(
					piHoleSummaryData.url,
					{ status: 200, body: piHoleSummaryData.body },
					{ name: 'retry-after-relogin' },
				);

			// run & validation
			await expect(authenticatedGet('/stats/summary')).resolves.toEqual(
				piHoleSummaryData.body,
			);
			expect(fetchMock).toHaveFetchedTimes(2, piHoleSummaryData.url);
		});

		it('rejects with the HTTP status and body on any other error', async () => {
			// init
			fetchMock.get(piHoleSummaryData.url, {
				status: 500,
				body: { error: 'internal server error' },
			});

			// run & validation
			await expect(authenticatedGet('/stats/summary')).rejects.toThrow(
				'HTTP 500',
			);
		});
	});

	describe('collectPiholeStats', () => {
		it('collects and combines the four Pi-hole stats calls', async () => {
			// init
			mockAllStatsEndpoints();

			// run & validation
			await expect(collectPiholeStats()).resolves.toEqual(
				mockPiHoleCombinedStats,
			);
		});

		it('falls back to placeholder text when no domain data exists yet', async () => {
			// init
			fetchMock
				.get(piHoleSummaryData.url, {
					status: 200,
					body: piHoleSummaryData.body,
				})
				.get(piHoleTopQueriesEmpty.url, {
					status: 200,
					body: piHoleTopQueriesEmpty.body,
				})
				.get(piHoleTopBlockedData.url, {
					status: 200,
					body: piHoleTopQueriesEmpty.body,
				})
				.get(piHoleRecentBlockedEmpty.url, {
					status: 200,
					body: piHoleRecentBlockedEmpty.body,
				});

			// run & validation
			const stats = await collectPiholeStats();
			expect(stats.topQuery).toBe('Noch keine Anfragen');
			expect(stats.topBlockedQuery).toBe('Noch nichts geblockt');
			expect(stats.lastBlockedQuery).toBe('Noch nichts geblockt');
		});
	});

	describe('mapStatsToFrames', () => {
		it('maps combined stats to LaMetric frames', () => {
			// run & validation
			expect(mapStatsToFrames(mockPiHoleCombinedStats)).toEqual(
				mockLametricFrames,
			);
		});

		it('includes an icon for a frame when one is configured', () => {
			// init
			mockConfig.Icons = { adsBlockedToday: '1957' };

			// run & validation
			const frames = mapStatsToFrames(mockPiHoleCombinedStats);
			expect(frames.frames[1]).toEqual({
				text: '7558',
				icon: '1957',
			});
		});

		it('includes an icon on the goalData frame when configured', () => {
			// init
			mockConfig.Icons = { percentBlocked: '1957' };

			// run & validation
			const frames = mapStatsToFrames(mockPiHoleCombinedStats);
			expect(frames.frames[0]).toEqual({
				goalData: { start: 0, current: 16, end: 100, unit: '%' },
				icon: '1957',
			});
		});
	});

	describe('getFrames', () => {
		it('fetches fresh frames when nothing is cached yet', async () => {
			// init
			mockAllStatsEndpoints();

			// run & validation
			await expect(getFrames()).resolves.toEqual(mockLametricFrames);
		});

		it('serves the cached frames without re-fetching within updateInterval', async () => {
			// init
			mockAllStatsEndpoints();
			await getFrames();
			fetchMock.mockClear();

			// run & validation
			await expect(getFrames()).resolves.toEqual(mockLametricFrames);
			expect(fetchMock).toHaveFetchedTimes(0);
		});

		it('serves stale cached frames when a refresh fails', async () => {
			// init
			index.__set__('cache', {
				expiresAt: 0, // already expired -> forces a refresh attempt
				frames: mockLametricFrames,
			});
			mockAllStatsEndpointsFailing();

			// run & validation
			await expect(getFrames()).resolves.toEqual(mockLametricFrames);
		});

		it('rejects when a refresh fails and nothing is cached yet', async () => {
			// init
			mockAllStatsEndpointsFailing();

			// run & validation
			await expect(getFrames()).rejects.toThrow();
		});
	});

	describe('handleRequest', () => {
		const fakeResponse = () => ({
			writeHead: jest.fn().mockReturnThis(),
			end: jest.fn(),
		});

		it('serves the frames JSON on GET /lametric', async () => {
			// init
			mockAllStatsEndpoints();
			const res = fakeResponse();

			// run
			handleRequest({ method: 'GET', url: '/lametric' }, res);
			await new Promise(setImmediate);

			// validation
			expect(res.writeHead).toHaveBeenCalledWith(200, {
				'Content-Type': 'application/json',
			});
			expect(res.end).toHaveBeenCalledWith(
				JSON.stringify(mockLametricFrames),
			);
		});

		it('returns 404 for any other path', () => {
			// init
			const res = fakeResponse();

			// run
			handleRequest({ method: 'GET', url: '/anything-else' }, res);

			// validation
			expect(res.writeHead).toHaveBeenCalledWith(404);
			expect(res.end).toHaveBeenCalledTimes(1);
		});

		it('returns 502 with an error frame when Pi-hole is unreachable', async () => {
			// init
			mockAllStatsEndpointsFailing();
			const res = fakeResponse();

			// run
			handleRequest({ method: 'GET', url: '/lametric' }, res);
			await new Promise(setImmediate);

			// validation
			expect(res.writeHead).toHaveBeenCalledWith(502, {
				'Content-Type': 'application/json',
			});
		});
	});

	describe('startServer', () => {
		it('starts an HTTP server listening on the configured port', () => {
			// run
			const server = startServer();

			// validation
			expect(server.listening).toBe(true);
			expect(server.address().port).toBe(mockConfig.Server.Port);
			server.close();
		});
	});
});
