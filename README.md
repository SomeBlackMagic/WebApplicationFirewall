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


Minimal configuration for run application:

```yaml
proxy:
    host: "http://your-app:8080"

wafMiddleware:
  mode: normal

  blacklist:
    ips: [ '10.0.0.1', '10.0.0.2' ]

```

Application load configuration on start.
Configuration can be load from file in local file system and fetch from remote server.
By default, configuration load fom file ```config.yaml``` in pwd folder.

Env variable for configure the application:

| Variable          | Desctiontion                                | Default value |
|-------------------|---------------------------------------------| ------------- |
| WAF_CONFIG_TYPE   | How to load configuration. 'file' or 'link' | file          |
| WAF_CONFIG_SOURCE | Link on file system or http href            |               |

## 🚀 Running

You can run application using one of methods: binary, docker

### Preparing
If toy want to use GeoIP2 database for detected client geo you need to download GeoIP2-City.mmdb and GeoIP2-Country.mmdb,
and store in data folder(mount in docker container, move to /var/lib/waf)

### Prepear running Binary
You need to download latest version from release page
```shell
wget https://github.com/SomeBlackMagic/WebApplicationFirewall/releases/latest/download/waf-linux-x64
chmod +x waf-linux-x64
mv waf-linux-x64 /usr/local/bin/waf
```
Then [configure env variables](#-environment-variables) and export in shell or store in /etc/waf/env_vars
if you wnt to run application as [systemd service](docs/waf.service).

### Prepare running docker
Download latest stable version of docker image
```shell
docker pull ghcr.io/someblackmagic/web-application-firewall:v1.0.0
```

### Running in docker container
```
docker run \
  -p 3000:3000 \
  -e WAF_LOG_DEBUG=true \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/GeoIP2-City.mmdb:/app/GeoIP2-City.mmdb \
  -v $(pwd)/GeoIP2-Country.mmdb:/app/GeoIP2-Country.mmdb \
  ghcr.io/someblackmagic/web-application-firewall:v1.0.0
```

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

| Variable                | Description                   |
|-------------------------|-------------------------------|
| `WAF_CONFIG_SOURCE`     | Path to config YAML or URL    |
| `WAF_CONFIG_TYPE`       | `file` or `link`              |
| `WAF_LOG_DEBUG`         | Enable debug logs             |
| `WAF_AUDIT`             | Enable request auditing       |
| `WAF_AUDIT_REQUEST`     | Log incoming requests         |
| `WAF_AUDIT_RESPONSE`    | Log outgoing responses        |
| `WAF_AUDIT_RESPONSE`    | Log outgoing responses        |


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
- ~~Prometheus metrics support~~

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
