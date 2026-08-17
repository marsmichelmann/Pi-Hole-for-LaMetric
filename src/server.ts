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
export const createFrameProvider = (
	source: StatsSource,
	{ icons, ttlSeconds, onError }: FrameProviderOptions,
): FrameProvider => {
	let cached: { expiresAt: number; frames: Frames } | null = null;

	return async () => {
		if (cached && Date.now() < cached.expiresAt) {
			return cached.frames;
		}
		try {
			const frames = mapStatsToFrames(await source.collectStats(), icons);
			cached = {
				expiresAt: Date.now() + ttlSeconds * 1000,
				frames,
			};
			return frames;
		} catch (err) {
			onError?.(err);
			if (cached) {
				return cached.frames;
			}
			throw err;
		}
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
	server.listen(port, () => {
		console.log(`Pi-Hole for LaMetric listening on port ${port}...`);
	});
	return server;
};
