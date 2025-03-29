# Web Application Firewall


![Build App](https://github.com/SomeBlackMagic/WebApplicationFirewall/actions/workflows/build.yaml/badge.svg)
[![codecov](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall/graph/badge.svg?token=045DKMM46F)](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall)
[![Github Repo Size](https://img.shields.io/github/repo-size/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall)
![GitHub License](https://img.shields.io/github/license/SomeBlackMagic/WebApplicationFirewall)
![GitHub Release](https://img.shields.io/github/v/release/SomeBlackMagic/WebApplicationFirewall)

Modular and configurable WAF server written in TypeScript using Express.js.

## ✨ Features

- ⚖️ Flexible blocking rules:
    - Static IP blacklists
    - Behavioral filters (based on URL, user-agent, geolocation)
    - Composite rules with request limits

- ⛔ Jail system:
    - Temporary IP banning with escalation
    - In-memory or file-based storage
    - GeoIP-based location resolution

- ✉️ Whitelist support:
    - By IP, subnet, country, and city

- 💾 Configuration via YAML or URL
- 🛡️ REST API for managing bans
- 🔎 Optional request auditing via ENV
- ⚙️ Proxy support for backend services


## Configuration


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

rules:
  - type: "static"
    linkUrl: "https://example.com/blacklist.json"
    updateInterval: 60000

  - type: "composite"
    keys: ["ip", "user-agent", "url"]
    conditions:
      - field: "url"
        method: "equals"
        values: ["/admin"]
    limit: 10
    period: 60
    duration: 300

api:
  auth:
    enabled: true
    username: "admin"
    password: "admin"

proxy:
  host: "http://your-app:8080"
```

Application load configuration on start.
Configuration can be load from file in local file system and fetch from remote server.
By default, configuration load fom file ```config.yaml``` in pwd folder.

Env variable for configure the application:

| Variable        | Desctiontion                                | Default value |
| --------------- |---------------------------------------------| ------------- |
| WAF_CONFIG_TYPE | How to load configuration. 'file' or 'link' | file          |
| WAF_CONFIG_FILE | Link on file system or http href            |               |

## 🚀 Running

### Install dependencies
```bash
npm install
node ./node_modules/.bin/ts-node src/main.ts
```



## 🧰 API Endpoints

| Method | Endpoint                        | Auth  | Description             |
|--------|---------------------------------|-------|-------------------------|
| GET    | `/waf/healthz`                  | ❌     | Health check            |
| GET    | `/waf/jail-manager/baned-users` | ✅     | List of banned IPs      |
| DELETE | `/waf/jail-manager/baned-users` | ✅     | Unban IP                |

---

## 📦 Environment Variables

| Variable                | Description                          |
|-------------------------|--------------------------------------|
| `WAF_CONFIG_FILE`       | Path to config YAML or URL           |
| `WAF_CONFIG_TYPE`       | `file` or `link`                     |
| `WAF_LOG_DEBUG`         | Enable debug logs                    |
| `WAF_AUDIT`             | Enable request auditing              |
| `WAF_AUDIT_REQUEST`     | Log incoming requests                |
| `WAF_AUDIT_RESPONSE`    | Log outgoing responses               |

---

## 📊 Dependencies

- `express`
- `http-proxy-middleware`
- `maxmind/geoip2`
- `js-yaml`
- `@elementary-lab/logger`
- `proper-lockfile`

---

## 🔭 TODO / Ideas

- Web UI for managing jail and rules
- Redis storage backend
- JWT-based authentication
- Prometheus metrics support

---

## Development
### Prerequisites
- NodeJS v22
- GeoIP Database

### Build and run locally
- Copy config.example.yaml to config.yaml in project root
- Download and store GeoIP2-Country.mmdb and GeoIP2-City.mmdb in project root
  - You can use this files for testing (https://github.com/P3TERX/GeoLite.mmdb)


```shell
npm install
node ./node_modules/.bin/ts-node src/main.ts
```

## ✅ License

[GNU](./LICENSE)
