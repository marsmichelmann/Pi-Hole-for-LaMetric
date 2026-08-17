import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFrameProvider, handleRequest, startServer } from './server.js';
import type { HttpRequest, StatsSource } from './types.js';
import { combinedStats, expectedFrames } from './mockdata.js';

const fakeSource = (
	collectStats: StatsSource['collectStats'],
): StatsSource => ({ collectStats });

const fakeResponse = () => {
	const res = {
		writeHead: vi.fn(),
		end: vi.fn(),
	};
	res.writeHead.mockReturnValue(res);
	return res;
};

const request = (method: string, url: string): HttpRequest => ({
	method,
	url,
});

describe('createFrameProvider', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('fetches fresh frames when nothing is cached yet', async () => {
		const provider = createFrameProvider(
			fakeSource(() => Promise.resolve(combinedStats)),
			{ icons: {}, ttlSeconds: 60 },
		);

		await expect(provider()).resolves.toEqual(expectedFrames);
	});

	it('serves cached frames without re-fetching within the TTL', async () => {
		const collectStats = vi.fn(() => Promise.resolve(combinedStats));
		const provider = createFrameProvider(fakeSource(collectStats), {
			icons: {},
			ttlSeconds: 60,
		});

		await provider();
		await provider();

		expect(collectStats).toHaveBeenCalledTimes(1);
	});

	it('re-fetches after the TTL has expired', async () => {
		const collectStats = vi.fn(() => Promise.resolve(combinedStats));
		const provider = createFrameProvider(fakeSource(collectStats), {
			icons: {},
			ttlSeconds: 60,
		});

		await provider();
		vi.advanceTimersByTime(61_000);
		await provider();

		expect(collectStats).toHaveBeenCalledTimes(2);
	});

	it('coalesces concurrent refreshes into a single collectStats call', async () => {
		let resolveStats: (stats: typeof combinedStats) => void = () => {
			throw new Error('resolveStats called before being assigned');
		};
		const statsPromise = new Promise<typeof combinedStats>((resolve) => {
			resolveStats = resolve;
		});
		const collectStats = vi.fn(() => statsPromise);
		const provider = createFrameProvider(fakeSource(collectStats), {
			icons: {},
			ttlSeconds: 60,
		});

		const first = provider();
		const second = provider();
		resolveStats(combinedStats);

		await expect(first).resolves.toEqual(expectedFrames);
		await expect(second).resolves.toEqual(expectedFrames);
		expect(collectStats).toHaveBeenCalledTimes(1);
	});

	it('serves stale frames and reports the error when a refresh fails', async () => {
		const collectStats = vi.fn(() => Promise.resolve(combinedStats));
		const onError = vi.fn();
		const provider = createFrameProvider(fakeSource(collectStats), {
			icons: {},
			ttlSeconds: 60,
			onError,
		});

		await provider();
		vi.advanceTimersByTime(61_000);
		collectStats.mockImplementationOnce(() =>
			Promise.reject(new Error('down')),
		);

		await expect(provider()).resolves.toEqual(expectedFrames);
		expect(onError).toHaveBeenCalledOnce();
	});

	it('rejects when a refresh fails and nothing is cached yet', async () => {
		const provider = createFrameProvider(
			fakeSource(() => Promise.reject(new Error('down'))),
			{ icons: {}, ttlSeconds: 60 },
		);

		await expect(provider()).rejects.toThrow('down');
	});
});

describe('handleRequest', () => {
	const provider = () => Promise.resolve(expectedFrames);

	it('serves the frames JSON on GET /lametric', async () => {
		const res = fakeResponse();

		await handleRequest(request('GET', '/lametric'), res, provider);

		expect(res.writeHead).toHaveBeenCalledWith(200, {
			'Content-Type': 'application/json',
		});
		expect(res.end).toHaveBeenCalledWith(JSON.stringify(expectedFrames));
	});

	it('ignores query parameters on the poll path', async () => {
		const res = fakeResponse();

		await handleRequest(request('GET', '/lametric?x=1'), res, provider);

		expect(res.writeHead).toHaveBeenCalledWith(200, {
			'Content-Type': 'application/json',
		});
	});

	it('returns 404 for any other path', async () => {
		const res = fakeResponse();

		await handleRequest(request('GET', '/other'), res, provider);

		expect(res.writeHead).toHaveBeenCalledWith(404);
	});

	it('returns 404 for non-GET methods', async () => {
		const res = fakeResponse();

		await handleRequest(request('POST', '/lametric'), res, provider);

		expect(res.writeHead).toHaveBeenCalledWith(404);
	});

	it('returns 502 with an error frame when the provider fails', async () => {
		const res = fakeResponse();

		await handleRequest(request('GET', '/lametric'), res, () =>
			Promise.reject(new Error('down')),
		);

		expect(res.writeHead).toHaveBeenCalledWith(502, {
			'Content-Type': 'application/json',
		});
		expect(res.end).toHaveBeenCalledWith(
			JSON.stringify({ frames: [{ text: 'Pi-hole nicht erreichbar' }] }),
		);
	});
});

describe('startServer', () => {
	it('starts an HTTP server that serves the poll endpoint', async () => {
		const server = startServer(0, () => Promise.resolve(expectedFrames));
		await new Promise((resolve) => server.once('listening', resolve));
		const address = server.address();
		if (address === null || typeof address === 'string') {
			throw new Error('expected a bound port');
		}

		const res = await fetch(`http://127.0.0.1:${address.port}/lametric`);

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual(expectedFrames);
		server.close();
	});

	it('logs and exits on a server error instead of crashing unhandled', async () => {
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementation(() => undefined as never);
		const errorSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		const server = startServer(0, () => Promise.resolve(expectedFrames));
		await new Promise((resolve) => server.once('listening', resolve));

		server.emit('error', new Error('EADDRINUSE'));

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('EADDRINUSE'),
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
		exitSpy.mockRestore();
		errorSpy.mockRestore();
		server.close();
	});
});
