import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PiholeClient } from './pihole.js';
import {
	authInvalidPassword,
	authOkay,
	combinedStats,
	recentBlockedData,
	recentBlockedEmpty,
	summaryData,
	topBlockedData,
	topDomainsEmpty,
	topQueriesData,
	unauthorizedError,
} from './mockdata.js';

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

// routes fetch calls by URL substring; unmatched URLs fail the test
const routeFetch = (
	routes: [match: string, respond: () => Response][],
): ReturnType<typeof vi.fn> =>
	vi.fn((input: string | URL | Request) => {
		const url = String(input);
		const route = routes.find(([match]) => url.includes(match));
		if (!route) {
			throw new Error(`unmatched fetch: ${url}`);
		}
		return Promise.resolve(route[1]());
	});

const statsRoutes = (): [string, () => Response][] => [
	['/auth', () => jsonResponse(authOkay)],
	['/stats/summary', () => jsonResponse(summaryData)],
	['blocked=false', () => jsonResponse(topQueriesData)],
	['blocked=true', () => jsonResponse(topBlockedData)],
	['recent_blocked', () => jsonResponse(recentBlockedData)],
];

describe('PiholeClient', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', routeFetch(statsRoutes()));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('collects and combines the four stats calls', async () => {
		const client = new PiholeClient('1.1.1.1', 'testpw');

		await expect(client.collectStats()).resolves.toEqual(combinedStats);
	});

	it('logs in once and reuses the session across collections', async () => {
		const client = new PiholeClient('1.1.1.1', 'testpw');

		await client.collectStats();
		await client.collectStats();

		const authCalls = vi
			.mocked(fetch)
			.mock.calls.filter(([url]) => String(url).includes('/auth'));
		expect(authCalls).toHaveLength(1);
	});

	it('sends the session ID as sid header', async () => {
		const client = new PiholeClient('1.1.1.1', 'testpw');

		await client.collectStats();

		const summaryCall = vi
			.mocked(fetch)
			.mock.calls.find(([url]) => String(url).includes('/stats/summary'));
		expect(summaryCall?.[1]?.headers).toEqual({
			sid: authOkay.session.sid,
		});
	});

	it('rejects with the Pi-hole message on an incorrect password', async () => {
		vi.stubGlobal(
			'fetch',
			routeFetch([
				['/auth', () => jsonResponse(authInvalidPassword, 400)],
			]),
		);
		const client = new PiholeClient('1.1.1.1', 'wrong');

		await expect(client.collectStats()).rejects.toThrow(
			'password incorrect',
		);
	});

	it('re-logs in and retries once when the session has expired', async () => {
		let summaryCalls = 0;
		vi.stubGlobal(
			'fetch',
			routeFetch([
				['/auth', () => jsonResponse(authOkay)],
				[
					'/stats/summary',
					() =>
						++summaryCalls === 1
							? jsonResponse(unauthorizedError, 401)
							: jsonResponse(summaryData),
				],
				['blocked=false', () => jsonResponse(topQueriesData)],
				['blocked=true', () => jsonResponse(topBlockedData)],
				['recent_blocked', () => jsonResponse(recentBlockedData)],
			]),
		);
		const client = new PiholeClient('1.1.1.1', 'testpw');

		await expect(client.collectStats()).resolves.toEqual(combinedStats);
		expect(summaryCalls).toBe(2);
	});

	it('rejects with status and body on any other HTTP error', async () => {
		vi.stubGlobal(
			'fetch',
			routeFetch([
				['/auth', () => jsonResponse(authOkay)],
				['/api', () => jsonResponse({ error: 'boom' }, 500)],
			]),
		);
		const client = new PiholeClient('1.1.1.1', 'testpw');

		await expect(client.collectStats()).rejects.toThrow('HTTP 500');
	});

	it('falls back to placeholder text when no domain data exists yet', async () => {
		vi.stubGlobal(
			'fetch',
			routeFetch([
				['/auth', () => jsonResponse(authOkay)],
				['/stats/summary', () => jsonResponse(summaryData)],
				['blocked=false', () => jsonResponse(topDomainsEmpty)],
				['blocked=true', () => jsonResponse(topDomainsEmpty)],
				['recent_blocked', () => jsonResponse(recentBlockedEmpty)],
			]),
		);
		const client = new PiholeClient('1.1.1.1', 'testpw');

		const stats = await client.collectStats();

		expect(stats.topQuery).toBe('Noch keine Anfragen');
		expect(stats.topBlockedQuery).toBe('Noch nichts geblockt');
		expect(stats.lastBlockedQuery).toBe('Noch nichts geblockt');
	});
});
