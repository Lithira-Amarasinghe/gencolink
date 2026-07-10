FROM node:20-alpine

WORKDIR /directus

# Install dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Install Directus from npm
RUN npm install -g directus@latest

# Create necessary directories
RUN mkdir -p /directus/uploads /directus/database

# Install additional packages for email and PostgreSQL
RUN npm install \
    pg \
    @directus/sdk

# Copy setup script for schema initialization
COPY setup.js /directus/setup.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8055/server/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 8055

# Run setup on startup, then start Directus
CMD sh -c "node setup.js && directus start"
