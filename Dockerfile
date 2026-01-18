# ============================================
# CLIENT BUILD STAGE
# ============================================
FROM node:22-alpine AS client-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS client-build
WORKDIR /app
COPY --from=client-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/
COPY shared/ ./shared/
ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# ============================================
# SERVER BUILD STAGE
# ============================================
FROM node:22-alpine AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

FROM node:22-alpine AS server-build
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY shared/*.ts ./shared/
RUN rm -f ./shared/*.test.ts
WORKDIR /app/server
RUN mkdir -p dist && npm run build

# ============================================
# CLIENT RUNTIME (nginx)
# ============================================
FROM nginx:alpine AS client
COPY --from=client-build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ============================================
# SERVER RUNTIME (node)
# ============================================
FROM node:22-alpine AS server
WORKDIR /app
RUN apk add --no-cache sqlite
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
