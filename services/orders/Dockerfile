# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY internal/ internal/
COPY orders/ orders/

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/orders ./orders/cmd/orders

FROM gcr.io/distroless/static-debian12:nonroot

ARG GIT_SHA=local
ARG BUILD_TIME=""

LABEL org.opencontainers.image.title="kubeshop-orders" \
      org.opencontainers.image.description="KubeShop Orders microservice" \
      org.opencontainers.image.source="https://github.com/<GH_OWNER>/kubeshop-platform" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_TIME}"

ENV APP_GIT_SHA=${GIT_SHA} \
    APP_BUILD_TIME=${BUILD_TIME}

COPY --from=builder /out/orders /orders

USER 65532:65532
EXPOSE 8080 9090

ENTRYPOINT ["/orders"]
