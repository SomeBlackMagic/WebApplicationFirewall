# syntax=docker/dockerfile:experimental

FROM node:22-alpine as builder

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app

RUN --mount=type=cache,sharing=shared,id=npm_cache,target=/root/.npm npm install

COPY . /app

RUN npm run build


RUN --mount=type=cache,sharing=shared,id=npm_cache,target=/root/.npm npm install --omit dev


FROM gcr.io/distroless/nodejs22-debian12

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

COPY --from=builder /app/node_modules /node_modules
COPY --from=builder /app/dist/ /app


CMD ["node", "--enable-source-maps", "/app/main.js"]
