# Use official Node.js 24 image
FROM node:24-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy all application source code
COPY . .

# Expose app port
EXPOSE 5000

# Start command
CMD ["node", "server.js"]