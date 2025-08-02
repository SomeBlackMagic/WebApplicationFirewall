FROM node:22-alpine

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

ENTRYPOINT []

CMD ["/nodejs/bin/node", "--require", "ts-node/register", "src/main.ts"]
