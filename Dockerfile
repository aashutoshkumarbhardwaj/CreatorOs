# Use the official Node.js active LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (including devDependencies to compile tailwind css)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Tailwind CSS file
RUN npm run build:css

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
