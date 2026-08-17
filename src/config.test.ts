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

	it('rejects an empty PiHole.IP', () => {
		const invalid = {
			...validConfig,
			PiHole: { ...validConfig.PiHole, IP: '' },
		};

		expect(() => loadConfig(writeTempConfig(invalid))).toThrow(
			'PiHole.IP and PiHole.Password must be non-empty strings',
		);
	});

	it('rejects an empty PiHole.Password', () => {
		const invalid = {
			...validConfig,
			PiHole: { ...validConfig.PiHole, Password: '' },
		};

		expect(() => loadConfig(writeTempConfig(invalid))).toThrow(
			'PiHole.IP and PiHole.Password must be non-empty strings',
		);
	});

	it.each([0, -1, 65536, 1.5, 'abc'])(
		'rejects an invalid Server.Port %s',
		(port) => {
			const invalid = { ...validConfig, Server: { Port: port } };

			expect(() => loadConfig(writeTempConfig(invalid))).toThrow(
				'Server.Port must be an integer between 1 and 65535',
			);
		},
	);
});
