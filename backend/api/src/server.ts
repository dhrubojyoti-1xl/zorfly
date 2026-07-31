import { parseApiEnvironment } from '@zorfly/config';
import { createApp } from './app.js';

const environment = parseApiEnvironment();
const app = createApp({ environment, version: '0.1.0' });

const server = app.listen(environment.API_PORT, environment.API_HOST, () => {
  process.stdout.write(
    `Zorfly API listening at http://${environment.API_HOST}:${String(environment.API_PORT)}\n`
  );
});

function shutdown(signal: NodeJS.Signals): void {
  server.close((error) => {
    if (error) {
      process.stderr.write(`API shutdown after ${signal} failed: ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
  });
}

process.once('SIGINT', () => {
  shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
