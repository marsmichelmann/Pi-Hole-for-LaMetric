const mockConfig = {
	debugMode: true,
	PiHole: { IP: '1.1.1.1', Password: 'testpw' },
	Server: { Port: 3031 },
	Icons: {},
	updateInterval: 60,
};

const authOkay = {
	url: 'http://1.1.1.1/api/auth',
	body: {
		session: {
			valid: true,
			totp: false,
			sid: 'test-sid-123',
			csrf: 'test-csrf-123',
			validity: 300,
			message: 'correct password',
		},
		took: 0.003,
	},
};

const authInvalidPassword = {
	url: 'http://1.1.1.1/api/auth',
	body: {
		session: {
			valid: false,
			totp: false,
			sid: null,
			csrf: null,
			validity: -1,
			message: 'password incorrect',
		},
		took: 0.003,
	},
};

// shape of a 401 response from any authenticated endpoint OTHER than
// POST /api/auth itself (which has its own body shape, see authInvalidPassword)
const unauthorizedError = {
	body: {
		error: { key: 'unauthorized', message: 'Unauthorized', hint: null },
		took: 0.001,
	},
};

const piHoleSummaryData = {
	url: 'http://1.1.1.1/api/stats/summary',
	body: {
		queries: {
			total: 47730,
			blocked: 7558,
			percent_blocked: 15.8,
			unique_domains: 2720,
			forwarded: 22557,
			cached: 16896,
		},
		clients: { active: 30, total: 32 },
		gravity: { domains_being_blocked: 1399949, last_update: 1609640984 },
		took: 0.01,
	},
};

const piHoleTopQueriesData = {
	url: 'http://1.1.1.1/api/stats/top_domains?blocked=false&count=1',
	body: {
		domains: [{ domain: 'data.iot.us-east-1.amazonaws.com', count: 3741 }],
		total_queries: 47730,
		blocked_queries: 7558,
		took: 0.01,
	},
};

const piHoleTopBlockedData = {
	url: 'http://1.1.1.1/api/stats/top_domains?blocked=true&count=1',
	body: {
		domains: [{ domain: 'web.vortex.data.microsoft.com', count: 928 }],
		total_queries: 47730,
		blocked_queries: 7558,
		took: 0.01,
	},
};

const piHoleTopQueriesEmpty = {
	url: 'http://1.1.1.1/api/stats/top_domains?blocked=false&count=1',
	body: { domains: [], total_queries: 0, blocked_queries: 0, took: 0.01 },
};

const piHoleRecentBlockedData = {
	url: 'http://1.1.1.1/api/stats/recent_blocked?count=1',
	body: { blocked: ['analytics.ff.avast.com'], took: 0.01 },
};

const piHoleRecentBlockedEmpty = {
	url: 'http://1.1.1.1/api/stats/recent_blocked?count=1',
	body: { blocked: [], took: 0.01 },
};

const mockPiHoleCombinedStats = {
	blockListSize: 1399949,
	dnsQueriesToday: 47730,
	adsBlockedToday: 7558,
	percentBlocked: 16,
	totalClientsSeen: 32,
	topQuery: 'data.iot.us-east-1.amazonaws.com (3741 Queries)',
	topBlockedQuery: 'web.vortex.data.microsoft.com (928 Queries)',
	lastBlockedQuery: 'analytics.ff.avast.com',
};

const mockLametricFrames = {
	frames: [
		{ goalData: { start: 0, current: 16, end: 100, unit: '%' } },
		{ text: '7558 geblockt heute' },
		{ text: '47730 Anfragen heute' },
		{ text: '1399949 Domains auf der Blockliste' },
		{ text: '32 Clients' },
		{ text: 'Top geblockt: web.vortex.data.microsoft.com (928 Queries)' },
		{ text: 'Zuletzt geblockt: analytics.ff.avast.com' },
	],
};

module.exports = {
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
};
