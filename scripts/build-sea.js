const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const BINARIES_DIR = path.join(PROJECT_ROOT, '.node-binaries');
const BIN_DIR = path.join(PROJECT_ROOT, 'bin');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

const PLATFORMS = [
  {
    name: 'linux',
    seaConfig: 'sea-config-linux.json',
    nodeBinary: 'node-linux',
    blobFile: 'sea-prep-linux.blob',
    outputBinary: 'waf-linux',
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    requiresSigning: false
  },
  {
    name: 'macos',
    seaConfig: 'sea-config-macos.json',
    nodeBinary: 'node-macos',
    blobFile: 'sea-prep-macos.blob',
    outputBinary: 'waf-macos',
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    requiresSigning: true
  },
  {
    name: 'windows',
    seaConfig: 'sea-config-win.json',
    nodeBinary: 'node-win.exe',
    blobFile: 'sea-prep-win.blob',
    outputBinary: 'waf-win.exe',
    sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    requiresSigning: true
  }
];

function exec(command, options = {}) {
  console.log(`> ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

function buildPlatform(platform) {
  console.log(`\n========================================`);
  console.log(`Building ${platform.name.toUpperCase()} binary`);
  console.log(`========================================\n`);

  const seaConfigPath = path.join(PROJECT_ROOT, platform.seaConfig);
  const nodeBinarySource = path.join(BINARIES_DIR, platform.nodeBinary);
  const outputBinaryPath = path.join(BIN_DIR, platform.outputBinary);
  const blobPath = path.join(PROJECT_ROOT, platform.blobFile);

  // Verify prerequisites
  if (!fs.existsSync(nodeBinarySource)) {
    throw new Error(`Node binary not found: ${nodeBinarySource}. Run 'npm run build:prepare-node' first.`);
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'main.js'))) {
    throw new Error(`Bundled application not found. Run 'npm run build' first.`);
  }

  // Step 1: Generate SEA blob
  console.log(`[1/4] Generating SEA blob for ${platform.name}...`);
  exec(`node --experimental-sea-config "${seaConfigPath}"`);

  if (!fs.existsSync(blobPath)) {
    throw new Error(`Failed to generate blob: ${blobPath}`);
  }
  console.log(`✓ Blob generated: ${blobPath}`);

  // Step 2: Copy Node binary
  console.log(`[2/4] Copying Node.js binary...`);
  fs.copyFileSync(nodeBinarySource, outputBinaryPath);
  fs.chmodSync(outputBinaryPath, 0o755);
  console.log(`✓ Binary copied to: ${outputBinaryPath}`);

  // Step 3: Inject SEA blob using postject
  console.log(`[3/4] Injecting SEA blob into binary...`);

  const postjectArgs = [
    outputBinaryPath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse', platform.sentinelFuse
  ];

  // macOS requires different signing approach
  if (platform.name === 'macos') {
    postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  }

  try {
    exec(`npx postject ${postjectArgs.map(arg => `"${arg}"`).join(' ')}`);
    console.log(`✓ Blob injected successfully`);
  } catch (error) {
    console.error(`Failed to inject blob for ${platform.name}:`, error.message);
    throw error;
  }

  // Step 4: Sign binary (platform-specific)
  console.log(`[4/4] Signing binary...`);

  if (platform.name === 'macos') {
    signMacOS(outputBinaryPath);
  } else if (platform.name === 'windows') {
    signWindows(outputBinaryPath);
  } else {
    console.log(`✓ No signing required for ${platform.name}`);
  }

  // Cleanup blob file
  if (fs.existsSync(blobPath)) {
    fs.unlinkSync(blobPath);
  }

  console.log(`\n✓ ${platform.name.toUpperCase()} binary built successfully: ${outputBinaryPath}\n`);
}

function signMacOS(binaryPath) {
  // Check if running on macOS
  if (process.platform === 'darwin') {
    try {
      // Ad-hoc signing (sufficient for development and most distribution)
      exec(`codesign --sign - --force "${binaryPath}"`);
      console.log(`✓ macOS binary signed (ad-hoc)`);
    } catch (error) {
      console.warn(`⚠ Warning: Could not sign macOS binary: ${error.message}`);
      console.warn(`Binary may not run on macOS with certain security settings`);
    }
  } else {
    // Running on Linux - skip macOS-specific signing
    console.log(`⚠ Warning: Building macOS binary on ${process.platform}`);
    console.log(`⚠ Binary will need to be signed on macOS before distribution`);
    console.log(`⚠ Use: codesign --sign - --force waf-macos`);
  }
}

function signWindows(binaryPath) {
  // Windows signing requires signtool.exe and certificates
  // This is typically only available on Windows or with specific tooling
  if (process.platform === 'win32') {
    try {
      // Check if signtool is available
      execSync('where signtool.exe', { stdio: 'ignore' });

      // Note: Actual signing requires a certificate
      // This is a placeholder - real implementation needs certificate setup
      console.log(`⚠ Warning: Windows code signing not configured`);
      console.log(`Binary will work but may show security warnings`);
    } catch (error) {
      console.log(`⚠ signtool.exe not found - skipping Windows signing`);
    }
  } else {
    console.log(`⚠ Warning: Building Windows binary on ${process.platform}`);
    console.log(`⚠ Binary may show security warnings without signing`);
    console.log(`⚠ Consider using osslsigncode on Linux or sign on Windows`);
  }
}

function main() {
  console.log('Starting SEA build process...\n');

  // Ensure bin directory exists
  fs.mkdirSync(BIN_DIR, { recursive: true });

  // Build for all platforms
  for (const platform of PLATFORMS) {
    try {
      buildPlatform(platform);
    } catch (error) {
      console.error(`\n❌ Failed to build ${platform.name} binary:`, error.message);
      process.exit(1);
    }
  }

  console.log('========================================');
  console.log('✓ All binaries built successfully!');
  console.log('========================================\n');

  // Display binary information
  console.log('Generated binaries:');
  PLATFORMS.forEach(platform => {
    const binaryPath = path.join(BIN_DIR, platform.outputBinary);
    const stats = fs.statSync(binaryPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  - ${platform.outputBinary}: ${sizeMB} MB`);
  });
}

main();
