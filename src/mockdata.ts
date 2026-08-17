import type { Frames, PiholeStats } from './types.js';

export const authOkay = {
	session: {
		valid: true,
		totp: false,
		sid: 'test-sid-123',
		csrf: 'test-csrf-123',
		validity: 300,
		message: 'correct password',
	},
	took: 0.003,
};

export const authInvalidPassword = {
	session: {
		valid: false,
		totp: false,
		sid: null,
		csrf: null,
		validity: -1,
		message: 'password incorrect',
	},
	took: 0.003,
};

// Malformed/unexpected auth response with no session field at all
export const authNoSession = {};

// 401 body from any authenticated endpoint other than POST /auth itself
export const unauthorizedError = {
	error: { key: 'unauthorized', message: 'Unauthorized', hint: null },
	took: 0.001,
};

export const summaryData = {
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
};

export const topBlockedData = {
	domains: [{ domain: 'web.vortex.data.microsoft.com', count: 928 }],
	total_queries: 47730,
	blocked_queries: 7558,
	took: 0.01,
};

export const topDomainsEmpty = {
	domains: [],
	total_queries: 0,
	blocked_queries: 0,
	took: 0.01,
};

export const recentBlockedData = {
	blocked: ['analytics.ff.avast.com'],
	took: 0.01,
};

export const recentBlockedEmpty = { blocked: [], took: 0.01 };

export const combinedStats: PiholeStats = {
	blockListSize: 1399949,
	dnsQueriesToday: 47730,
	adsBlockedToday: 7558,
	percentBlocked: 16,
	totalClientsSeen: 32,
	topBlockedQuery: 'web.vortex.data.microsoft.com (928 Queries)',
	lastBlockedQuery: 'analytics.ff.avast.com',
};

export const expectedFrames: Frames = {
	frames: [
		{ goalData: { start: 0, current: 16, end: 100, unit: '%' } },
		{ text: '7558' },
		{ text: '47730' },
		{ text: '1399949' },
		{ text: '32' },
		{ text: 'Top geblockt: web.vortex.data.microsoft.com (928 Queries)' },
		{ text: 'Zuletzt geblockt: analytics.ff.avast.com' },
	],
};
