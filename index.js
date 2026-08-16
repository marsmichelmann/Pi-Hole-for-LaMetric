const http = require('http');
const config = require('./config.json');
const fetch = require('node-fetch');

/**
 * Logs the given msg if debug mode is enabled.
 * @param msg the message to log.
 */
const logIfDebug = (msg) => {
	if (config.debugMode) {
		console.log(msg);
	}
};

// Session ID (SID) for the Pi-hole v6 REST API. Cached at module scope and
// refreshed transparently whenever a request comes back 401 (see
// authenticatedGet) - Pi-hole sessions expire after a period of inactivity.
let cachedSid = null;

// Last successfully fetched LaMetric frames, served (a) while still within
// config.updateInterval, and (b) as a stale-but-better-than-nothing fallback
// if a refresh fails - the poll endpoint should stay up even if Pi-hole is
// briefly unreachable.
let cache = { expiresAt: 0, frames: null };

/**
 * Logs in to the Pi-hole v6 API with the configured password and caches the
 * resulting session ID for subsequent requests.
 * @returns {Promise<string>} the session ID.
 */
const login = () => {
	return fetch(`http://${config.PiHole.IP}/api/auth`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ password: config.PiHole.Password }),
	})
		.then((res) => res.json())
		.then((body) => {
			if (!body.session || !body.session.valid) {
				const reason = body.session
					? body.session.message
					: 'no session in response';
				throw new Error(`Pi-Hole login failed: ${reason}`);
			}
			cachedSid = body.session.sid;
			return cachedSid;
		});
};

/**
 * Resolves to the cached session ID, logging in first if none exists yet.
 * @returns {Promise<string>} the session ID.
 */
const ensureLoggedIn = () => (cachedSid ? Promise.resolve(cachedSid) : login());

/**
 * GETs the given Pi-hole v6 API path (e.g. "/stats/summary"), authenticating
 * with the cached session ID. Transparently re-logs in and retries once if
 * the session has expired (HTTP 401). Note that if multiple requests hit an
 * expired session concurrently, each retries independently - acceptable for
 * this tool's request volume (a handful of calls per poll), not worth the
 * extra complexity of deduplicating in-flight logins.
 * @param path the API path including query string, starting with "/".
 * @returns {Promise<*>} the parsed JSON response body.
 */
const authenticatedGet = (path) => {
	const request = (sid) =>
		fetch(`http://${config.PiHole.IP}/api${path}`, {
			headers: { sid },
		});

	return ensureLoggedIn()
		.then(request)
		.then((res) => (res.status === 401 ? login().then(request) : res))
		.then((res) =>
			res.json().then((body) => {
				if (!res.ok) {
					throw new Error(
						`Pi-Hole request to ${path} failed with HTTP ${
							res.status
						}: ${JSON.stringify(body)}`,
					);
				}
				return body;
			}),
		);
};

/**
 * Fetches Pi-hole's overview stats (query counts, gravity list size, clients).
 */
const getSummary = () => authenticatedGet('/stats/summary');

/**
 * Fetches the single most-requested domain, optionally restricted to blocked
 * queries. Resolves to null if Pi-hole has no matching data yet.
 * @param blocked true for the top blocked domain, false for the top permitted domain.
 */
const getTopDomain = (blocked) =>
	authenticatedGet(`/stats/top_domains?blocked=${blocked}&count=1`).then(
		(body) => body.domains[0] || null,
	);

/**
 * Fetches the most recently blocked domain. Resolves to null if nothing has
 * been blocked yet.
 */
const getRecentBlocked = () =>
	authenticatedGet('/stats/recent_blocked?count=1').then(
		(body) => body.blocked[0] || null,
	);

/**
 * Formats a top-domain entry (as returned by getTopDomain) as
 * "<domain> (<n> Queries)", or a fallback text if no domain data exists yet.
 */
const formatTopDomain = (domain, fallback) =>
	domain ? `${domain.domain} (${domain.count} Queries)` : fallback;

/**
 * Collects and combines the Pi-hole stats relevant for the LaMetric display.
 * @returns {Promise<{adsBlockedToday: number, blockListSize: number, dnsQueriesToday: number, lastBlockedQuery: string, percentBlocked: number, topBlockedQuery: string, topQuery: string, totalClientsSeen: number}>}
 */
