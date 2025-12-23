FROM node:20-alpine AS base
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files & install dependencies
# Remove package-lock.json to avoid npm optional dependency bug with rollup
COPY package.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Remix for production
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
