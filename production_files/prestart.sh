#!/bin/bash

# Create and set permissions for the Gunicorn log directory
mkdir -p /var/log/gunicorn
chown -R www-data:www-data /var/log/gunicorn
chmod 755 /var/log/gunicorn

# Set ownership and permissions for the application directory
chown -R www-data:www-data /var/python/openterminal
chmod -R u+rwX,g+rX,o+rX /var/python/openterminal

