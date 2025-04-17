# Base image with Node.js and Chromium
FROM node:18-slim

# Install Chromium
RUN apt-get update && \
    apt-get install -y chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working dir
WORKDIR /app

# Copy files
COPY . .

# Install dependencies
RUN npm install

# Expose port
EXPOSE 10000

# Start app
CMD ["node", "server2/server.js"]
