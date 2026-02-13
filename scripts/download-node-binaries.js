const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = 'v22.12.0'; // Match package.json engines requirement
const BINARIES_DIR = path.join(__dirname, '../.node-binaries');
const BIN_DIR = path.join(__dirname, '../bin');

const PLATFORMS = [
  {
    name: 'linux',
    url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz`,
    extractPath: `node-${NODE_VERSION}-linux-x64/bin/node`,
    output: 'node-linux'
  },
  {
    name: 'macos',
    url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-x64.tar.gz`,
    extractPath: `node-${NODE_VERSION}-darwin-x64/bin/node`,
    output: 'node-macos'
  },
  {
    name: 'windows',
    url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`,
    extractPath: `node-${NODE_VERSION}-win-x64/node.exe`,
    output: 'node-win.exe'
  }
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function extractAndCopy(platform) {
  const archivePath = path.join(BINARIES_DIR, path.basename(platform.url));
  const extractDir = path.join(BINARIES_DIR, platform.name);
  const outputPath = path.join(BINARIES_DIR, platform.output);

  console.log(`Extracting ${platform.name}...`);

  // Create extraction directory
  fs.mkdirSync(extractDir, { recursive: true });

  // Extract based on format
  if (platform.url.endsWith('.tar.xz')) {
    execSync(`tar -xJf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
  } else if (platform.url.endsWith('.tar.gz')) {
    execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
  } else if (platform.url.endsWith('.zip')) {
    execSync(`unzip -q "${archivePath}" -d "${extractDir}"`, { stdio: 'inherit' });
  }

  // Copy node binary to root of binaries dir
  const sourcePath = path.join(extractDir, platform.extractPath);
  fs.copyFileSync(sourcePath, outputPath);
  fs.chmodSync(outputPath, 0o755);

  console.log(`✓ ${platform.name} binary ready at ${outputPath}`);
}

async function main() {
  // Create directories
  fs.mkdirSync(BINARIES_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });

  console.log(`Downloading Node.js ${NODE_VERSION} binaries...\n`);

  for (const platform of PLATFORMS) {
    const archivePath = path.join(BINARIES_DIR, path.basename(platform.url));
    const outputPath = path.join(BINARIES_DIR, platform.output);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`✓ ${platform.name} binary already exists`);
      continue;
    }

    console.log(`Downloading ${platform.name} from ${platform.url}...`);
    await downloadFile(platform.url, archivePath);
    console.log(`✓ Downloaded ${platform.name}`);

    await extractAndCopy(platform);

    // Cleanup archive
    fs.unlinkSync(archivePath);
  }

  console.log('\n✓ All Node.js binaries downloaded successfully');
}

main().catch(console.error);
