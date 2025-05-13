export const logger = {
  info: (msg: string, data?: any) => {
    if (process.env.LOG_LEVEL !== 'error') {
      console.log(`[INFO] ${msg}`, data ?? '');
    }
  },
  error: (msg: string, err?: any) => {
    console.error(`[ERROR] ${msg}`, err?.message ?? err ?? '');
  },
  debug: (msg: string, data?: any) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${msg}`, data ?? '');
    }
  },
}; 