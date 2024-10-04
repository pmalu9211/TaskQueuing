const express = require('express');
const bodyParser = require('body-parser');
const Redis = require('redis');
const { promisify } = require('util');
const config = require('./config');

const redisClient = Redis.createClient(config.REDIS_URL);
const rpushAsync = promisify(redisClient.rpush).bind(redisClient);

function setupWorker() {
  const app = express();
  app.use(bodyParser.json());

  app.post('/task', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const queueItem = JSON.stringify({ userId: user_id, timestamp: Date.now() });
    await rpushAsync('taskQueue', queueItem);

    res.json({ message: 'Task queued successfully' });
  });

  app.listen(config.PORT, () => {
    console.log(`Worker ${process.pid} started and listening on port ${config.PORT}`);
  });
}

module.exports = { setupWorker };