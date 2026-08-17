import type { PiholeStats } from './types.js';

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

	private fetchApi(path: string, init?: RequestInit): Promise<Response> {
		return fetch(`http://${this.ip}/api${path}`, {
			...init,
			signal: AbortSignal.timeout(this.timeoutMs),
		});
	}

	// Parses a response body as JSON, turning a non-JSON body (e.g. an HTML
	// error page from a misconfigured host) into a message that still
	// carries the HTTP status, instead of a raw, unhelpful SyntaxError.
	private async parseJson<T>(res: Response, context: string): Promise<T> {
		try {
			return (await res.json()) as T;
		} catch {
			throw new Error(
				`Pi-Hole ${context} returned a non-JSON response (HTTP ${res.status})`,
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
		const body = await this.parseJson<SessionResponse>(res, 'login');
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
		const body = await this.parseJson<T>(res, `request to ${path}`);
		if (!res.ok) {
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
