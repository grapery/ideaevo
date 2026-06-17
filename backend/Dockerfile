FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
ARG COMMIT_SHA=
ARG BUILD_TIME=
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -ldflags="-s -w -X main.Version=${VERSION} -X main.CommitSHA=${COMMIT_SHA} -X main.BuildTime=${BUILD_TIME}" \
      -o /api cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -ldflags="-s -w -X main.Version=${VERSION} -X main.CommitSHA=${COMMIT_SHA} -X main.BuildTime=${BUILD_TIME}" \
      -o /mcp cmd/mcp/main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /api /usr/local/bin/api
COPY --from=builder /mcp /usr/local/bin/mcp
# 选择默认启动的服务二进制：api 或 mcp（通过 --build-arg SERVICE=mcp 覆盖）
ARG SERVICE=api
ENV BIN_NAME=${SERVICE}
EXPOSE 8080
# 通过环境变量选择启动的二进制；部署时仍可用 docker-compose command 覆盖
CMD ["sh", "-c", "exec /usr/local/bin/${BIN_NAME}"]
