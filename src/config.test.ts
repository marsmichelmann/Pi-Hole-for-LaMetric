import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

const tempDir = mkdtempSync(join(tmpdir(), 'pihole-lametric-test-'));

const writeTempConfig = (content: unknown): URL => {
	const path = join(tempDir, 'config.json');
	writeFileSync(path, JSON.stringify(content));
	return pathToFileURL(path);
};

const validConfig = {
	PiHole: { IP: '1.1.1.1', Password: 'testpw' },
	Server: { Port: 3031 },
	Icons: {},
	updateInterval: 60,
	debugMode: false,
};

describe('loadConfig', () => {
	afterAll(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('loads a valid config file', () => {
		const config = loadConfig(writeTempConfig(validConfig));

		expect(config).toEqual(validConfig);
	});

	it('rejects a config without the PiHole section', () => {
		// JSON.stringify drops undefined fields entirely
		const incomplete = { ...validConfig, PiHole: undefined };

		expect(() => loadConfig(writeTempConfig(incomplete))).toThrow(
			'missing the "PiHole" field',
		);
	});

	it('rejects a config without updateInterval', () => {
		const incomplete = { ...validConfig, updateInterval: undefined };

		expect(() => loadConfig(writeTempConfig(incomplete))).toThrow(
			'missing the "updateInterval" field',
		);
	});
});
