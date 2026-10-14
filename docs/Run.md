```
docker pull ghcr.io/someblackmagic/web-application-firewall:latest
docker run -p 127.0.0.1:3000:3000 -v $(pwd)/config.yaml:/app/config.yaml ghcr.io/someblackmagic/web-application-firewall:latest
```
