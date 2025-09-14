#!/usr/bin/env node

import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function createExtensionZip() {
  const outputPath = join(rootDir, 'curupira-extension.zip');
  const output = createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Extension ZIP created successfully!`);
      console.log(`📦 File: curupira-extension.zip`);
      console.log(`📏 Size: ${sizeMB} MB (${archive.pointer()} bytes)`);
      console.log(`📍 Location: ${outputPath}`);
      resolve();
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠️  Warning:', err.message);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add the dist directory contents
    archive.directory(join(rootDir, 'dist/'), false);

    // Finalize the archive
    archive.finalize();
  });
}

// Run the script
console.log('🚀 Creating Chrome extension ZIP file...');
createExtensionZip()
  .then(() => {
    console.log('✨ Done! Upload curupira-extension.zip to Chrome Web Store.');
  })
  .catch((err) => {
    console.error('❌ Error creating ZIP:', err);
    process.exit(1);
  });