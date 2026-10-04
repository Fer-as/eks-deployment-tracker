FROM node:24.14.0-alpine3.23
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY schema.sql ./
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
