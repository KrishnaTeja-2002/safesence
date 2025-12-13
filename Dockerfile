# Use the official Node.js 18 image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
<<<<<<< HEAD
RUN npm ci 
=======
RUN npm ci
>>>>>>> bc9a796b063c6c06325aa4bf44f1ac098b24633c

# Copy source code
COPY . .

# 🔹 Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD [“npm”, “start”]
