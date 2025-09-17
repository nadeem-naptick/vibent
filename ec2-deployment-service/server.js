const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { exec } = require('child_process');
const { promisify } = require('util');
const { writeFile, mkdir } = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// MongoDB connection
let mongoClient;
let db;

async function connectMongoDB() {
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/vibeapp');
    await mongoClient.connect();
    db = mongoClient.db('vibeapp');
    console.log('[MongoDB] Connected successfully');
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
    process.exit(1);
  }
}

// Authentication middleware
function authenticateDeployment(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token !== (process.env.DEPLOYMENT_SECRET || 'dev-secret')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'vibeapp-deployment-service'
  });
});

// Main deployment endpoint
app.post('/deploy', authenticateDeployment, async (req, res) => {
  const { projectId, files, zipData, timestamp, retries = 0 } = req.body;
  
  if (!projectId || (!files && !zipData)) {
    return res.status(400).json({ error: 'Missing projectId and either files or zipData' });
  }

  console.log(`[Deploy] Starting deployment for project ${projectId}`);
  const startTime = Date.now();

  try {
    // Update project status to building
    const projectsCollection = db.collection('projects');
    await projectsCollection.updateOne(
      { projectId },
      { 
        $set: { 
          status: 'building',
          'metadata.buildStartedAt': new Date(),
          'metadata.updatedAt': new Date()
        }
      }
    );

    // Deploy the project (using zip data if available, otherwise files)
    const result = zipData 
      ? await deployProjectFromZip(projectId, zipData)
      : await deployProject(projectId, files);
    const buildTime = Date.now() - startTime;

    // Update project status to ready
    await projectsCollection.updateOne(
      { projectId },
      { 
        $set: { 
          status: 'ready',
          thumbnail: result.thumbnail,
          'metadata.buildTimeMs': buildTime,
          'metadata.buildCompletedAt': new Date(),
          'metadata.updatedAt': new Date()
        }
      }
    );

    console.log(`[Deploy] Project ${projectId} deployed successfully in ${buildTime}ms`);
    
    res.json({
      success: true,
      projectId,
      url: result.url,
      buildTime,
      thumbnail: result.thumbnail
    });

  } catch (error) {
    console.error(`[Deploy] Failed to deploy project ${projectId}:`, error);
    
    // Update project status to failed
    try {
      await db.collection('projects').updateOne(
        { projectId },
        { 
          $set: { 
            status: 'failed',
            error: error.message,
            'metadata.updatedAt': new Date()
          }
        }
      );
    } catch (dbError) {
      console.error('[Deploy] Failed to update project status:', dbError);
    }

    res.status(500).json({
      error: 'Deployment failed',
      details: error.message,
      projectId
    });
  }
});

// Core deployment function from zip data
async function deployProjectFromZip(projectId, zipData) {
  const projectPath = `/var/www/vibeapp/projects/${projectId}`;
  const srcPath = path.join(projectPath, 'src');
  const distPath = path.join(projectPath, 'dist');
  
  console.log(`[Deploy] Creating directories for ${projectId}`);

  // Step 1: Create project directory structure
  try {
    await execAsync(`sudo mkdir -p "${projectPath}" "${srcPath}" "${distPath}"`);
    await execAsync(`sudo chown -R $(whoami):$(whoami) "${projectPath}"`);
    console.log('[Deploy] Created project directories');
  } catch (error) {
    throw new Error(`Failed to create directories: ${error.message}`);
  }

  // Step 2: Extract zip data and write to filesystem
  try {
    // Convert base64 data URL to just base64
    const base64Data = zipData.dataUrl.replace('data:application/zip;base64,', '');
    
    // Write base64 data to temp zip file
    const tempZipPath = `/tmp/${projectId}-project.zip`;
    await execAsync(`echo "${base64Data}" | base64 -d > "${tempZipPath}"`);
    
    // Extract zip to src directory
    await execAsync(`cd "${srcPath}" && unzip -q "${tempZipPath}"`);
    
    // Clean up temp file
    await execAsync(`rm "${tempZipPath}"`);
    
    console.log('[Deploy] Extracted project files from zip');
  } catch (error) {
    throw new Error(`Failed to extract zip: ${error.message}`);
  }

  // Continue with the rest of the build process (same as individual files)
  return await finalizeBuild(projectId, projectPath, srcPath, distPath);
}

