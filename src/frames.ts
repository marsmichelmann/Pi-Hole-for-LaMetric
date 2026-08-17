import type { Frame, Frames, IconConfig, PiholeStats } from './types.js';

// Numeric frames deliberately show the bare number: anything longer than the
// 37x8 px display scrolls, and the per-frame icon already carries the
// meaning. Only the two domain frames scroll - domain names never fit.
export const mapStatsToFrames = (
	stats: PiholeStats,
	icons: IconConfig = {},
): Frames => {
	const frame = (key: string, body: Frame): Frame => {
		const icon = icons[key];
		return icon ? { ...body, icon } : body;
	};

	return {
		frames: [
			frame('percentBlocked', {
				goalData: {
					start: 0,
					current: stats.percentBlocked,
					end: 100,
					unit: '%',
				},
			}),
			frame('adsBlockedToday', { text: `${stats.adsBlockedToday}` }),
			frame('dnsQueriesToday', { text: `${stats.dnsQueriesToday}` }),
			frame('blockListSize', { text: `${stats.blockListSize}` }),
			frame('totalClientsSeen', { text: `${stats.totalClientsSeen}` }),
			frame('topBlockedQuery', {
				text: `Top geblockt: ${stats.topBlockedQuery}`,
			}),
			frame('lastBlockedQuery', {
				text: `Zuletzt geblockt: ${stats.lastBlockedQuery}`,
			}),
		],
	};
};
