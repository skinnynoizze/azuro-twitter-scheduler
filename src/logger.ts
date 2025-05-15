/**
 * Logging utility class
 * 
 * Usage:
 * - Don't include log level in messages (bad: "[INFO] Starting app", good: "Starting app")
 * - Log level and timestamp are automatically added to all messages
 * - Use the appropriate method for each log level (info, warn, error, debug)
 */
class Logger {
  // Log levels
  private readonly LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  };

  info(message: string, data?: any): void {
    this.log(this.LEVELS.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(this.LEVELS.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(this.LEVELS.ERROR, message, data);
  }

  debug(message: string, data?: any): void {
    this.log(this.LEVELS.DEBUG, message, data);
  }

  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    
    if (data) {
      console.log(`[${timestamp}] [${level}] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  }
}

export const logger = new Logger(); 