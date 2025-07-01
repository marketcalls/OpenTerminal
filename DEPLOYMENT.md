# OpenTerminal Production Deployment Guide

This guide details the steps to deploy OpenTerminal in a production environment using Nginx, Gunicorn, systemd, and a daily scheduler service.

## System Requirements

- Ubuntu 20.04 LTS or newer
- Python 3.9+
- Nginx
- Redis Server
- SSL Certificate (Let's Encrypt recommended)

## Installation Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install python3-venv python3-pip nginx redis-server
```

### 2. Application Setup

```bash
# Create application directory
sudo mkdir -p /var/python/openterminal
sudo chown www-data:www-data /var/python/openterminal

# Create Python virtual environment
sudo mkdir -p /var/python/venv
sudo python3 -m venv /var/python/venv

# Clone repository
sudo -u www-data git clone https://github.com/marketcalls/OpenTerminal.git /var/python/openterminal

# Install dependencies
sudo /var/python/venv/bin/pip install -r /var/python/openterminal/requirements.txt
sudo /var/python/venv/bin/pip install gunicorn
```

### 3. Nginx Configuration

Create Nginx configuration file:

```nginx
# /etc/nginx/sites-available/openterminal
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Static files
    location /static/ {
        alias /var/python/openterminal/static/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Main application
    location / {
        proxy_pass http://unix:/var/python/openterminal/openterminal.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io {
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass http://unix:/var/python/openterminal/openterminal.sock;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/openterminal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Systemd Service Configuration

Create systemd service file:

```ini
# /etc/systemd/system/openterminal.service
[Unit]
Description=Gunicorn instance to serve OpenTerminal Flask app
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/python/openterminal
Environment="PATH=/var/python/venv/bin"

ExecStart=/var/python/venv/bin/python -m gunicorn \
    --workers 4 \
    --bind unix:/var/python/openterminal/openterminal.sock \
    "app:create_app()"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable openterminal
sudo systemctl start openterminal
```

### 5. Scheduler Service Setup

Create a new systemd service file to run scheduled tasks with the `scheduler.py` script:

```ini
# /etc/systemd/system/openterminal-scheduler.service
[Unit]
Description=Scheduler for OpenTerminal daily tasks
After=network.target openterminal.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/python/openterminal
Environment="PATH=/var/python/venv/bin"
ExecStart=/var/python/venv/bin/python /var/python/openterminal/scheduler.py

[Install]
WantedBy=multi-user.target
```

Create a timer file to run this service daily:

```ini
# /etc/systemd/system/openterminal-scheduler.timer
[Unit]
Description=Run OpenTerminal Scheduler daily

[Timer]
OnCalendar=*-*-* 00:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:

```bash
sudo systemctl enable openterminal-scheduler.timer
sudo systemctl start openterminal-scheduler.timer
```

### 6. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com
```

### 7. File Permissions

Run the prestart script to set proper permissions:
```bash
sudo mkdir -p /var/log/gunicorn
sudo chown -R www-data:www-data /var/log/gunicorn
sudo chmod 755 /var/log/gunicorn

sudo chown -R www-data:www-data /var/python/openterminal
sudo chmod -R u+rwX,g+rX,o+rX /var/python/openterminal
```

### 8. Environment Configuration

Create and configure `.env` file:
```bash
sudo -u www-data touch /var/python/openterminal/.env
sudo -u www-data nano /var/python/openterminal/.env
```

Add required environment variables:
```env
SECRET_KEY=your-secure-secret-key
SQLALCHEMY_DATABASE_URI=sqlite:///open_terminal.db
REDIS_URL=redis://localhost:6379/0
PRODUCTION=true
```

## Monitoring and Maintenance

### Log Locations
- Application logs: `/var/log/gunicorn/`
- Nginx access logs: `/var/log/nginx/access.log`
- Nginx error logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u openterminal`
- Scheduler logs: `journalctl -u openterminal-scheduler`

### Common Commands

```bash
# Check service status
sudo systemctl status openterminal
sudo systemctl status openterminal-scheduler

# Restart service
sudo systemctl restart openterminal
sudo systemctl restart openterminal-scheduler

# View logs
sudo journalctl -u openterminal -f
sudo journalctl -u openterminal-scheduler -f

# Reload Nginx
sudo systemctl reload nginx
```

### Backup Strategy

1. Database backup:
```bash
cp /var/python/openterminal/instance/open_terminal.db /backup/
```

2. Configuration backup:
```bash
cp -r /var/python/openterminal/.env /backup/
cp /etc/nginx/sites-available/openterminal /backup/
cp /etc/systemd/system/openterminal.service /backup/
cp /etc/systemd/system/openterminal-scheduler.service /backup/
```

## Troubleshooting

### Common Issues

1. **Socket Permission Denied**
```bash
sudo chown www-data:www-data /var/python/openterminal/openterminal.sock
```

2. **Static Files Not Loading**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

3. **Application Errors**
```bash
sudo journalctl -u openterminal -n 100
```

### Security Considerations

1. **Firewall Configuration**
```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

2. **Regular Updates**
```bash
sudo apt update && sudo apt upgrade
```

3. **SSL Certificate Renewal**
```bash
sudo certbot renew --dry-run
```

## Performance Optimization

1. **Gunicorn Workers**
   - Adjust number of workers based on CPU cores
   - Recommended: (2 x CPU cores) + 1

2. **Nginx Configuration**
   - Enable gzip compression
   - Configure proper caching headers
   - Optimize worker connections

3. **Redis Configuration**
   - Adjust maxmemory settings
   - Configure appropriate eviction policies

## Support

For issues and support:
1. Check application logs
2. Review [GitHub Issues](https://github.com/marketcalls/OpenTerminal/issues)
3. Submit detailed bug reports with logs