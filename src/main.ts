import { loadConfig } from './config.js';
import { PiholeClient } from './pihole.js';
import { createFrameProvider, startServer } from './server.js';

const config = loadConfig();
const client = new PiholeClient(config.PiHole.IP, config.PiHole.Password);
const getFrames = createFrameProvider(client, {
	icons: config.Icons ?? {},
	ttlSeconds: config.updateInterval,
	onError: (err) => {
		if (config.debugMode) {
			console.error(err);
		}
	},
});

startServer(config.Server.Port, getFrames);
