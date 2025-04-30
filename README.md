![Build App](https://github.com/SomeBlackMagic/WebApplicationFirewall/actions/workflows/build.yaml/badge.svg)
[![codecov](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall/graph/badge.svg?token=045DKMM46F)](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall)
[![Github Repo Size](https://img.shields.io/github/repo-size/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall)
![GitHub License](https://img.shields.io/github/license/SomeBlackMagic/WebApplicationFirewall)
![GitHub Release](https://img.shields.io/github/v/release/SomeBlackMagic/WebApplicationFirewall)

# Web Application Firewall (WAF) - Full Documentation 🛡️

## Table of Contents

1.  [Introduction](#introduction)
    *   [Purpose](#purpose)
    *   [✨ Key Features](#-key-features)
2.  [🚀 Getting Started](#-getting-started)
    *   [Requirements](#requirements)
    *   [Installation](#installation)
    *   [Running](#running)
    *   [Running with Docker](#running-with-docker)
3.  [⚙️ Configuration](#️-configuration)
    *   [💾 Loading Configuration](#-loading-configuration)
    *   [Core Parameters](#core-parameters)
    *   [Client IP Detection (`detectClientIp`)](#client-ip-detection-detectclientip)
    *   [Country/City Detection (`detectClientCountry`/`detectClientCity`)](#countrycity-detection-detectclientcountrydetectclientcity)
    *   [⛔ Jail System (`jailManager`)](#-jail-system-jailmanager)
        *   [Storage (`storage`)](#storage-storage)
        *   [Filter Rules (`filterRules`)](#filter-rules-filterrules)
    *   [✉️ Static Lists (`whitelist`, `blacklist`)](#️-static-lists-whitelist-blacklist)
    *   [Proxy (`proxy`)](#proxy-proxy)
    *   [🛡️ API (`api`)](#️-api-api)
    *   [📝 Logging (`log`)](#-logging-log)
    *   [📊 Metrics (`metrics`)](#-metrics-metrics)
    *   [Configuration Example](#configuration-example)
    *   [📦 Environment Variables](#-environment-variables)
4.  [🏛️ Architecture](#️-architecture)
    *   [Overview](#overview)
    *   [Request Processing Flow](#request-processing-flow)
    *   [Key Components](#key-components)
        *   [`WAFMiddleware`](#wafmiddleware)
        *   [`JailManager`](#jailmanager)
        *   [Rules](#rules)
        *   [Jail Storage](#jail-storage)
        *   [`ConfigLoader`](#configloader)
        *   [`Api`](#api)
        *   [`GeoIP2`](#geoip2)
        *   [`Log`](#log) / [`Sentry`](#sentry)
        *   [`Metrics`](#metrics)
5.  [💡 Core Concepts](#-core-concepts)
    *   [Operating Modes (`normal`/`audit`)](#operating-modes-normalaudit)
    *   [Jail Mechanism](#jail-mechanism)
    *   [Ban Escalation](#ban-escalation)
    *   [Rule Types](#rule-types)
        *   [Static](#static)
        *   [Flexible](#flexible)
        *   [Composite](#composite)
    *   [🌍 Geolocation Detection](#-geolocation-detection)
6.  [🧰 API Reference](#-api-reference)
    *   [Authentication](#authentication)
    *   [Endpoints](#endpoints)
        *   [`GET /waf/healthz`](#get-wafhealthz)
        *   [`GET /waf/jail-manager/baned-users`](#get-wafjail-managerbaned-users)
        *   [`DELETE /waf/jail-manager/baned-users`](#delete-wafjail-managerbaned-users)
7.  [🚢 Deployment](#-deployment)
    *   [Docker](#docker)
    *   [General Recommendations](#general-recommendations)
8.  [📊 Monitoring](#-monitoring)
    *   [Prometheus Metrics](#prometheus-metrics)
    *   [Grafana Dashboard](#grafana-dashboard)
9.  [🧑‍💻 Development](#-development)
    *   [Prerequisites](#prerequisites)
    *   [Environment Setup](#environment-setup)
    *   [✅ Running Tests](#-running-tests)
    *   [Building the Project](#building-the-project)
    *   [Project Structure](#project-structure)
    *   [🤝 Contribution Guide (TODO)](#-contribution-guide-todo)
    *   [🔭 TODO / Ideas](#-todo--ideas)
10. [📄 License](#-license)
11. [📊 Dependencies](#-dependencies)


---

## Introduction

Modular and configurable WAF server written in TypeScript using Express.js.

### Purpose

This project provides a modular and configurable Web Application Firewall (WAF) server written in TypeScript using Express.js. Its primary purpose is to protect your web applications from various types of attacks and unwanted traffic by filtering incoming HTTP requests based on a set of rules.

### ✨ Key Features

*   **⚖️ Flexible Blocking Rules:**
    *   Static IP blacklists (local or via URL).
    *   Behavioral filters (based on URL, User-Agent, geolocation, and other request fields).
    *   Composite rules with request limits per time period.
*   **⛔ Jail System:**
    *   Temporary IP banning with escalation (increasing ban time for repeat offenders).
    *   In-memory or file-based storage for the ban list.
    *   GeoIP-based location resolution (country, city) for banned IPs.
*   **✉️ Whitelist Support:**
    *   Allowing requests by IP, subnet, country, or city, bypassing all other checks.
*   **💾 Configuration via YAML or URL.**
*   **🛡️ REST API for managing bans.**
*   **🔎 Optional request auditing via ENV.**
*   **⚙️ Proxy support for backend services.**

---

## 🚀 Getting Started

### Requirements

*   **Node.js:** Version 22 or higher.
*   **npm:** Usually comes with Node.js.
*   **GeoIP Databases:**
    *   `GeoLite2-Country.mmdb`
    *   `GeoLite2-City.mmdb`
    *   You can download the free GeoLite2 databases from MaxMind's website or use alternative sources (e.g., [P3TERX/GeoLite.mmdb](https://github.com/P3TERX/GeoLite.mmdb)). Place these files in the project root or specify the path in the configuration.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SomeBlackMagic/WebApplicationFirewall.git
    cd WebApplicationFirewall
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running

1.  **Create a configuration file:** Copy `config.example.yaml` to `config.yaml` and edit it to suit your needs.
    ```bash
    cp config.example.yaml config.yaml
    ```
    *Ensure the paths to the GeoIP databases are correct.*
2.  **Download GeoIP databases:** Place the `GeoLite2-Country.mmdb` and `GeoLite2-City.mmdb` files in the project root (or the path specified in the configuration).
3.  **Start the application:**
    ```bash
    npm install
    node ./node_modules/.bin/ts-node src/main.ts
    ```
    By default, the WAF will listen on port 3000.

### Running with Docker

The project includes Dockerfiles for building images:

*   **For development (`.docker/dev.Dockerfile`):** Includes `ts-node-dev` for automatic reloading on code changes.
*   **For production (`.docker/prod.Dockerfile`):** Compiles the JavaScript code and runs it using Node.js.

**Building and running the production image (example):**

1.  **Build the image:**
    ```bash
    docker build -t my-waf-app -f .docker/prod.Dockerfile .
    ```
2.  **Prepare configuration and data:**
    *   Create a `config.yaml` file on the host machine.
    *   Create a `data` directory on the host machine if using file storage for bans (`jailManager.storage.driver: file`).
    *   Place the `.mmdb` files in a directory on the host machine (e.g., `geoip_data`).
3.  **Run the container:**
    ```bash
    docker run -d --name waf \
        -p 3000:3000 \
        -v $(pwd)/config.yaml:/app/config.yaml \
        -v $(pwd)/data:/app/data \
        -v $(pwd)/geoip_data:/app/geoip_data \
        # Pass GeoIP paths via config.yaml or mount them if needed
        # Example if paths are configured in config.yaml as /app/geoip_data/...
        my-waf-app
    ```
    *Remember to configure `config.yaml` inside the container to use the correct paths, e.g., `/app/data/blocked_ips.json` and `/app/geoip_data/...`.*

---

## ⚙️ Configuration

WAF configuration is managed via a YAML file (default `config.yaml` in the project root) or through environment variables that control how the configuration is loaded.

### 💾 Loading Configuration

*   **Default:** Loads `config.yaml` from the current working directory.
*   **Via Environment Variables:**
    *   `WAF_CONFIG_TYPE`: Source type (`file` or `link`). Default `file`.
    *   `WAF_CONFIG_SOURCE`: Path to the file (if `WAF_CONFIG_TYPE=file`) or URL (if `WAF_CONFIG_TYPE=link`). Default `./config.yaml` if `WAF_CONFIG_TYPE=file`.

### Core Parameters

*   `mode`: WAF operating mode.
    *   `audit` (default): Only logs rule triggers but does not block requests. Useful for testing rules.
    *   `normal`: Blocks requests when rules are triggered.
*   `port`: Port the WAF server will listen on (default 3000, **cannot be changed via environment variable**).
*   `log`: Logging settings (see [Logging](#-logging-log)).
*   `sentry`: Sentry integration settings.
*   `metrics`: Prometheus metrics export settings (see [Metrics](#-metrics-metrics)).
*   `geoip`: GeoIP settings (paths to database files, **cannot be set via environment variables**).
    *   `countryPath`: Path to `GeoLite2-Country.mmdb`.
    *   `cityPath`: Path to `GeoLite2-City.mmdb`.

### Client IP Detection (`detectClientIp`)

Section for configuring the detection of the real client IP address, especially if the WAF is running behind another proxy or load balancer.

*   `headers`: A list of headers (in order of priority) from which to extract the IP. Example: `["x-forwarded-for", "cf-connecting-ip"]`. If a header is found, its value is used. If none of the specified headers are found, WAF attempts to use `x-forwarded-for` (takes the first IP in the list) and, as a last resort, `req.ip`.

### Country/City Detection (`detectClientCountry`/`detectClientCity`)

Configuration for how the request's geolocation is determined.

*   `method`: Detection method.
    *   `geoip` (default): Use local GeoIP databases (`GeoLite2-Country.mmdb`, `GeoLite2-City.mmdb`). Database paths are set in the `geoip` section.
    *   `header`: Use the value from a specified HTTP header.
*   `header`: Header name (used if `method: header`).

### ⛔ Jail System (`jailManager`)

Configuration for the temporary IP banning mechanism.

*   `enabled`: Enable (`true`) or disable (`false`) the jail system.
*   `storage`: Settings for the banned IP storage.
    *   `driver`: Storage type.
        *   `memory`: Store in the application's memory (data lost on restart).
        *   `file`: Store in a JSON file.
    *   `driverConfig`: Configuration for the selected driver.
        *   For `file`:
            *   `filePath`: Path to the file for storing bans (e.g., `./data/blocked_ips.json`).
            *   `locker`: File locking settings to prevent race conditions during writes.
                *   `enabled`: Enable (`true`) or disable (`false`) locking.
                *   `config`: Parameters for `proper-lockfile` (e.g., `retries`).
*   `syncInterval`: Interval (in milliseconds) for synchronizing data between memory and persistent storage (e.g., file). Default 5000 (5 seconds).
*   `syncAlways`: Synchronize data with storage after *every* ban addition (`true`) or only at the `syncInterval` (`false`). Default `false`.
*   `filterRules`: List of filter rules that can lead to a ban (see [Filter Rules](#filter-rules-filterrules)).

### ✉️ Static Lists (`whitelist`, `blacklist`)

Configuration for static whitelists and blacklists. Checked *before* `jailManager`.

*   `whitelist`:
    *   `enabled`: Enable (`true`) or disable (`false`).
    *   `ips`: List of allowed IP addresses or subnets (CIDR).
    *   `countries`: List of allowed country codes (ISO 3166-1 alpha-2, e.g., `US`, `GB`).
    *   `cities`: List of allowed city names.
    *   `linkUrl`: URL to load a list of allowed IPs in JSON format (array of strings).
    *   `updateInterval`: Interval (ms) for updating the list from `linkUrl`.
*   `blacklist`:
    *   `enabled`: Enable (`true`) or disable (`false`).
    *   `ips`, `countries`, `cities`, `linkUrl`, `updateInterval`: Similar to `whitelist`, but for blocking.

### Filter Rules (`filterRules`)

An array of rules used by `jailManager` to detect suspicious activity and ban IPs. Each rule is described by an object with the following fields:

*   `id`: Unique identifier for the rule (used in logs and metrics).
*   `type`: Rule type (`static`, `flexible`, `composite`).
*   `enabled`: Enable (`true`) or disable (`false`) the rule.
*   **Type-specific fields:** (See [Rule Types](#rule-types))

### Proxy (`proxy`)

Settings for running WAF as a reverse proxy.

*   `enabled`: Enable (`true`) or disable (`false`) proxy mode.
*   `host`: URL of your backend service to which verified requests will be proxied (e.g., `http://your-app:8080`).
*   `config`: Additional parameters for `http-proxy-middleware` (see library documentation).

### 🛡️ API (`api`)

Settings for the built-in REST API for managing the WAF.

*   `enabled`: Enable (`true`) or disable (`false`) the API.
*   `auth`: Basic authentication settings for the API (**cannot be set via environment variables**).
    *   `enabled`: Enable (`true`) or disable (`false`) authentication.
    *   `username`: Username.
    *   `password`: Password.

### 📝 Logging (`log`)

Logging settings using `@elementary-lab/logger`. Configured via YAML only.

*   `level`: Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).
*   `transport`: Transport type (e.g., `console`).
*   `transportConfig`: Transport configuration.

### 📊 Metrics (`metrics`)

Settings for exporting metrics in Prometheus format. Configured via YAML only.

*   `enabled`: Enable (`true`) or disable (`false`) metrics collection and export.
*   `path`: Path where metrics will be available (e.g., `/metrics`).

### Configuration Example

Example: [`config.example.yaml`](./config.example.yaml)

```yaml
detectClientIp:
  headers: ["x-forwarded-for", "cf-connecting-ip"]

jailManager:
  storage: file
  driverConfig:
    filePath: ./data/blocked_ips.json
    locker:
      enabled: true
      config:
        retries: 3
  filterRules: # Renamed from 'rules' in README example for clarity in this doc
    - id: static-blacklist-url
      type: "static"
      enabled: true
      linkUrl: "https://example.com/blacklist.json"
      updateInterval: 60000

    - id: composite-admin-bruteforce
      type: "composite"
      enabled: true
      keys: ["ip"] # Ban based on IP
      conditions:
        - field: "url"
          method: "equals"
          values: ["/admin"]
      limit: 10
      period: 60 # 10 requests per 60 seconds
      duration: 300 # Ban for 300 seconds (5 minutes)
      escalationRate: 1.5

api:
  enabled: true
  auth:
    enabled: true
    username: "admin"
    password: "admin"

proxy:
  enabled: true
  host: "http://your-app:8080"

log:
  level: 'info'
  transport: 'console'

metrics:
  enabled: true
  path: '/metrics'

geoip:
  countryPath: './GeoLite2-Country.mmdb'
  cityPath: './GeoLite2-City.mmdb'

# Whitelist/Blacklist example (part of wafMiddleware config node)
wafMiddleware:
  mode: 'normal' # or 'audit'
  whitelist:
    enabled: true
    ips: ["192.168.1.1", "10.0.0.0/16"]
    countries: ["DE"]
  blacklist:
    enabled: false

```

### 📦 Environment Variables

While most configuration is done via the YAML file, a few environment variables can influence the WAF's behavior, how it loads its configuration, or external integrations:

| Variable            | Description                                   | Default Value             | Corresponding YAML Parameter |
| :------------------ | :-------------------------------------------- | :------------------------ | :------------------------- |
| `WAF_CONFIG_TYPE`   | Configuration source type (`file` or `link`)  | `file`                    | -                          |
| `WAF_CONFIG_SOURCE` | Path to config file or URL                    | `./config.yaml`           | -                          |
| `SENTRY_DSN`        | DSN for Sentry integration                    | -                         | `sentry.dsn`               |
| `APP_VERSION`       | Application version tag for logs/Sentry       | `dev-dirty`               | -                          |
| `WAF_AUDIT`         | Enable request/response audit (legacy)        | `false`                   | -                          |
| `WAF_AUDIT_REQUEST` | Log incoming requests if audit enabled (legacy)| `false`                   | -                          |
| `WAF_AUDIT_RESPONSE`| Log outgoing responses if audit enabled (legacy)| `false`                   | -                          |

*(Note: The `WAF_AUDIT_*` variables control a legacy audit mechanism. More detailed logging is configured via the `log` section in the YAML file).*

---

## 🏛️ Architecture

### Overview

The WAF is built on Node.js and the Express.js framework. The core logic is implemented as an Express middleware (`WAFMiddleware`), which intercepts incoming requests before they reach the main application (if proxy mode is used) or other handlers.

### Request Processing Flow

1.  **Incoming Request:** Arrives at the Express server.
2.  **`WAFMiddleware`:**
    *   Detects client IP, country, city.
    *   **Whitelist Check:** If the client is on the whitelist, the request is passed on (to the proxy or next middleware).
    *   **Blacklist Check:** If the client is on the blacklist, the request is rejected (or logged in `audit` mode).
    *   **`JailManager` Check:**
        *   Checks if the client's IP is already banned. If yes, the request is rejected.
        *   The request is checked against all active `filterRules`.
        *   If a `static` or `flexible` rule (requiring immediate block) is triggered, the request is rejected.
        *   If a `composite` rule (e.g., request limit exceeded) is triggered, the client's IP is banned (`JailManager.blockIp`), and the request is rejected.
    *   **Pass Request:** If no rule triggered and the IP is not banned, the request is passed on.
3.  **Proxying (if enabled):** The request is forwarded to the backend service specified in `proxy.host`.
4.  **Response:** The response from the backend (or generated by WAF on block) is sent to the client.

### Key Components

#### `WAFMiddleware` (`src/WAFMiddleware.ts`)

*   The main Express middleware.
*   Orchestrates the request verification process: IP/Geo detection, Whitelist/Blacklist check, `JailManager` invocation.
*   Initializes and uses `Whitelist`, `Blacklist`, `JailManager`, `GeoIP2`, `Metrics`.
*   Sends an error response (429 Too Many Requests) or passes the request along.
*   Manages `normal`/`audit` modes.

#### `JailManager` (`src/Jail/JailManager.ts`)

*   Responsible for managing the list of banned IP addresses.
*   Loads and applies rules from `filterRules`.
*   Interacts with the ban storage (`JailStorageInterface`).
*   Implements banning (`blockIp`), checking (`check`), unbanning (`deleteBlockedIp`), and escalation logic.
*   Collects metrics related to bans.

#### Rules (`src/Jail/Rules/`)

*   Abstractions for different types of filter rules.
*   **`AbstractRule`:** Base class for all rules.
*   **`StaticRule`:** Simply blocks an IP based on a static list (loaded via URL).
*   **`FlexibleRule`:** Blocks based on matching specific request fields (URL, User-Agent, method, etc.) against predefined values.
*   **`CompositeRule`:** Tracks the number of requests matching certain criteria (`conditions`), grouped by keys (`keys` - e.g., IP, User-Agent), over a specific period (`period`). If the limit (`limit`) is exceeded, the IP is banned for `duration` seconds.

#### Jail Storage (`src/Jail/`)

*   **`JailStorageInterface`:** Interface for ban storage.
*   **`JailStorageMemory`:** In-memory storage implementation.
*   **`JailStorageFile`:** JSON file storage implementation using `proper-lockfile` for safe writes.

#### `ConfigLoader` (`src/ConfigLoader.ts`)

*   Loads configuration from a file or URL based on `WAF_CONFIG_TYPE` and `WAF_CONFIG_SOURCE`.

#### `Api` (`src/Api.ts`)

*   Implements REST API endpoints for managing the WAF (viewing bans, unbanning).
*   Sets up Basic authentication based on YAML config.

#### `GeoIP2` (`src/GeoIP2.ts`)

*   Wrapper for working with MaxMind GeoIP2 databases (`.mmdb`). Paths configured via YAML.
*   Provides methods to get country and city from an IP.

#### `Log` (`src/Log.ts`) / `Sentry` (`src/Sentry.ts`)

*   Configures and provides a logger instance (`@elementary-lab/logger`) based on YAML config.
*   Initializes and integrates with Sentry using `SENTRY_DSN` or YAML config.

#### `Metrics` (`src/Metrics/Metrics.ts`)

*   Configures and manages Prometheus metrics (`prom-client`) based on YAML config.
*   Registers metrics from various components (`WAFMiddleware`, `JailManager`).
*   Provides an endpoint for scraping metrics (path configured via YAML).

---

## 💡 Core Concepts

### Operating Modes (`normal`/`audit`)

*   **`normal`:** WAF actively blocks requests that violate rules.
*   **`audit`:** WAF only logs rule violations but allows all requests to pass through. This is useful for testing rule configurations without impacting users. Controlled by the `mode` parameter in the configuration.

### Jail Mechanism

*   When a rule (`filterRules`) identifies a request as malicious or exceeding limits, `JailManager` can ban the client's IP address.
*   Banned IPs are stored with an unban timestamp (`unbanTime`).
*   `JailManager` periodically (or always, if `syncAlways: true`) synchronizes its internal ban list with the configured storage (file or memory).
*   Before processing rules, `JailManager` checks if the IP is already banned.

### Ban Escalation

*   For rules that support escalation (e.g., `CompositeRule`), the ban duration can increase upon repeated violations from the same IP.
*   `JailManager` tracks the number of violations (`escalationCount`) for each IP.
*   The ban time is calculated using the formula: `new_ban_time = base_duration * (escalation_rate ^ violation_count)`.
    *   `base_duration` (`duration` in the rule)
    *   `escalation_rate` (`escalationRate` in the rule, e.g., 1.5)
    *   `violation_count` (`escalationCount` in `BanInfo`)

### Rule Types

Rules are defined in the `jailManager.filterRules` section of the configuration file.

#### Static

*   **`type: "static"`**
*   Simply checks the IP address against a list loaded from an external source.
*   **Parameters:**
    *   `linkUrl`: URL of a JSON file containing a list of IP addresses to block (array of strings).
    *   `updateInterval`: List update interval (ms).

#### Flexible

*   **`type: "flexible"`**
*   Blocks the request if specific request field values match defined conditions. Triggering this rule typically leads to an *immediate* block of the request but *does not* add the IP to the `JailManager` (i.e., it's more like a dynamic blacklist based on request properties).
*   **Parameters:**
    *   `conditions`: Array of conditions. Each condition:
        *   `field`: Request field (`ip`, `country`, `city`, `url`, `user-agent`, `method`, `header:<name>`).
        *   `method`: Comparison method (`equals`, `notEquals`, `contains`, `notContains`, `regex`).
        *   `values`: Array of values to compare against.

#### Composite

*   **`type: "composite"`**
*   The most complex rule type, designed for detecting flooding or scanning. Tracks the frequency of requests matching specific criteria.
*   **Parameters:**
    *   `keys`: Array of request fields to group counts by (e.g., `["ip"]` for a per-IP limit, `["ip", "url"]` for a limit on a specific URL from one IP). Valid values: `ip`, `country`, `city`, `url`, `user-agent`, `method`, `header:<name>`.
    *   `conditions`: Array of conditions (similar to `FlexibleRule`) that a request must meet to be counted.
    *   `limit`: Maximum number of requests allowed within the `period`.
    *   `period`: Time window (in seconds) for counting requests.
    *   `duration`: Ban duration (in seconds) when `limit` is exceeded.
    *   `escalationRate`: Ban escalation factor (e.g., 1.5). If 1.0, there is no escalation.

### 🌍 Geolocation Detection

*   WAF uses local MaxMind GeoIP2 databases (`.mmdb`) to determine the country and city based on an IP address.
*   Database paths are set in the `geoip` configuration section (YAML only).
*   Geo-data is used for:
    *   Whitelist/Blacklist checks by country/city.
    *   Conditions in rules (`FlexibleRule`, `CompositeRule`).
    *   Enriching data in logs and metrics.

---

## 🧰 API Reference

If enabled (`api.enabled: true`), the WAF provides a REST API for management.

### Authentication

Uses HTTP Basic Authentication if enabled (`api.auth.enabled: true`). Username and password are set in the YAML config (`api.auth.username` and `api.auth.password`).

### Endpoints

All endpoints are prefixed with `/waf`

#### `GET /waf/healthz`

*   **Method:** `GET`
*   **Endpoint:** `/waf/healthz`
*   **Auth:** `❌` (No)
*   **Description:** Checks the service health. Returns `Hello from WAF server!`.

#### `GET /waf/jail-manager/baned-users`

*   **Method:** `GET`
*   **Endpoint:** `/waf/jail-manager/baned-users`
*   **Auth:** `✅` (Yes, if enabled)
*   **Description:** Get the list of all active bans from `JailManager`.
*   **Response (`200 OK`):**
    ```json
    [
      {
        "ip": "1.2.3.4",
        "unbanTime": 1678886400000, // Timestamp in ms
        "escalationCount": 0,
        "metadata": {
          "ruleId": "composite-login-bruteforce",
          "country": "US",
          "city": "Mountain View",
          "requestIds": "req-1,req-2"
        }
      },
      // ...
    ]
    ```

#### `DELETE /waf/jail-manager/baned-users`

*   **Method:** `DELETE`
*   **Endpoint:** `/waf/jail-manager/baned-users`
*   **Auth:** `✅` (Yes, if enabled)
*   **Description:** Remove the ban for a specific IP address.
*   **Request Body (JSON):**
    ```json
    {
      "ip": "1.2.3.4"
    }
    ```
*   **Response:**
    *   `200 OK`: Ban successfully removed. `{"status": "ok"}`
    *   `404 Not Found`: IP address not found. `{"status": "error", "message": "User not found"}`
    *   `400 Bad Request`: Invalid request.

---

## 🚢 Deployment

### Docker

Using Docker is the recommended deployment method. Use `.docker/prod.Dockerfile` to build a production-ready image.

*   **Configuration:** Pass `config.yaml` via a volume. Ensure paths within the configuration (`filePath` for Jail, `countryPath`/`cityPath` for GeoIP) match the paths inside the container.
*   **Data:** If using `jailManager.storage.driver: file`, mount a volume for the ban file (e.g., `/app/data`).
*   **GeoIP Databases:** Mount a volume with the `.mmdb` files (e.g., to `/app/geoip_data`) and ensure the paths in `config.yaml` (`geoip.countryPath`, `geoip.cityPath`) point to these mounted files.
*   **Ports:** Expose the required port (default 3000).

### General Recommendations

*   **High Availability:** Run multiple WAF instances behind a load balancer.
*   **Ban Storage:** When using multiple instances and `jailManager.storage.driver: file`, ensure all instances use the *same shared file* (e.g., on network storage like NFS). Otherwise, a ban issued by one instance will not be visible to others. Consider alternative storage backends (like Redis - *not yet implemented*) if better consistency is required.
*   **GeoIP Updates:** Regularly update the GeoIP databases for accurate geolocation.
*   **Monitoring:** Set up Prometheus metrics scraping and use the Grafana dashboard to monitor WAF health.

---

## 📊 Monitoring

### Prometheus Metrics

If enabled (`metrics.enabled: true`), the WAF exposes metrics in Prometheus format at the path specified in the YAML config (`metrics.path`, default `/metrics`).

Main metric groups:

*   **`waf_middleware_*`:** Metrics related to the core Middleware operation (whitelist/blacklist checks, overall bans).
*   **`waf_jail_*`:** Metrics related to `JailManager` operation (bans per rule, storage status).
*   **Standard `prom-client` metrics:** (`process_*`, `nodejs_*`).

Use these metrics to monitor the number of blocks, rule effectiveness, WAF load, and ban storage status.

### Grafana Dashboard

The `docs/` directory contains the file `waf_grafana_dashboard.json`. This JSON can be imported into Grafana to get a pre-built dashboard visualizing key WAF metrics.

**Importing the Dashboard:**

1.  In Grafana, go to Dashboards -> Import.
2.  Click "Upload JSON file" and select `waf_grafana_dashboard.json`, or paste its content into the text box.
3.  Select your Prometheus data source.
4.  Click "Import".

The dashboard will show graphs for blocked requests, rule triggers, number of IPs in jail, etc.

---

## 🧑‍💻 Development

### Prerequisites

*   NodeJS v22
*   GeoIP Database (`.mmdb` files)

### Environment Setup

1.  Install [Requirements](#requirements) (Node.js, npm).
2.  Clone the repository.
3.  Install dependencies: `npm install`.
4.  Create `config.yaml` from `config.example.yaml`.
5.  Download and store `GeoLite2-Country.mmdb` and `GeoLite2-City.mmdb` in project root (or configure paths in `config.yaml`). You can use test files from [P3TERX/GeoLite.mmdb](https://github.com/P3TERX/GeoLite.mmdb).

### ✅ Running Tests

*   **Run all tests:**
    ```bash
    npm test
    ```
*   **Run tests with coverage report:**
    ```bash
    npm run test:cov
    ```
    The report will be generated in the `coverage/` folder.

Tests are located in the `test/` directory (`unit/` for unit tests). The Jest framework is used.

### Building the Project

To create a production build (compile TypeScript to JavaScript):

```bash
npm run build
```

Compiled files will appear in the `dist/` directory. You can run the built application using:

```bash
node dist/main.js
```

### Project Structure

*   **`src/`**: Main source code.
    *   `main.ts`: Application entry point.
    *   `WAFMiddleware.ts`: WAF core.
    *   `Jail/`: Logic and storage for the ban system.
    *   `Jail/Rules/`: Filter rule implementations.
    *   `Static/`: Whitelist/Blacklist implementation.
    *   `Api.ts`: REST API.
    *   `ConfigLoader.ts`: Configuration loading.
    *   `GeoIP2.ts`: GeoIP handling.
    *   `Log.ts`, `Sentry.ts`: Logging and Sentry.
    *   `Metrics/`: Metrics setup and export.
    *   `Utils/`: Utility functions.
*   **`test/`**: Unit tests.
*   **`scripts/`**: Build scripts, etc.
*   **`docs/`**: Additional documentation, resources (Grafana dashboard).
*   **`.docker/`**: Dockerfiles for building images.
*   **`.github/`**: GitHub Actions configuration (CI/CD), Dependabot.
*   **Root folder:** Configuration files, `README.md`, `LICENSE`, etc.

### 🤝 Contribution Guide (TODO)

*   Code style (ESLint, Prettier - configured).
*   Process for adding new rules.
*   Pull Request requirements.
*   How to write and run tests.

---

## 📄 License

This project is licensed under the [GNU License](./LICENSE).

---

## 📊 Dependencies

*   `express`
*   `http-proxy-middleware`
*   `maxmind` (or the specific library used for GeoIP lookup)
*   `js-yaml`
*   `@elementary-lab/logger`
*   `proper-lockfile`
*   `prom-client`
*   (Potentially others from `package.json`)