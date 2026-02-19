FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN go build -o /out/waf ./cmd/waf

FROM alpine:3.20
COPY --from=build /out/waf /usr/local/bin/waf
ENTRYPOINT ["/usr/local/bin/waf"]
