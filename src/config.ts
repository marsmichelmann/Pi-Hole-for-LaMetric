import { readFileSync } from 'node:fs';

import type { AppConfig } from './types.js';

export const loadConfig = (
	// config.json lives in the repo root, one level above dist/
	url: URL = new URL('../config.json', import.meta.url),
): AppConfig => {
	const config = JSON.parse(readFileSync(url, 'utf8')) as AppConfig;
	for (const key of ['PiHole', 'Server', 'updateInterval'] as const) {
		if (config[key] === undefined) {
			throw new Error(`config.json is missing the "${key}" field`);
		}
	}
	return config;
};
