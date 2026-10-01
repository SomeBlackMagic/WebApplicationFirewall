# Go project structure (generated from TS interfaces and architecture)

```text
go-waf/
├── cmd/
│   └── waf/
│       └── main.go
├── internal/
│   ├── app/
│   │   ├── bootstrap.go
│   │   └── lifecycle.go
│   ├── config/
│   │   ├── loader.go
│   │   ├── defaults.go
│   │   ├── model_app_config.go
│   │   ├── model_waf_config.go
│   │   ├── model_api_metrics_sentry.go
│   │   ├── model_static_filters.go
│   │   ├── model_jail_config.go
│   │   └── model_under_attack_config.go
│   ├── api/
│   │   └── http/
│   │       ├── handlers/
│   │       │   ├── health_handler.go
│   │       │   ├── jail_handler.go
│   │       │   └── metrics_handler.go
│   │       ├── middleware/
│   │       │   └── basic_auth.go
│   │       └── routes/
│   │           └── routes.go
│   ├── waf/
│   │   ├── middleware.go
│   │   ├── client_detection.go
│   │   └── reject_response.go
│   ├── jail/
│   │   ├── manager.go
│   │   ├── types.go
│   │   ├── rules/
│   │   │   ├── abstract.go
│   │   │   ├── conditions.go
│   │   │   ├── composite.go
│   │   │   ├── flexible.go
│   │   │   └── static.go
│   │   └── storage/
│   │       ├── interface.go
│   │       ├── file_storage.go
│   │       ├── operator_storage.go
│   │       └── memory_storage.go
│   ├── underattack/
│   │   ├── middleware.go
│   │   ├── types.go
│   │   ├── challenge/
│   │   │   ├── manager.go
│   │   │   └── types.go
│   │   ├── fingerprint/
│   │   │   ├── validator.go
│   │   │   └── types.go
│   │   ├── proofs/
│   │   │   ├── validator.go
│   │   │   └── types.go
│   │   └── botdetector/
│   │       ├── detector.go
│   │       └── types.go
│   ├── metrics/
│   │   ├── service.go
│   │   └── registry.go
│   ├── observability/
│   │   ├── logging/
│   │   │   └── logger.go
│   │   └── sentry/
│   │       └── client.go
│   ├── geoip/
│   │   └── service.go
│   ├── proxy/
│   │   └── reverse_proxy.go
│   └── shared/
│       └── types/
│           ├── nullable.go
│           └── enums.go
├── pkg/
│   ├── httpx/
│   │   ├── response.go
│   │   └── request_id.go
│   ├── authx/
│   │   └── basic.go
│   └── envx/
│       └── env.go
├── configs/
│   ├── config.example.yaml
│   ├── basic.yaml
│   ├── production.yaml
│   └── under_attack.yaml
├── deployments/
│   ├── docker/
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── k8s/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
├── scripts/
│   ├── run.sh
│   ├── lint.sh
│   └── test.sh
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```
