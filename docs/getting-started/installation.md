# Installation

This guide covers the installation requirements and steps for setting up the Web Application Firewall.

## Requirements

### Node.js and npm

- **Node.js**: Version 22 or higher
- **npm**: Usually comes bundled with Node.js

Check your Node.js version:

```bash
node --version
# Should output v22.x.x or higher
```

Check your npm version:

```bash
npm --version
```

### GeoIP Databases

The WAF requires MaxMind GeoLite2 databases for geolocation features:

- `GeoLite2-Country.mmdb`
- `GeoLite2-City.mmdb`

You can obtain these databases from:

1. **MaxMind** - Free GeoLite2 databases (requires account)
   - Visit https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
   - Create a free account
   - Download the databases

2. **Alternative source** - Pre-built databases
   - [P3TERX/GeoLite.mmdb](https://github.com/P3TERX/GeoLite.mmdb)
   - Download the latest release

### System Requirements

**Minimum:**
- RAM: 512MB
- CPU: 1 core
- Disk: 100MB

**Recommended for production:**
- RAM: 2GB or more
- CPU: 2 cores or more
- Disk: 1GB (for logs and ban storage)

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/SomeBlackMagic/WebApplicationFirewall.git
cd WebApplicationFirewall
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies listed in `package.json`.

### 3. Download GeoIP Databases

Place the GeoIP database files in the project root or in a dedicated directory:

```bash
# Example: Create a geoip_data directory
mkdir geoip_data
cd geoip_data

# Download the databases (example using P3TERX repo)
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb
wget https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

cd ..
```

### 4. Create Configuration File

Copy the example configuration and customize it:

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` to match your environment. At minimum, ensure the GeoIP database paths are correct:

```yaml
geoip:
  countryPath: './geoip_data/GeoLite2-Country.mmdb'
  cityPath: './geoip_data/GeoLite2-City.mmdb'
```

For more details on configuration, see the [Configuration Guide](../configuration/README.md).

## Verify Installation

Test that everything is installed correctly:

```bash
# Check that dependencies are installed
npm list --depth=0

# Verify GeoIP databases exist
ls -lh geoip_data/*.mmdb
```

## Next Steps

- Continue to [Quick Start](quick-start.md) to run the WAF
- Or learn about [First Configuration](first-configuration.md) for detailed setup
- For Docker installation, see [Running with Docker](running-with-docker.md)

## Troubleshooting

### Node.js version issues

If you have an older version of Node.js, consider using [nvm](https://github.com/nvm-sh/nvm) to manage multiple versions:

```bash
# Install nvm (Linux/macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 22
nvm install 22
nvm use 22
```

### GeoIP database download fails

If you can't download databases directly:
1. Download manually from the browser
2. Place files in the appropriate directory
3. Ensure file permissions are readable: `chmod 644 geoip_data/*.mmdb`

### npm install errors

If you encounter errors during `npm install`:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

For more troubleshooting help, see the [Troubleshooting Guide](../guides/troubleshooting.md).
