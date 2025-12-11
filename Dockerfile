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

EXPOSE 5173

CMD ["bun", "run", "start", "--", "--port", "5173", "--host", "0.0.0.0"]
