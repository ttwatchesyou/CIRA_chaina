const { execSync } = require('child_process');

// Only run on Vercel build environment
if (!process.env.VERCEL) {
  console.log('Not on Vercel — skipping platform-specific sharp install.');
  process.exit(0);
}

try {
  console.log('Installing platform-specific sharp for linux x64...');
  // Use npm to fetch the linux/x64 prebuilt binary
  execSync('npm install --no-save --os=linux --cpu=x64 sharp@0.35.3', { stdio: 'inherit' });
  console.log('Sharp platform-specific install complete.');
} catch (err) {
  console.error('Sharp platform-specific install failed:', err);
  process.exit(1);
}
