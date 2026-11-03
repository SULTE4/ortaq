# Ortaq

A university defense demo for property owners’ associations (OSI) in Kazakhstan. One Go/PostgreSQL backend powers a phone-sized Flutter resident app, a Flutter management workspace, and Ortaq 3D.

```sh
docker compose up --build
```

Open resident http://localhost:8081, management http://localhost:8082, and 3D http://localhost:8083. API: http://localhost:8080/health. First build needs internet access to download Flutter, Node and Go dependencies. Demo data loads automatically only into an empty database. Named volumes preserve data and uploaded photos.

Every demo account uses OTP **1234** (request a code first).

| Role | Phone | Apartment |
|---|---|---|
| Chairman | +77000000001 | — |
| Accountant | +77000000002 | — |
| Resident | +77000000011 | 12 |
| Resident | +77000000012 | 45 |
| Resident | +77000000013 | 87 |

New residents can use any +7 phone and an active apartment invite, e.g. `ORTAQ-045`. These are explicitly demo credentials. Real SMS delivery is outside this demo.

`make test` runs backend tests. `make check` also validates Compose configuration.

The authoring environment mounts `.git` read-only. Real incremental commits are retained in `.history.git`; use `./scripts/git log` / `./scripts/git status`. This has no effect on Docker.
