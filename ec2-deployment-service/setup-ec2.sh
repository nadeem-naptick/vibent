#!/bin/bash
set -e

echo "Setting up Vibe Deployment Service on EC2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/vibeapp/projects
sudo mkdir -p /opt/vibeapp-deployment-service
sudo chown -R ubuntu:ubuntu /opt/vibeapp-deployment-service
sudo chown -R ubuntu:ubuntu /var/www/vibeapp

# Copy service files
cp package.json server.js /opt/vibeapp-deployment-service/
cd /opt/vibeapp-deployment-service

# Install dependencies
npm install

# Create environment file
cp .env.example .env
echo "Please edit /opt/vibeapp-deployment-service/.env with your configuration"

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'vibeapp-deployment-service',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/vibeapp-deployment.error.log',
    out_file: '/var/log/vibeapp-deployment.out.log',
    log_file: '/var/log/vibeapp-deployment.combined.log'
  }]
};
EOF

# Create log directory
sudo mkdir -p /var/log
sudo chown ubuntu:ubuntu /var/log/vibeapp-deployment.*.log 2>/dev/null || true

# Install and configure nginx (if not already installed)
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
fi

# Create nginx configuration for the service
sudo tee /etc/nginx/sites-available/vibeapp-deployment > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Main app (assumed to be running on port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Deployment service internal endpoint
    location /api/deployment/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security: Only allow from main app
        allow 127.0.0.1;
        deny all;
    }
    
    # Serve built projects
    location /creation/ {
        alias /var/www/vibeapp/projects/;
        try_files $uri $uri/ =404;
        
        # Security headers
        add_header X-Frame-Options SAMEORIGIN;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/vibeapp-deployment /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Start the deployment service
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Setup complete! The deployment service is running on port 3001"
echo "Don't forget to:"
echo "1. Edit /opt/vibeapp-deployment-service/.env with your configuration"
echo "2. Configure your security group to allow port 3001 from your main app"
echo "3. Set EC2_DEPLOYMENT_SERVICE_URL in your main app to http://EC2_IP:3001"