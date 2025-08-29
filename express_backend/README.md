# Express Backend

Core backend for Employee Monitoring & Management System.

## Setup

1. Copy environment file:
   cp .env.example .env
   Then update values for your environment, ensuring the MySQL DB is reachable on port 5000.

2. Install dependencies:
   npm install

3. Run in development:
   npm run dev

4. Swagger docs:
   Visit /docs when the server is running.

## Database

- ORM: Sequelize
- Dialect: MySQL
- Required envs: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME

The server will attempt a DB connection on startup and log success/failure.
