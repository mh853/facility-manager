const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertPngToIco() {
  const inputFile = path.join(__dirname, '..', '스샷', 'blueon_logo_transparent.png');
  const outputFile = path.join(__dirname, '..', 'public', 'favicon.ico');

  try {
    // Read the PNG file
    const pngBuffer = fs.readFileSync(inputFile);

    // Convert to ICO format (32x32 for compatibility)
    await sharp(pngBuffer)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(outputFile);

    console.log('✅ favicon.ico created successfully');
  } catch (error) {
    console.error('❌ Error converting favicon:', error.message);
    process.exit(1);
  }
}

convertPngToIco();
