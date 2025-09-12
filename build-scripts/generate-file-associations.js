#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the file formats configuration
const fileFormatsPath = path.join(__dirname, '../shared/fileFormats.json');
const fileFormats = JSON.parse(fs.readFileSync(fileFormatsPath, 'utf8'));

// Read the current package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Generate file associations dynamically - create individual entries for each extension
const fileAssociations = [];

// Add video files
fileFormats.video.forEach(ext => {
  fileAssociations.push({
    ext: ext,
    name: "Video File",
    description: "Video file for transcription",
    role: "Editor"
  });
});

// Add audio files  
fileFormats.audio.forEach(ext => {
  fileAssociations.push({
    ext: ext,
    name: "Audio File",
    description: "Audio file for transcription", 
    role: "Editor"
  });
});

// Add subtitle files
fileFormats.subtitle.forEach(ext => {
  fileAssociations.push({
    ext: ext,
    name: "Subtitle File",
    description: "Subtitle file for translation",
    role: "Editor"
  });
});

// Add file associations to package.json build config
packageJson.build.fileAssociations = fileAssociations;

// Write the updated package.json
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Generated file associations for:`);
console.log(`   📹 ${fileFormats.video.length} video formats`);
console.log(`   🎵 ${fileFormats.audio.length} audio formats`);
console.log(`   📄 ${fileFormats.subtitle.length} subtitle formats`);