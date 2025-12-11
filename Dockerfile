FROM oven/bun:1.1.17-alpine AS base
WORKDIR /app

# Install OpenSSL + Node.js for Prisma generation
RUN apk add --no-cache openssl nodejs npm

# Copy package files & install dependencies
COPY package*.json bun.lockb* ./
RUN bun install

# Copy the rest of the app
COPY . .

# Use Node to generate Prisma Client to avoid Bun's crash
RUN npx prisma generate

# Build Remix for production with Bun
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
