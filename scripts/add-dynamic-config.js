#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const dynamicConfig = `
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
`;

function addDynamicConfigToFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Skip if already has dynamic config
    if (content.includes('export const dynamic')) {
      console.log(`⏭️ Skipping ${filePath} (already configured)`);
      return;
    }

    // Find the first import statement and add config after imports
    const lines = content.split('\n');
    let insertIndex = 0;

    // Find the last import line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].startsWith("import ")) {
        insertIndex = i + 1;
      }
    }

    // Insert dynamic config after imports
    lines.splice(insertIndex, 0, dynamicConfig);

    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Added dynamic config to ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// Find all API route files
const apiRoutes = glob.sync('app/api/**/route.ts', {
  cwd: process.cwd(),
  absolute: true
});

console.log(`📁 Found ${apiRoutes.length} API route files`);

apiRoutes.forEach(filePath => {
  addDynamicConfigToFile(filePath);
});

console.log('🎉 Dynamic configuration added to all API routes!');