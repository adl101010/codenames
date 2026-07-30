# Codenames

Codenames is a word-guessing game. Generated boards are shareable and sync. The board can be viewed either as a clue giver or a word guesser.

![Clue giver view of board](screenshot.png)

## Building

The app requires a [Go](https://golang.org/) toolchain, node.js and [parcel](https://parceljs.org/) to build. Once you have those setup, build the application Go binary with:

```
go install github.com/adl101010/codenames/cmd/codenames
```

Then from the frontend directory, install the node modules:

```
npm install
```

and start the app (listens to changes)

```
npm start
```

or build the app

```
npm run build
```

### Docker

Alternatively, the repository includes a Dockerfile for building a docker image of this app.

```
docker build . -t codenames:latest
```

The following command will launch the docker image:

```
docker run --name codenames_server --rm -p 9091:9091 -d codenames
```

The following command will kill the docker instance:

```
docker stop codenames_server
```

A prebuilt image is also published to GHCR on every push to `master` (see `.github/workflows/docker-ghcr.yml`); `docker-compose.yml` pulls `ghcr.io/adl101010/codenames:latest` directly, no local build required.
