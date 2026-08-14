const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packagePath = path.resolve('package.json');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function incrementPatch(version) {
  const parts = version.split('.').map(Number);

  parts[2]++;

  return parts.join('.');
}

const oldVersion = packageJson.version;

const newVersion = incrementPatch(oldVersion);

packageJson.version = newVersion;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version updated: ${oldVersion} -> ${newVersion}`);

// Build
execSync('npm run compile', { stdio: 'inherit' });

// Generate VSIX
execSync('npx vsce package', { stdio: 'inherit' });

// Find generated file

const files = fs.readdirSync('.').filter(file => file.endsWith('.vsix'));

if (files.length === 0) {
  throw new Error('VSIX file not found');
}

const vsix = files[0];

const releasesFolder = path.resolve('releases');

if (!fs.existsSync(releasesFolder)) {
  fs.mkdirSync(releasesFolder);
}

const destination = path.join(releasesFolder, `codecortex-v${newVersion}.vsix`);

fs.renameSync(vsix, destination);

console.log(`Release created: ${destination}`);
