import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    base: {
      service: 'zorfly-api'
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.secret'
      ],
      censor: '[REDACTED]'
    }
  });
}
