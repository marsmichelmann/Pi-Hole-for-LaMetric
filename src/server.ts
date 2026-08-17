import { createServer, type Server } from 'node:http';

import { mapStatsToFrames } from './frames.js';
import type {
	Frames,
	FrameProviderOptions,
	HttpRequest,
	HttpResponse,
	StatsSource,
} from './types.js';

const ERROR_FRAMES: Frames = {
	frames: [{ text: 'Pi-hole nicht erreichbar' }],
};

export type FrameProvider = () => Promise<Frames>;

// Caches the last frames for ttlSeconds so frequent polls don't hammer
// Pi-hole, and keeps serving the last known-good frames if a refresh fails -
// the poll endpoint should stay up even when Pi-hole is briefly unreachable.
// Concurrent calls while a refresh is in flight (e.g. the cache having just
// expired, or a sustained Pi-hole outage keeping it perpetually expired)
// share that single refresh instead of each triggering their own.
export const createFrameProvider = (
	source: StatsSource,
	{ icons, ttlSeconds, onError }: FrameProviderOptions,
): FrameProvider => {
	let cached: { expiresAt: number; frames: Frames } | null = null;
	let refreshing: Promise<Frames> | null = null;

	const refresh = async (): Promise<Frames> => {
		try {
			const frames = mapStatsToFrames(await source.collectStats(), icons);
			cached = { expiresAt: Date.now() + ttlSeconds * 1000, frames };
			return frames;
		} catch (err) {
			onError?.(err);
			if (cached) {
				return cached.frames;
			}
			throw err;
		} finally {
			refreshing = null;
		}
	};

	return () => {
		if (cached && Date.now() < cached.expiresAt) {
			return Promise.resolve(cached.frames);
		}
		refreshing ??= refresh();
		return refreshing;
	};
};

export const handleRequest = async (
	req: HttpRequest,
	res: HttpResponse,
	getFrames: FrameProvider,
): Promise<void> => {
	if (req.method !== 'GET' || req.url?.split('?')[0] !== '/lametric') {
		res.writeHead(404).end();
		return;
	}

	try {
		const frames = await getFrames();
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(frames));
	} catch {
		res.writeHead(502, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(ERROR_FRAMES));
	}
};

export const startServer = (port: number, getFrames: FrameProvider): Server => {
	const server = createServer((req, res) => {
		void handleRequest(req, res, getFrames);
	});
	server.on('error', (err) => {
		// e.g. EADDRINUSE on a fast systemd restart before the old process
		// released the port - fail loudly instead of an unhandled crash, and
		// let systemd's Restart= policy bring it back up.
		console.error(`Pi-Hole for LaMetric server error: ${err.message}`);
		process.exit(1);
	});
	server.listen(port, () => {
		console.log(`Pi-Hole for LaMetric listening on port ${port}...`);
	});
	return server;
};
