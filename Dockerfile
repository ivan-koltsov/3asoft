FROM node:20-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY turbo.json tsconfig.base.json ./

# Copy package.json files for all workspaces
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/platform/package.json ./apps/platform/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY packages/ ./packages/
COPY apps/ ./apps/

# Build contracts first, then platform
RUN pnpm --filter @hatch/contracts build
RUN pnpm --filter @hatch/platform build

# Expose port
EXPOSE 3000

# Run migrations then start the app
CMD ["sh", "-c", "cd apps/platform && pnpm migrate && cd /app && node apps/platform/dist/main.js"]
