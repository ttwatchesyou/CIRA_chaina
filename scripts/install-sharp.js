const { execSync } = require('child_process');

// Run when the platform is Linux (Vercel build machines are Linux)
if (process.platform !== 'linux' && !process.env.VERCEL) {
  console.log('Not running on Linux or Vercel — skipping platform-specific sharp install.');
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
