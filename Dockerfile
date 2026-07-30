# Build backend.
FROM golang:1.14-alpine AS backend
WORKDIR /app
RUN apk add --no-cache gcc musl-dev
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build ./cmd/codenames/main.go

# Build frontend.
FROM node:12-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
# python2/make/g++ let node-gyp compile native deps (e.g. deasync) from source on
# platforms without a prebuilt binary, such as arm64. --unsafe-perm stops npm from
# dropping these root-run install scripts to the "nobody" user, which otherwise
# can't write to the global node_modules dir or node-gyp's build cache.
RUN --mount=type=cache,target=/root/.npm \
    apk add --no-cache python2 make g++ \
    && npm install -g --unsafe-perm parcel-bundler \
    && npm install --unsafe-perm
COPY . /app
RUN sh build.sh

# Copy build artifacts from previous build stages (to remove files not necessary for
# deployment).
FROM alpine:3.11
WORKDIR /app
COPY --from=backend /app/main .
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY assets assets
EXPOSE 9091/tcp
CMD /app/main
