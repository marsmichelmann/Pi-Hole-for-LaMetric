import { request as httpRequest } from 'node:http';

import type { PiholeStats } from './types.js';

interface HttpResult {
	status: number;
	body: string;
}

// Deliberately plain node:http instead of the built-in fetch: fetch is
// backed by undici, whose connection pool and spec machinery cost ~15 MB of
// extra RSS on the Pi just for being initialized - measured, not guessed.
// Our needs (tiny JSON requests) don't justify that.
const httpJson = (
	url: string,
	options: {
		method?: string;
		headers?: Record<string, string>;
		body?: string;
		timeoutMs: number;
	},
): Promise<HttpResult> =>
	new Promise((resolve, reject) => {
		const req = httpRequest(
			url,
			{
				method: options.method ?? 'GET',
				headers: options.headers,
				timeout: options.timeoutMs,
			},
			(res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (chunk: string) => (data += chunk));
				res.on('end', () =>
					resolve({ status: res.statusCode ?? 0, body: data }),
				);
			},
		);
		req.on('timeout', () => {
			req.destroy(new Error(`request to ${url} timed out`));
		});
		req.on('error', reject);
		req.end(options.body);
	});

interface SessionResponse {
	session?: {
		valid: boolean;
		sid: string | null;
		message: string | null;
	};
}

interface SummaryResponse {
	queries: { total: number; blocked: number; percent_blocked: number };
	clients: { total: number };
	gravity: { domains_being_blocked: number };
}

interface TopDomainsResponse {
	domains: { domain: string; count: number }[];
}

interface RecentBlockedResponse {
	blocked: string[];
}

const NOTHING_BLOCKED_YET = 'Noch nichts geblockt';

const formatTopDomain = (
	domain: { domain: string; count: number } | undefined,
): string =>
	domain ? `${domain.domain} (${domain.count} Queries)` : NOTHING_BLOCKED_YET;

export class PiholeClient {
	// Pi-hole sessions expire after inactivity; on 401 the request is retried
	// once after a fresh login (see request()).
	private sid: string | null = null;

	// Coalesces concurrent logins into one in-flight request, so two
	// requests hitting an empty/expired session at the same time don't each
	// open their own session (see ensureSession() and the 401 branch below).
	private loginPromise: Promise<string> | null = null;

	constructor(
		private readonly ip: string,
		private readonly password: string,
		private readonly timeoutMs = 10_000,
	) {}

	private fetchApi(
		path: string,
		options: {
			method?: string;
			headers?: Record<string, string>;
			body?: string;
		} = {},
	): Promise<HttpResult> {
		return httpJson(`http://${this.ip}/api${path}`, {
			...options,
			timeoutMs: this.timeoutMs,
		});
	}

	// Parses a response body as JSON, turning a non-JSON body (e.g. an HTML
	// error page from a misconfigured host) into a message that still
	// carries the HTTP status, instead of a raw, unhelpful SyntaxError. The
	// SyntaxError itself stays attached as `cause`, so the journal still
	// shows where the body went wrong without that noise in the message.
	private parseJson<T>(res: HttpResult, context: string): T {
		try {
			return JSON.parse(res.body) as T;
		} catch (err) {
			throw new Error(
				`Pi-Hole ${context} returned a non-JSON response (HTTP ${res.status})`,
				{ cause: err },
			);
		}
	}

	private login(): Promise<string> {
		this.loginPromise ??= this.performLogin().finally(() => {
			this.loginPromise = null;
		});
		return this.loginPromise;
	}

	private async performLogin(): Promise<string> {
		const res = await this.fetchApi('/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: this.password }),
		});
		const body = this.parseJson<SessionResponse>(res, 'login');
		if (!body.session?.valid || body.session.sid === null) {
			throw new Error(
				`Pi-Hole login failed: ${body.session?.message ?? 'no session in response'}`,
			);
		}
		this.sid = body.session.sid;
		return this.sid;
	}

	private ensureSession(): Promise<string> {
		return this.sid === null ? this.login() : Promise.resolve(this.sid);
	}

	private async request<T>(path: string): Promise<T> {
		const sid = await this.ensureSession();
		let res = await this.fetchApi(path, { headers: { sid } });
		if (res.status === 401) {
			res = await this.fetchApi(path, {
				headers: { sid: await this.login() },
			});
		}
		const body = this.parseJson<T>(res, `request to ${path}`);
		if (res.status < 200 || res.status >= 300) {
			throw new Error(
				`Pi-Hole request to ${path} failed with HTTP ${res.status}: ${JSON.stringify(body)}`,
			);
		}
		return body;
	}

	async collectStats(): Promise<PiholeStats> {
		// Sequential login (if needed) first, then the three calls in
		// parallel - otherwise each of them would race to create its own
		// session.
		await this.ensureSession();
		const [summary, topBlocked, recentBlocked] = await Promise.all([
			this.request<SummaryResponse>('/stats/summary'),
			this.request<TopDomainsResponse>(
				'/stats/top_domains?blocked=true&count=1',
			),
			this.request<RecentBlockedResponse>(
				'/stats/recent_blocked?count=1',
			),
		]);

		return {
			blockListSize: summary.gravity.domains_being_blocked,
			dnsQueriesToday: summary.queries.total,
			adsBlockedToday: summary.queries.blocked,
			percentBlocked: Math.round(summary.queries.percent_blocked),
			totalClientsSeen: summary.clients.total,
			topBlockedQuery: formatTopDomain(topBlocked.domains[0]),
			lastBlockedQuery: recentBlocked.blocked[0] ?? NOTHING_BLOCKED_YET,
		};
	}
}
