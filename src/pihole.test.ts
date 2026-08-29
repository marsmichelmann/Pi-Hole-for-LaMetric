import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PiholeClient } from './pihole.js';
import {
	authInvalidPassword,
	authNoSession,
	authOkay,
	combinedStats,
	recentBlockedData,
	recentBlockedEmpty,
	summaryData,
	topBlockedData,
	topDomainsEmpty,
	unauthorizedError,
} from './mockdata.js';

interface Route {
	status?: number;
	body: unknown;
	raw?: boolean;
}

// A real local HTTP server standing in for Pi-hole: routes are matched by
// URL substring and can be swapped per test; every request is recorded.
let routes: [match: string, respond: () => Route][] = [];
let requests: { url: string; headers: Record<string, unknown> }[] = [];
let server: Server;
let piholeAddress: string;

const defaultRoutes = (
	overrides: Partial<Record<'auth' | 'summary', () => Route>> = {},
): [string, () => Route][] => [
	['/auth', overrides.auth ?? (() => ({ body: authOkay }))],
	['/stats/summary', overrides.summary ?? (() => ({ body: summaryData }))],
	['blocked=true', () => ({ body: topBlockedData })],
	['recent_blocked', () => ({ body: recentBlockedData })],
];

const client = () => new PiholeClient(piholeAddress, 'testpw');

describe('PiholeClient', () => {
	beforeEach(async () => {
		routes = defaultRoutes();
		requests = [];
		server = createServer((req, res) => {
			requests.push({ url: req.url ?? '', headers: req.headers });
			const route = routes.find(([match]) => req.url?.includes(match));
			if (!route) {
				res.writeHead(500).end('unmatched route');
				return;
			}
			const { status = 200, body, raw = false } = route[1]();
			res.writeHead(status, {
				'Content-Type': raw ? 'text/html' : 'application/json',
			});
			res.end(raw ? String(body) : JSON.stringify(body));
		});
		await new Promise<void>((resolve) => server.listen(0, resolve));
		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('expected a bound port');
		}
		piholeAddress = `127.0.0.1:${address.port}`;
	});

	afterEach(() => {
		server.close();
	});

	it('collects and combines the three stats calls', async () => {
		await expect(client().collectStats()).resolves.toEqual(combinedStats);
	});

	it('logs in once and reuses the session across collections', async () => {
		const c = client();

		await c.collectStats();
		await c.collectStats();

		const authCalls = requests.filter((r) => r.url.includes('/auth'));
		expect(authCalls).toHaveLength(1);
	});

	it('coalesces concurrent logins into a single request', async () => {
		const c = client();

		// no sid cached yet - both calls race to log in
		await Promise.all([c.collectStats(), c.collectStats()]);

		const authCalls = requests.filter((r) => r.url.includes('/auth'));
		expect(authCalls).toHaveLength(1);
	});

	it('sends the session ID as sid header', async () => {
		await client().collectStats();

		const summaryCall = requests.find((r) =>
			r.url.includes('/stats/summary'),
		);
		expect(summaryCall?.headers.sid).toBe(authOkay.session.sid);
	});

	it('rejects with the Pi-hole message on an incorrect password', async () => {
		routes = defaultRoutes({
			auth: () => ({ status: 400, body: authInvalidPassword }),
		});

		await expect(client().collectStats()).rejects.toThrow(
			'password incorrect',
		);
	});

	it('rejects with a generic message when the auth response has no session field', async () => {
		routes = defaultRoutes({ auth: () => ({ body: authNoSession }) });

		await expect(client().collectStats()).rejects.toThrow(
			'no session in response',
		);
	});

	it('rejects with the HTTP status when the auth response is not JSON', async () => {
		routes = defaultRoutes({
			auth: () => ({
				status: 502,
				body: '<html>not json</html>',
				raw: true,
			}),
		});

		// The message carries the status for the operator; the SyntaxError
		// behind it stays reachable via `cause`.
		await expect(client().collectStats()).rejects.toMatchObject({
			message: expect.stringContaining('HTTP 502'),
			cause: expect.any(SyntaxError),
		});
	});

	it('re-logs in and retries once when the session has expired', async () => {
		let summaryCalls = 0;
		routes = defaultRoutes({
			summary: () =>
				++summaryCalls === 1
					? { status: 401, body: unauthorizedError }
					: { body: summaryData },
		});

		await expect(client().collectStats()).resolves.toEqual(combinedStats);
		expect(summaryCalls).toBe(2);
	});

	it('rejects with status and body on any other HTTP error', async () => {
		routes = defaultRoutes({
			summary: () => ({ status: 500, body: { error: 'boom' } }),
		});

		await expect(client().collectStats()).rejects.toThrow('HTTP 500');
	});

	it('rejects with a timeout error when Pi-hole does not respond in time', async () => {
		routes = defaultRoutes();
		server.removeAllListeners('request');
		server.on('request', () => {
			// never respond - the client's timeout has to fire
		});
		const c = new PiholeClient(piholeAddress, 'testpw', 100);

		await expect(c.collectStats()).rejects.toThrow('timed out');
	});

	it('falls back to placeholder text when no domain data exists yet', async () => {
		routes = [
			['/auth', () => ({ body: authOkay })],
			['/stats/summary', () => ({ body: summaryData })],
			['blocked=true', () => ({ body: topDomainsEmpty })],
			['recent_blocked', () => ({ body: recentBlockedEmpty })],
		];

		const stats = await client().collectStats();

		expect(stats.topBlockedQuery).toBe('Noch nichts geblockt');
		expect(stats.lastBlockedQuery).toBe('Noch nichts geblockt');
	});
});
