import * as fs from 'fs';
import * as path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a log file with timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const logFilePath = path.join(logsDir, `test-log-${timestamp}.log`);

// Create a write stream for logging
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// Helper function to write to log file
const writeToLog = (type: string, ...args: unknown[]): void => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logEntry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${message}\n`;
  logStream.write(logEntry);
};

// Mock console methods
console.log = jest.fn((...args) => writeToLog('log', ...args));
console.info = jest.fn((...args) => writeToLog('info', ...args));
console.warn = jest.fn((...args) => writeToLog('warn', ...args));
console.error = jest.fn((...args) => writeToLog('error', ...args));
console.debug = jest.fn((...args) => writeToLog('debug', ...args));

// Clean up after all tests
afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
  
  // Close the log stream
  logStream.end();
});