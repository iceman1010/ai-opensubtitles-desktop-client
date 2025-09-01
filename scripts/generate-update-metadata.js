const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packageJson = require('../package.json');

// Function to calculate SHA512 hash of a file
function calculateSHA512(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha512');
    hashSum.update(fileBuffer);
    return hashSum.digest('base64');
}

// Function to get file size
function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
}

// Generate update metadata files
function generateUpdateMetadata() {
    const releaseDir = path.join(__dirname, '../release');
    const version = packageJson.version;
    
    // Check if release directory exists
    if (!fs.existsSync(releaseDir)) {
        console.log('Release directory not found. Run build first.');
        return;
    }

    const files = fs.readdirSync(releaseDir);
    let metadataGenerated = false;
    
    // Generate latest-linux.yml
    const debFile = files.find(f => f.endsWith('.deb'));
    
    // Find the most recent AppImage file (prefer the one without version suffix)
    const appImageFiles = files.filter(f => f.endsWith('.AppImage'));
    const appImageFile = appImageFiles.find(f => f === 'AI.Opensubtitles.com Client.AppImage') || 
                         appImageFiles.sort((a, b) => fs.statSync(path.join(releaseDir, b)).mtime - fs.statSync(path.join(releaseDir, a)).mtime)[0];
    
    if (appImageFile) {
        const appImagePath = path.join(releaseDir, appImageFile);
        const appImageSha512 = calculateSHA512(appImagePath);
        const appImageSize = getFileSize(appImagePath);
        
        const linuxYml = `version: ${version}
files:
  - url: ${appImageFile}
    sha512: ${appImageSha512}
    size: ${appImageSize}
path: ${appImageFile}
sha512: ${appImageSha512}
releaseDate: '${new Date().toISOString()}'
`;
        
        fs.writeFileSync(path.join(releaseDir, 'latest-linux.yml'), linuxYml);
        console.log('Generated latest-linux.yml');
        metadataGenerated = true;
    }
    
    // Generate latest.yml (for Windows)
    const exeFile = files.find(f => f.endsWith('-Setup.exe'));
    if (exeFile) {
        const exePath = path.join(releaseDir, exeFile);
        const exeSha512 = calculateSHA512(exePath);
        const exeSize = getFileSize(exePath);
        
        const windowsYml = `version: ${version}
files:
  - url: ${exeFile}
    sha512: ${exeSha512}
    size: ${exeSize}
path: ${exeFile}
sha512: ${exeSha512}
releaseDate: '${new Date().toISOString()}'
`;
        
        fs.writeFileSync(path.join(releaseDir, 'latest.yml'), windowsYml);
        console.log('Generated latest.yml');
        metadataGenerated = true;
    }
    
    // Generate latest-mac.yml
    const dmgFiles = files.filter(f => f.endsWith('.dmg'));
    if (dmgFiles.length > 0) {
        const mainDmg = dmgFiles.find(f => f.includes('x64')) || dmgFiles[0];
        const dmgPath = path.join(releaseDir, mainDmg);
        const dmgSha512 = calculateSHA512(dmgPath);
        const dmgSize = getFileSize(dmgPath);
        
        const macYml = `version: ${version}
files:
  - url: ${mainDmg}
    sha512: ${dmgSha512}
    size: ${dmgSize}
path: ${mainDmg}
sha512: ${dmgSha512}
releaseDate: '${new Date().toISOString()}'
`;
        
        fs.writeFileSync(path.join(releaseDir, 'latest-mac.yml'), macYml);
        console.log('Generated latest-mac.yml');
        metadataGenerated = true;
    }
    
    if (metadataGenerated) {
        console.log('Update metadata generation complete!');
    } else {
        console.log('No release files found to generate metadata for.');
    }
}

if (require.main === module) {
    generateUpdateMetadata();
}

module.exports = generateUpdateMetadata;