FROM node:22-alpine

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app

RUN --mount=type=cache,sharing=shared,id=npm_cache,target=/root/.npm npm install

COPY . /app

CMD ["ts-node", "src/main.ts"]
