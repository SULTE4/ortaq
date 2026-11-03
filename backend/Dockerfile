FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -o /api ./cmd/server
FROM alpine:3.22
RUN adduser -D -u 10001 ortaq && mkdir /uploads && chown ortaq /uploads
COPY --from=build /api /api
USER ortaq
EXPOSE 8080
ENTRYPOINT ["/api"]
