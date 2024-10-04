# **User Task Queuing with Rate Limiting**

## **Introduction**

This project implements a Node.js API with a task queueing system and rate-limiting mechanism. Each user can process only one task per second and up to 20 tasks per minute. Tasks exceeding this rate are queued and processed in due time, ensuring no requests are dropped. Redis is used to manage the task queue between clusters, and tasks are logged with the user ID and completion timestamp.

## **Features**

1. **API Cluster with Two Replica Sets**: Utilizes Node's `cluster` module to run a master-worker process architecture, distributing HTTP request handling across multiple CPU cores.
2. **User-based Rate Limiting**: Limits each user to 1 task per second and 20 tasks per minute.
3. **Task Queuing**: Tasks exceeding the rate limit are queued and executed later in accordance with the rate limits.
4. **Logging**: Task completion, along with the user ID and timestamp, is logged into a file using `winston`.
5. **Resilience**: Ensures that no request is dropped, and all tasks are eventually processed.

---

## **Requirements**

- **Node.js** (v14 or later)
- **Redis** (Installed and running)
- **Docker** (Optional but recommended for simplified setup)

---

## **Installation and Setup**

### **1. Clone the Repository**

```bash
git clone <repository-url>
cd <repository-directory>
```

### **2. Install Dependencies**

```bash
npm install
```

### **3. Configure Environment Variables**

Create a `.env` file in the root directory (or you can use the default values in the `config.js` file):

```bash
REDIS_URL=redis://localhost:6379
PORT=3000
LOG_FILE=task-logs.log
```

Alternatively, modify `config.js` to fit your environment.

### **4. Start Redis**

Ensure you have Redis running. You can start Redis with Docker as follows:

```bash
docker run --name redis-instance -p 6379:6379 redis:alpine
```

### **5. Start the Application**

#### **a) With Node.js directly**

```bash
npm start
```

This will spin up the application with cluster mode, utilizing all CPU cores for worker processes.

#### **b) With Docker (Recommended)**

You can also use `docker-compose` to run the application:

```bash
docker-compose up
```

This will automatically build the image, start the Redis container, and run the Node.js app.

---

## **How to Use**

### **1. API Endpoint**

- **Route**: `/task`
- **Method**: `POST`
- **Body**: JSON

```json
{
  "user_id": "123"
}
```

### **2. Example Request**

You can use `curl` or any HTTP client (like Postman) to send a request to the API:

```bash
curl -X POST http://localhost:3000/task -H "Content-Type: application/json" -d '{"user_id":"123"}'
```

Upon success, the task will be queued and processed according to the rate limit. If a task exceeds the rate limit, it will be queued and processed later.

### **3. Log File**

Task completions are logged in the specified log file (`task-logs.log` by default). Each log entry contains the user ID and a timestamp of when the task was processed.

---

## **Project Structure**

- **app.js**: Main server file responsible for setting up the API and processing tasks.
- **queryProcessor.js**: Contains the logic for task processing and queue management.
- **config.js**: Contains configuration settings (such as Redis URL, port number, log file path).
- **Dockerfile**: Used to build the Docker image for the application.
- **docker-compose.yml**: Docker Compose setup for running both the app and Redis together.
- **package.json**: Defines the dependencies and scripts for the project.

---

## **Explanation of the Solution**

### **1. Clustering**

The application utilizes Node.js's `cluster` module to create a master-worker setup. The master process handles queue processing while the worker processes handle incoming HTTP requests.

### **2. Rate Limiting**

Rate limiting is implemented using Redis sorted sets (`zAdd`), which store timestamps for each user’s request. Two sets are used:

- A **1-second** set to limit tasks to 1 per second.
- A **1-minute** set to limit tasks to 20 per minute.

The timestamps in the sets are automatically expired after their respective timeframes.

### **3. Task Queueing**

Tasks that exceed the rate limit are pushed to a Redis list (`rPush`), effectively queuing them. A background worker (the master process) constantly monitors this queue (`lPop`) and processes tasks when the rate limit allows.

### **4. Logging**

The `winston` library is used for logging task completions. The logs are stored in the specified file (`task-logs.log`), ensuring a persistent record of task completion times and user IDs.

---

## **How the Rate Limiting Works**

- Each user has their own rate limit (based on their `user_id`).
- If a user sends more than 1 request per second or 20 requests per minute, the requests exceeding the limit are queued.
- Once the appropriate amount of time has passed (1 second or less than 20 in a minute), the queued requests are processed.
- The system ensures **no requests are dropped**—every task is eventually processed.

---

## **Error Handling and Resilience**

- The application handles Redis connection errors gracefully by logging them.
- Upon receiving a `SIGTERM` signal, the application ensures that Redis is properly closed, and all pending tasks are processed before shutdown.
- The cluster automatically restarts workers that exit or crash, maintaining the stability of the API.

---

## **Testing**

To test the solution, you can send multiple requests from the same `user_id` to ensure that the rate-limiting and queuing mechanism works as expected.

For example, send 5 requests in quick succession:

```bash
for i in {1..5}; do curl -X POST http://localhost:3000/task -H "Content-Type: application/json" -d '{"user_id":"123"}'; done
```

You should observe in the logs that only one task is processed per second for the same user, and no requests are dropped.

---

## **Assumptions and Considerations**

- **Rate Limits**: The 1-second and 20-per-minute rate limits are hardcoded but can be made configurable via environment variables.
- **Scalability**: Redis is used to share state across cluster workers, ensuring scalability even with multiple processes.
- **Error Handling**: Redis connection errors are logged, and the app ensures that Redis is gracefully shut down on termination.

---

## **Conclusion**

This solution provides a resilient and scalable task queueing system with rate limiting based on user IDs. By using clustering and Redis, it efficiently handles concurrent requests and ensures that no tasks are dropped. The logs provide a reliable record of when tasks were processed.

---