const collectPiholeStats = () => {
	return ensureLoggedIn()
		.then(() =>
			Promise.all([
				getSummary(),
				getTopDomain(false),
				getTopDomain(true),
				getRecentBlocked(),
			]),
		)
		.then(([summary, topQuery, topBlockedQuery, lastBlockedQuery]) => ({
			blockListSize: summary.gravity.domains_being_blocked,
			dnsQueriesToday: summary.queries.total,
			adsBlockedToday: summary.queries.blocked,
			percentBlocked: Math.round(summary.queries.percent_blocked),
			totalClientsSeen: summary.clients.total,
			topQuery: formatTopDomain(topQuery, 'Noch keine Anfragen'),
			topBlockedQuery: formatTopDomain(
				topBlockedQuery,
				'Noch nichts geblockt',
			),
			lastBlockedQuery: lastBlockedQuery || 'Noch nichts geblockt',
		}));
};

/**
 * Maps combined Pi-hole stats to the frame format expected by LaMetric's
 * "My Data DIY" app. Icon IDs are optional and taken from config.Icons (see
 * example.config.json) - pick your own from https://developer.lametric.com/icons.
 * @param stats the combined stats, as returned by collectPiholeStats.
 * @returns {{frames: [{goalData: {current: number, end: number, start: number, unit: string}}, {text: string}]}}
 */
const mapStatsToFrames = (stats) => {
	const icons = config.Icons || {};
	const withIcon = (key, frameBody) =>
		icons[key] ? { ...frameBody, icon: icons[key] } : frameBody;
	const textFrame = (key, text) => withIcon(key, { text });

	return {
		frames: [
			withIcon('percentBlocked', {
				goalData: {
					start: 0,
					current: stats.percentBlocked,
					end: 100,
					unit: '%',
				},
			}),
			textFrame(
				'adsBlockedToday',
				`${stats.adsBlockedToday} geblockt heute`,
			),
			textFrame(
				'dnsQueriesToday',
				`${stats.dnsQueriesToday} Anfragen heute`,
			),
			textFrame(
				'blockListSize',
				`${stats.blockListSize} Domains auf der Blockliste`,
			),
			textFrame('totalClientsSeen', `${stats.totalClientsSeen} Clients`),
			textFrame(
				'topBlockedQuery',
				`Top geblockt: ${stats.topBlockedQuery}`,
			),
			textFrame(
				'lastBlockedQuery',
				`Zuletzt geblockt: ${stats.lastBlockedQuery}`,
			),
		],
	};
};

/**
 * Returns the cached LaMetric frames if still fresh, otherwise fetches fresh
 * Pi-hole stats. On a fetch error, serves the last known-good frames instead
 * of failing the poll request outright, if any are cached yet.
 * @returns {Promise<{frames: [{text: string}]}>}
 */
const getFrames = () => {
	const now = Date.now();
	if (cache.frames && now < cache.expiresAt) {
		return Promise.resolve(cache.frames);
	}

	return collectPiholeStats()
		.then(mapStatsToFrames)
		.then((frames) => {
			cache = { expiresAt: now + config.updateInterval * 1000, frames };
			return frames;
		})
		.catch((err) => {
			logIfDebug(err);
			if (cache.frames) {
				return cache.frames;
			}
			throw err;
		});
};

// Served when Pi-hole is unreachable and there is no cached frame yet to fall
// back to (e.g. right after startup).
const ERROR_FRAMES = { frames: [{ text: 'Pi-hole nicht erreichbar' }] };

/**
 * Handles a single incoming HTTP request. Only GET /lametric is served -
 * that's the one poll URL My Data DIY needs; everything else gets 404.
 */
const handleRequest = (req, res) => {
	if (req.method !== 'GET' || req.url.split('?')[0] !== '/lametric') {
		res.writeHead(404).end();
		return;
	}

	getFrames()
		.then((frames) => {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(frames));
		})
		.catch((err) => {
			logIfDebug(err);
			res.writeHead(502, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(ERROR_FRAMES));
		});
};

/**
 * Starts the HTTP server that My Data DIY polls for Pi-hole stats.
 * @returns {http.Server} the started server.
 */
const startServer = () => {
	const server = http.createServer(handleRequest);
	server.listen(config.Server.Port, () => {
		console.log(
			`Pi-Hole for LaMetric listening on port ${config.Server.Port}...`,
		);
	});
	return server;
};

/**
 * Main program: starts the poll server. Pi-hole is only contacted once
 * My Data DIY actually polls (see getFrames caching).
 */
const main = () => {
	logIfDebug('Debug Mode Enabled');
	startServer();
};

// Starts the server when this file is run directly (`node index.js`, as the
// systemd service does), but not when it's merely require()'d - e.g. by the
// test suite or by `node -e "require('./index').main()"` (the npm start
// script), which call main() explicitly instead.
if (require.main === module) {
	main();
}

module.exports = {
	main,
	startServer,
	handleRequest,
	login,
	collectPiholeStats,
	mapStatsToFrames,
	getFrames,
};
