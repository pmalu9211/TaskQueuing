const express = require('express');
const bodyParser = require('body-parser');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const Redis = require('redis');
const winston = require('winston');
const config = require('./config');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: config.LOG_FILE })
  ]
});

// Create Redis client
const redisClient = Redis.createClient({ url: config.REDIS_URL });

// Ensure Redis client is connected
(async () => {
  await redisClient.connect();
})();

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

// Handle Redis connection errors
redisClient.on('error', (error) => {
  console.error('Redis error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });

  // Start queue processing in master process
  processQueue().catch(error => {
    console.error('Error in queue processor:', error);
    process.exit(1);
  });
} else {
  const app = express();
  app.use(bodyParser.json());

  app.post('/task', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const queueItem = JSON.stringify({ userId: user_id, timestamp: Date.now() });
    await redisClient.rPush('taskQueue', queueItem);

    res.json({ message: 'Task queued successfully' });
  });

  const PORT = config.PORT;
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} started and listening on port ${PORT}`);
  });
}
