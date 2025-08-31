import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
    level,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({timestamp, level, message}) =>
            `${timestamp} [${level}] ${message}`,
        ),
    ),
    transports: [new winston.transports.Console()],
});

export default logger;
