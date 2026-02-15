const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const deployDir = path.join(__dirname, 'deploy');

// Create deploy directory
if (fs.existsSync(deployDir)) {
  console.log('Cleaning existing deploy folder...');
  fs.rmSync(deployDir, { recursive: true });
}

console.log('Creating deploy folder structure...');
fs.mkdirSync(deployDir, { recursive: true });

// Function to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src);
  
  files.forEach(file => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    const stat = fs.statSync(srcFile);
    
    if (stat.isDirectory()) {
      copyDir(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
}

// Copy server folder
console.log('Copying server files...');
copyDir(path.join(__dirname, 'server'), path.join(deployDir, 'server'));

// Copy public folder
console.log('Copying public files...');
copyDir(path.join(__dirname, 'public'), path.join(deployDir, 'public'));

// Copy package.json and package-lock.json
console.log('Copying configuration files...');
fs.copyFileSync(
  path.join(__dirname, 'package.json'),
  path.join(deployDir, 'package.json')
);

if (fs.existsSync(path.join(__dirname, 'package-lock.json'))) {
  fs.copyFileSync(
    path.join(__dirname, 'package-lock.json'),
    path.join(deployDir, 'package-lock.json')
  );
}

// Create web.config for IIS
console.log('Creating web.config for IIS...');
const webConfig = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="true" />
    <rewrite>
      <rules>
        <rule name="ReverseProxyRule" stopProcessing="true">
          <match url="^(.*)$" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
          </conditions>
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>`;

fs.writeFileSync(path.join(deployDir, 'web.config'), webConfig);

// Install production dependencies
console.log('Installing production dependencies...');
try {
  execSync('npm install --production', { 
    cwd: deployDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('Error installing dependencies:', error.message);
  process.exit(1);
}

console.log('\n✅ Build complete! Deployment folder ready at: ' + deployDir);
console.log('\nDeploy folder contents:');
console.log('  - server/          (application server code)');
console.log('  - public/          (client-side files)');
console.log('  - node_modules/    (production dependencies)');
console.log('  - package.json     (dependency manifest)');
console.log('  - web.config       (IIS configuration)');
console.log('\nNext steps:');
console.log('1. Copy the "deploy" folder to your IIS server');
console.log('2. Create an IIS Application pointing to the deploy folder');
console.log('3. Configure IIS Application Pool (Node.js settings)');
console.log('4. Start the Node.js app via command line or Windows Service');
console.log('5. Access the app from IIS\n');
