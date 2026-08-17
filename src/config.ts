import { readFileSync } from 'node:fs';

import type { AppConfig } from './types.js';

const isValidPort = (port: unknown): port is number =>
	typeof port === 'number' &&
	Number.isInteger(port) &&
	port > 0 &&
	port <= 65535;

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
	if (!config.PiHole.IP || !config.PiHole.Password) {
		throw new Error(
			'config.json: PiHole.IP and PiHole.Password must be non-empty strings',
		);
	}
	if (!isValidPort(config.Server.Port)) {
		throw new Error(
			`config.json: Server.Port must be an integer between 1 and 65535, got ${String(config.Server.Port)}`,
		);
	}
	return config;
};
