# Build backend.
FROM golang:1.14-alpine as backend
WORKDIR /app
COPY . .
RUN apk add gcc musl-dev \
    && go build ./cmd/codenames/main.go

# Build frontend.
FROM node:12-alpine as frontend
COPY . /app
WORKDIR /app/frontend
# python2/make/g++ let node-gyp compile native deps (e.g. deasync) from source on
# platforms without a prebuilt binary, such as arm64. --unsafe-perm stops npm from
# dropping these root-run install scripts to the "nobody" user, which otherwise
# can't write to the global node_modules dir or node-gyp's build cache.
RUN apk add --no-cache python2 make g++ \
    && npm install -g --unsafe-perm parcel-bundler \
    && npm install --unsafe-perm \
    && sh build.sh

# Copy build artifacts from previous build stages (to remove files not necessary for
# deployment).
FROM alpine:3.11
WORKDIR /app
COPY --from=backend /app/main .
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY assets assets
EXPOSE 9091/tcp
CMD /app/main
