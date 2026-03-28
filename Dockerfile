# Dockerfile for NightCityVerse
FROM node:20-slim

# Required to enforce container runtime
ENV NODE_ENV=development
ENV FORCE_CONTAINER=true

WORKDIR /app

# Install all dependencies (including dev for build)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source
COPY . ./

# Build client assets
# Fix optional native dependency bug in npm 10/11 with rollup
RUN npm install --no-save @rollup/rollup-linux-x64-gnu
RUN npm run build

# Run in prod mode once built
ENV NODE_ENV=production

EXPOSE 4321

CMD ["npm", "start"]
