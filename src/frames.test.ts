import { describe, expect, it } from 'vitest';

import { mapStatsToFrames } from './frames.js';
import { combinedStats, expectedFrames } from './mockdata.js';

describe('mapStatsToFrames', () => {
	it('maps combined stats to LaMetric frames', () => {
		expect(mapStatsToFrames(combinedStats)).toEqual(expectedFrames);
	});

	it('includes an icon for a text frame when one is configured', () => {
		const frames = mapStatsToFrames(combinedStats, {
			adsBlockedToday: 'i16805',
		});

		expect(frames.frames[1]).toEqual({ text: '7558', icon: 'i16805' });
	});

	it('includes an icon on the goalData frame when configured', () => {
		const frames = mapStatsToFrames(combinedStats, {
			percentBlocked: 'i33911',
		});

		expect(frames.frames[0]).toEqual({
			goalData: { start: 0, current: 16, end: 100, unit: '%' },
			icon: 'i33911',
		});
	});
});
