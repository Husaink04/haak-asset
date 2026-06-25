FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ARG VITE_MAX_UPLOAD_BYTES=5242880
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MAX_UPLOAD_BYTES=$VITE_MAX_UPLOAD_BYTES
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

RUN mkdir -p uploads

EXPOSE 4000

CMD ["npm", "start"]
