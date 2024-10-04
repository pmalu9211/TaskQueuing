const Redis = require('redis');
const winston = require('winston');
const config = require('./config');

const redisClient = Redis.createClient({ url: config.REDIS_URL });

// Ensure Redis client is connected
(async () => {
  await redisClient.connect();
})();

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: config.LOG_FILE })
  ]
});

// Task function
async function task(user_id) {
  const message = `${user_id}-task completed at-${Date.now()}`;
  console.log(message);
  logger.info(message);
}

// Rate limiting function
async function checkRateLimit(userId) {
  const now = Date.now();
  const secondKey = `rateLimit:${userId}:second`;
  const minuteKey = `rateLimit:${userId}:minute`;

  const secondCount = await redisClient.zCount(secondKey, now - 1000, now);
  const minuteCount = await redisClient.zCount(minuteKey, now - 60000, now);

  if (secondCount >= 1 || minuteCount >= 20) {
    return false;
  }

  await redisClient.zAdd(secondKey, { score: now, value: now.toString() });
  await redisClient.zAdd(minuteKey, { score: now, value: now.toString() });
  await redisClient.expire(secondKey, 2);
  await redisClient.expire(minuteKey, 61);

  return true;
}

// Queue processing function
async function processQueue() {
  while (true) {
    const queueItem = await redisClient.lPop('taskQueue');
    if (queueItem) {
      const { userId, timestamp } = JSON.parse(queueItem);
      if (await checkRateLimit(userId)) {
        await task(userId);
      } else {
        await redisClient.rPush('taskQueue', queueItem);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

function setupQueueProcessor() {
  processQueue().catch(error => {
    console.error('Error in queue processor:', error);
    process.exit(1);
  });
}

module.exports = { setupQueueProcessor };
