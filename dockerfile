ARG NODE_VERSION=24.14.0-slim

# ---- Build stage: compiles the React app with Vite ----
FROM node:${NODE_VERSION} AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite bakes VITE_-prefixed env vars into the client bundle at build time
ARG VITE_PAYPAL_PLAN_LAUNCH
ARG VITE_PAYPAL_PLAN_GROW
ARG VITE_PAYPAL_PLAN_SCALE
ARG VITE_PAYPAL_CLIENT_ID
ENV VITE_PAYPAL_PLAN_LAUNCH=$VITE_PAYPAL_PLAN_LAUNCH
ENV VITE_PAYPAL_PLAN_GROW=$VITE_PAYPAL_PLAN_GROW
ENV VITE_PAYPAL_PLAN_SCALE=$VITE_PAYPAL_PLAN_SCALE
ENV VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID

RUN npm run build

# ---- Production stage: runs the Express server ----
FROM node:${NODE_VERSION} AS prod

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY server ./server
COPY --from=build /app/dist ./dist

# Client database lives here; docker-compose mounts a named volume over it so the
# records survive image rebuilds.
RUN mkdir -p /app/data

RUN chown -R node:node /app
USER node

EXPOSE 5173

CMD ["node", "server.js"]