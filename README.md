# Web Application Firewall


![Build App](https://github.com/SomeBlackMagic/WebApplicationFirewall/actions/workflows/build.yaml/badge.svg)
[![codecov](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall/graph/badge.svg?token=045DKMM46F)](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall)
[![Github Repo Size](https://img.shields.io/github/repo-size/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall)
![GitHub License](https://img.shields.io/github/license/SomeBlackMagic/WebApplicationFirewall)
![GitHub Release](https://img.shields.io/github/v/release/SomeBlackMagic/WebApplicationFirewall)
[![Contributors](https://img.shields.io/github/contributors/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall/commits/master)

## Configuration

Application load configuration on start.
Configuration can be load from file in local file system and fetch from remote server.
By default, configuration load fom file ```config.yaml``` in pwd folder.

Env variable for configure the application:

| Variable        | Desctiontion                                | Default value |
| --------------- |---------------------------------------------| ------------- |
| WAF_CONFIG_TYPE | How to load configuration. 'file' or 'link' | file          |
| WAF_CONFIG_FILE | Link on file system or http href            |               |



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
