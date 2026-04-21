import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  })
);

const transports = [
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: jsonFormat
  })
];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat
    })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports
});

// Interceptor Global: Capturar todos los console.error del sistema (Controladores viejos, Node_modules, etc)
// y desviarlos hacia nuestro archivo error.log antes de imprimirlos en consola.
const originalConsoleError = console.error;
console.error = function (...args) {
  const message = args.map(a => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') return JSON.stringify(a);
    return a;
  }).join(' ');

  logger.error(message);
  originalConsoleError.apply(console, args);
};

export default logger;
