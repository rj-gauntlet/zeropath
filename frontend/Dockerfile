# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config template (envsubst fills BACKEND_URL at runtime)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Keep the static nginx.conf for local docker-compose (no envsubst needed)
COPY nginx.conf /etc/nginx/conf.d/default.conf.bak

# Default backend URL for Railway internal networking
ENV BACKEND_URL=http://backend:8000
# Railway injects PORT; default to 80 for local docker-compose
ENV PORT=80

EXPOSE 80

# Use envsubst to inject BACKEND_URL and PORT, then start nginx
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