// Core deployment function from individual files
async function deployProject(projectId, files) {
  const projectPath = `/var/www/vibeapp/projects/${projectId}`;
  const srcPath = path.join(projectPath, 'src');
  const distPath = path.join(projectPath, 'dist');
  
  console.log(`[Deploy] Creating directories for ${projectId}`);

  // Step 1: Create project directory structure
  try {
    await execAsync(`sudo mkdir -p "${projectPath}" "${srcPath}" "${distPath}"`);
    await execAsync(`sudo chown -R $(whoami):$(whoami) "${projectPath}"`);
    console.log('[Deploy] Created project directories');
  } catch (error) {
    throw new Error(`Failed to create directories: ${error.message}`);
  }

  // Step 2: Write all files to filesystem
  try {
    for (const file of files) {
      const filePath = path.join(srcPath, file.path);
      const fileDir = path.dirname(filePath);
      
      // Create subdirectories if needed
      await mkdir(fileDir, { recursive: true });
      
      // Write file content
      await writeFile(filePath, file.content, 'utf8');
      console.log(`[Deploy] Written file: ${file.path}`);
    }
  } catch (error) {
    throw new Error(`Failed to write files: ${error.message}`);
  }

  // Continue with finalize build
  return await finalizeBuild(projectId, projectPath, srcPath, distPath);
}

// Finalize build process (common steps for both zip and files)
async function finalizeBuild(projectId, projectPath, srcPath, distPath) {
  // Step 1: Create package.json if it doesn't exist
  const packageJsonPath = path.join(srcPath, 'package.json');
  let hasPackageJson = false;
  
  try {
    await execAsync(`test -f "${packageJsonPath}"`);
    hasPackageJson = true;
  } catch (error) {
    // File doesn't exist
  }
  
  if (!hasPackageJson) {
    const defaultPackageJson = {
      name: `project-${projectId}`,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/react': '^18.2.66',
        '@types/react-dom': '^18.2.22',
        '@vitejs/plugin-react': '^4.2.1',
        vite: '^5.2.0'
      }
    };
    
    await writeFile(
      packageJsonPath, 
      JSON.stringify(defaultPackageJson, null, 2), 
      'utf8'
    );
    console.log('[Deploy] Created default package.json');
  }

  // Step 2: Create or update vite.config.js to ensure correct build output
  const viteConfigPath = path.join(srcPath, 'vite.config.js');
  const viteConfig = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  base: '/creation/${projectId}/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: false,
    allowedHosts: ['.e2b.app', '.e2b.dev', '.vercel.run', 'localhost', '127.0.0.1']
  }
})
`;
  
  await writeFile(viteConfigPath, viteConfig, 'utf8');
  console.log('[Deploy] Created/updated vite.config.js with correct build output');

  // Step 3: Install dependencies and build
  try {
    console.log('[Deploy] Installing dependencies...');
    await execAsync('npm install --include=dev', { 
      cwd: srcPath,
      timeout: 120000 // 2 minutes timeout
    });

    console.log('[Deploy] Building project...');
    await execAsync('npm run build', { 
      cwd: srcPath,
      timeout: 180000 // 3 minutes timeout
    });

    console.log('[Deploy] Build completed successfully');
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }

  // Step 3.5: Create symlinks for nginx compatibility
  try {
    await execAsync('ln -sf dist/index.html index.html', { cwd: projectPath });
    await execAsync('ln -sf dist/assets assets', { cwd: projectPath });
    console.log('[Deploy] Created symlinks for project ' + projectId);
  } catch (error) {
    console.warn('[Deploy] Warning: Could not create symlinks: ' + error.message);
  }

  // Step 4: Configure nginx
  try {
    const nginxConfig = `
location /creation/${projectId}/ {
    alias ${distPath}/;
    try_files $uri $uri/ /creation/${projectId}/index.html;
    
    # Add security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;
    
    const nginxConfigPath = `/etc/nginx/sites-available/project-${projectId}`;
    await execAsync(`echo '${nginxConfig}' | sudo tee ${nginxConfigPath}`);
    
    // Create symlink to enable site
    await execAsync(`sudo ln -sf ${nginxConfigPath} /etc/nginx/sites-enabled/project-${projectId}`);
    
    // Test nginx config and reload
    await execAsync('sudo nginx -t');
    await execAsync('sudo systemctl reload nginx');
    
    console.log('[Deploy] Nginx configuration updated');
  } catch (error) {
    console.warn('[Deploy] Nginx configuration failed:', error.message);
    // Don't fail deployment for nginx issues
  }

  // Step 5: Generate real screenshot thumbnail
  const url = `${process.env.PROJECT_BASE_URL || 'http://localhost:3000'}/creation/${projectId}`;
  const thumbnail = await captureProjectScreenshot(url);

  return {
    url,
    thumbnail
  };
}

