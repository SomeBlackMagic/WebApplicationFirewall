# syntax=docker/dockerfile:experimental
FROM node:22-alpine as builder

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app

RUN --mount=type=cache,sharing=shared,id=npm_cache,target=/root/.npm npm install

COPY . /app

ARG BUILD_TIME
ARG BUILD_VERSION
ARG BUILD_REVISION

RUN sed -i -e "s#__DEV_DIRTY__#${BUILD_VERSION}-${BUILD_REVISION}#g" src/main.ts

RUN npm run build


RUN --mount=type=cache,sharing=shared,id=npm_cache,target=/root/.npm npm install --omit dev


FROM gcr.io/distroless/nodejs22-debian12

COPY --from=busybox:1.35.0-uclibc /bin/sh /bin/sh
COPY --from=busybox:1.35.0-uclibc /bin/tar /bin/tar

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app

ENTRYPOINT []

CMD ["/nodejs/bin/node", "--enable-source-maps", "/app/main.js"]
