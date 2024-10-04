module.exports = {
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    PORT: process.env.PORT || 3000,
    LOG_FILE: process.env.LOG_FILE || 'task-logs.log'
  };
  