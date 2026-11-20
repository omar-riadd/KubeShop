# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY internal/ internal/
COPY cart/ cart/

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/cart ./cart/cmd/cart

FROM gcr.io/distroless/static-debian12:nonroot

ARG GIT_SHA=local
ARG BUILD_TIME=""

LABEL org.opencontainers.image.title="kubeshop-cart" \
      org.opencontainers.image.description="KubeShop Cart microservice" \
      org.opencontainers.image.source="https://github.com/<GH_OWNER>/kubeshop-platform" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_TIME}"

ENV APP_GIT_SHA=${GIT_SHA} \
    APP_BUILD_TIME=${BUILD_TIME}

COPY --from=builder /out/cart /cart

USER 65532:65532
EXPOSE 8080 9090

ENTRYPOINT ["/cart"]
