Web Application Firewall


![Build App](https://github.com/SomeBlackMagic/WebApplicationFirewall/actions/workflows/build.yaml/badge.svg)
[![codecov](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall/graph/badge.svg?token=045DKMM46F)](https://codecov.io/gh/SomeBlackMagic/WebApplicationFirewall)
[![Github Repo Size](https://img.shields.io/github/repo-size/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall)
![GitHub License](https://img.shields.io/github/license/SomeBlackMagic/WebApplicationFirewall)
![GitHub Release](https://img.shields.io/github/v/release/SomeBlackMagic/WebApplicationFirewall)
[![Contributors](https://img.shields.io/github/contributors/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall/graphs/contributors)
[![Commit](https://img.shields.io/github/last-commit/SomeBlackMagic/WebApplicationFirewall.svg)](https://github.com/SomeBlackMagic/WebApplicationFirewall/commits/master)



Run local:
Before run you need to download GeoIP2 database and store files in work dir:
https://github.com/P3TERX/GeoLite.mmdb
Run in project home directory


## Configuration

Application load configuration on start.
Configuration can be load from file in local file system and fetch from remote server.
By default, configuration load fom file ```config.yaml``` in pwd folder.

Env variable for configure the application:

| Variable        | Desctiontion                                | Default value |
| --------------- |---------------------------------------------| ------------- |
| WAF_CONFIG_TYPE | How to load configuration. 'file' or 'link' | file          |
| WAF_CONFIG_FILE | Link on file system or http href            |               |