// Capture real screenshot thumbnail with retry logic and better error handling
async function captureProjectScreenshot(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Screenshot] Attempt ${attempt}/${maxRetries} - Capturing screenshot for ${url}`);
      
      // Wait longer for the site to be fully available, with exponential backoff
      const waitTime = 3000 * attempt;
      console.log(`[Screenshot] Waiting ${waitTime}ms for site to be ready...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) {
        console.warn('[Screenshot] No Firecrawl API key, using placeholder');
        return generatePlaceholderThumbnail('deployed');
      }

      // Try different screenshot approaches
      const approaches = [
        // Approach 1: Full page screenshot with actions
        {
          name: 'full-page-with-actions',
          config: {
            url,
            formats: ['screenshot'],
            onlyMainContent: false,
            timeout: 45000,
            actions: [
              {
                type: 'wait',
                milliseconds: 2000
              },
              {
                type: 'screenshot',
                fullPage: true
              }
            ]
          }
        },
        // Approach 2: Simple screenshot format
        {
          name: 'simple-screenshot',
          config: {
            url,
            formats: ['screenshot'],
            onlyMainContent: false,
            timeout: 30000
          }
        },
        // Approach 3: Screenshot with viewport
        {
          name: 'viewport-screenshot',
          config: {
            url,
            formats: ['screenshot'],
            onlyMainContent: false,
            timeout: 30000,
            actions: [
              {
                type: 'screenshot',
                selector: 'body'
              }
            ]
          }
        }
      ];

      for (const approach of approaches) {
        try {
          console.log(`[Screenshot] Trying approach: ${approach.name}`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(approach.config)
          });

          console.log(`[Screenshot] Response status: ${scrapeResponse.status}`);
          
          if (!scrapeResponse.ok) {
            const errorText = await scrapeResponse.text();
            console.warn(`[Screenshot] Firecrawl API error (${approach.name}): ${scrapeResponse.status} - ${errorText}`);
            continue; // Try next approach
          }

          const scrapeResult = await scrapeResponse.json();
          console.log(`[Screenshot] Response keys: ${Object.keys(scrapeResult)}`);
          
          // Check for screenshot in multiple possible locations
          let screenshot = null;
          if (scrapeResult?.data?.screenshot) {
            screenshot = scrapeResult.data.screenshot;
            console.log('[Screenshot] Found screenshot in data.screenshot');
          } else if (scrapeResult?.data?.actions?.[0]?.screenshots?.[0]) {
            screenshot = scrapeResult.data.actions[0].screenshots[0];
            console.log('[Screenshot] Found screenshot in actions.screenshots');
          } else if (scrapeResult?.screenshot) {
            screenshot = scrapeResult.screenshot;
            console.log('[Screenshot] Found screenshot in root.screenshot');
          }
          
          if (screenshot && screenshot.startsWith('http')) {
            console.log(`[Screenshot] Successfully captured screenshot using ${approach.name}`);
            return screenshot;
          } else if (screenshot) {
            console.log(`[Screenshot] Got screenshot but invalid format: ${screenshot.substring(0, 100)}...`);
          }
          
        } catch (approachError) {
          console.error(`[Screenshot] Approach ${approach.name} failed:`, approachError.message);
          continue;
        }
      }
      
      console.warn(`[Screenshot] All approaches failed on attempt ${attempt}`);
      
      if (attempt < maxRetries) {
        const retryDelay = 5000 * attempt;
        console.log(`[Screenshot] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
    } catch (error) {
      console.error(`[Screenshot] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const retryDelay = 5000 * attempt;
        console.log(`[Screenshot] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.warn(`[Screenshot] All ${maxRetries} attempts failed, using placeholder`);
  return generatePlaceholderThumbnail('deployed');
}

// Generate placeholder thumbnail
function generatePlaceholderThumbnail(projectId) {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="200" y="150" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%236b7280">Project ${projectId}</text></svg>`;
}

// Start server
async function startServer() {
  try {
    await connectMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Vibe deployment service running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] Received SIGTERM, shutting down gracefully');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] Received SIGINT, shutting down gracefully');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

startServer();