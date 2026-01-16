import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.APP_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    app: "solicitors-scraper",
    env: process.env.APP_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
  },
});
