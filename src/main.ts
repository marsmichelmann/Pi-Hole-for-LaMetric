import { loadConfig } from './config.js';
import { PiholeClient } from './pihole.js';
import { createFrameProvider, startServer } from './server.js';

const config = loadConfig();
const client = new PiholeClient(config.PiHole.IP, config.PiHole.Password);
const getFrames = createFrameProvider(client, {
	icons: config.Icons ?? {},
	ttlSeconds: config.updateInterval,
	// Always logged (not gated behind a debug flag) - under systemd this
	// lands in the journal, and a silently stale/failing poll endpoint with
	// nothing in the logs is worse than one noisy line per failure.
	onError: (err) => {
		console.error(err);
	},
});

startServer(config.Server.Port, getFrames);
