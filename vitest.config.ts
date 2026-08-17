import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			enabled: true,
			include: ['src/**/*.ts'],
			// main.ts is the composition root (pure wiring, verified
			// end-to-end on the Pi); mockdata.ts is test fixtures;
			// types.ts has no runtime code.
			exclude: ['src/main.ts', 'src/mockdata.ts', 'src/types.ts'],
			reporter: ['text'],
			thresholds: {
				lines: 95,
				branches: 90,
				functions: 95,
				statements: 95,
			},
		},
	},
});
