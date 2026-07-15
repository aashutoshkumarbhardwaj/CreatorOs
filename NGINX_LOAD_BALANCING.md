# Nginx Reverse Proxy and Load Balancing Guide

This guide outlines how to run, scale, and test the load-balanced setup for CreatorOS.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Configuration Walkthrough](#configuration-walkthrough)
4. [Deployment Instructions](#deployment-instructions)
5. [Scaling the Application](#scaling-the-application)
6. [Verification & Testing](#verification--testing)

---

## Architecture Overview

Traffic flows from the client to the host port `80`, where it is handled by **Nginx**. Nginx acts as a reverse proxy, SSL termination/security layer, and a load balancer distributing request load across multiple running instances of the **Node.js Express application**.

```
                 +-------------------+
                 |      Client       |
                 +---------+---------+
                           |
                           v  (Port 80)
                 +-------------------+
                 |    Nginx Proxy    |
                 +---------+---------+
                           |
            +--------------+--------------+
            | (least_conn load balancing) |
            v                             v
  +------------------+          +------------------+
  |  App Instance 1  |          |  App Instance 2  | (and more...)
  |   (Port 3000)    |          |   (Port 3000)    |
  +--------+---------+          +--------+---------+
           |                             |
           +--------------+--------------+
                          v
                +-------------------+
                |  MongoDB / Redis  |
                +-------------------+
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## Configuration Walkthrough

### 1. Dockerfile
The application is containerized using [Dockerfile](Dockerfile). It:
- Sets up a Node.js environment.
- Installs dependencies using `npm ci`.
- Compiles Tailwind CSS to ensure static assets are optimized and available.
- Exposes port `3000`.

### 2. Nginx Configuration
The [nginx/nginx.conf](nginx/nginx.conf) defines:
- **Upstream Block**: Configures load balancing using the `least_conn` algorithm (routes traffic to the instance with the fewest active connections).
- **Proxy Headers**: Properly forwards headers like `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` so the Express app receives accurate client information.
- **Max Body Size**: Set to `50M` to support large file uploads through the upload service.

### 3. Docker Compose Orchestration
The [docker-compose.yml](docker-compose.yml) file orchestrates four services:
- **mongodb**: Local database instance.
- **redis**: Cache and session storage instance.
- **web**: Replicas of the CreatorOS application.
- **nginx**: Front-facing proxy container mapping port `80` on the host to port `80` in the container.

---

## Deployment Instructions

To spin up the entire cluster (MongoDB, Redis, Node.js App, and Nginx):

```bash
docker-compose up --build -d
```

To view logs for the running containers:

```bash
docker-compose logs -f
```

To stop the cluster and tear down resources:

```bash
docker-compose down
```

---

## Scaling the Application

By default, Docker Compose runs one instance of the application. You can easily scale it up to multiple instances:

```bash
docker-compose up --build -d --scale web=3
```

This commands spins up **3 separate containers** of the Node.js application. Nginx will automatically distribute requests across all three replicas using the configured least-connection balancing method.

---

## Verification & Testing

1. Open your browser and navigate to `http://localhost/`.
2. Inspect the HTTP headers: you should see standard responses from our load-balanced app server.
3. Check Nginx logs to confirm routing distribution:
   ```bash
   docker-compose logs nginx
   ```
4. Verify the database and caching integrations work seamlessly while balancing traffic.
