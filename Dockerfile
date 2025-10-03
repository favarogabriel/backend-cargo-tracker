# Simple Dockerfile for providers like Koyeb, Fly.io, Railway (alt) or Render (custom)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src
EXPOSE 8080
CMD ["npm","start"]
