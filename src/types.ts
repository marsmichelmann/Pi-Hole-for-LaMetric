export interface AppConfig {
	PiHole: {
		IP: string;
		Password: string;
	};
	Server: {
		Port: number;
	};
	Icons?: IconConfig;
	updateInterval: number;
}

export interface PiholeStats {
	blockListSize: number;
	dnsQueriesToday: number;
	adsBlockedToday: number;
	percentBlocked: number;
	totalClientsSeen: number;
	topBlockedQuery: string;
	lastBlockedQuery: string;
}

// One icon per stat we actually render (see frames.ts) - keyed by
// PiholeStats so a typo in config.json's Icons object is a type error.
export type IconConfig = Partial<Record<keyof PiholeStats, string>>;

// Implemented by PiholeClient; kept separate so tests can supply a plain
// object instead of an actual client (no cast needed - structural typing).
export interface StatsSource {
	collectStats(): Promise<PiholeStats>;
}

export interface FrameProviderOptions {
	icons: IconConfig;
	ttlSeconds: number;
	onError?: (err: unknown) => void;
}

export interface Frame {
	text?: string;
	icon?: string;
	goalData?: { start: number; current: number; end: number; unit: string };
}

export interface Frames {
	frames: Frame[];
}

// The subset of Node's IncomingMessage/ServerResponse that handleRequest
// actually uses. A real http.IncomingMessage/ServerResponse satisfies these
// structurally, and so does a plain test double - no cast needed either way.
export interface HttpRequest {
	method?: string;
	url?: string;
}

export interface HttpResponse {
	writeHead(statusCode: number, headers?: Record<string, string>): this;
	end(body?: string): void;
}
