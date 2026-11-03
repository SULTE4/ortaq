# Ortaq · our home, together

A working university-project demo for Kazakhstan’s property owners’ associations (OSI). A resident can follow every tenge, report a problem and see what happens next. The chairman and accountant manage the same building records. **Ortaq 3D** gives that shared story a spatial view and a 90-second cinematic.

## Start with one command

```sh
docker compose up --build
```

Docker Engine and Docker Compose are the only host requirements. The first build needs internet access to pull the base images and dependencies; allow several minutes for the two Flutter builds. PostgreSQL readiness and API health checks control startup. Migrations, relative-date demo records and placeholder images load automatically. No Flutter, Node, Go, database initialization or manual seed command is needed on the host.

| App        | URL                          | Purpose                                                      |
| ---------- | ---------------------------- | ------------------------------------------------------------ |
| Resident   | http://localhost:8081        | Phone-width Flutter app, maximum 430 px                      |
| Management | http://localhost:8082        | Flutter chairman/accountant workspace; embedded 3D tab       |
| Ortaq 3D   | http://localhost:8083        | Live scene and cinematic; works as a standalone app          |
| REST API   | http://localhost:8080/health | Health check; API also proxied under `/api` in every web app |
| PostgreSQL | Internal port 5432           | Persistent records; not exposed on the host                  |

Named volumes keep the database and uploaded images between restarts. `docker compose down` stops the demo and retains its records. Use the same browser hostname for all three apps so the embed origin checks match. Desktop Chrome or another recent browser with WebGL 2 is recommended for 3D. Turn **Quality: Low** on a slower machine; both embedded scenes start at Low.

## Demo accounts

Request a code, then enter **1234**. Fixed OTP is enabled explicitly by `DEMO_MODE=true`; there is no SMS provider. The API refuses OTP requests when demo mode is disabled.

| Role             | Phone        | Apartment |
| ---------------- | ------------ | --------- |
| Chairman         | +77000000001 | —         |
| Accountant       | +77000000002 | —         |
| Resident · Amina | +77000000011 | 12        |
| Resident · Arman | +77000000012 | 45        |
| Resident · Dana  | +77000000013 | 87        |

For registration, use a new `+7` phone, OTP `1234` and an apartment invite, such as `ORTAQ-045`. Initial codes follow `ORTAQ-001` through `ORTAQ-120`. The chairman can revoke a code or generate a new one for an apartment. Generating a replacement revokes its old codes; existing resident accounts stay joined. Users cannot select or elevate their own role.

Demo photos can be picked from disk using the normal upload controls. **Use generated demo photo / receipt / result photo** also attaches a server-generated placeholder, making the defense self-contained. Both paths pass the same required-photo checks.

## Seven-minute defense script

Open the three URLs in separate tabs before the defense. Use the same browser hostname. There is no need to change live records before presenting. The cinematic is entirely scripted and never writes to the API.

| Time          | Action                                                                                                                                                                                                                                                                       | What to explain / show                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0:00–1:30** | Open Ortaq 3D → **Watch our story**. Let the nine chapters play.                                                                                                                                                                                                             | A resident reports a cold radiator in apartment 45’s entrance, neighbours join, a plumber is assigned, proof closes the issue, money becomes visible, news reaches everyone, and an advisory poll lights up apartments. Pause, 2× and chapter buttons are available. |
| **1:30–2:00** | Switch to Resident. Read the first-launch guide → **Let’s meet your community**. Log in as `+77000000012`, OTP `1234`.                                                                                                                                                       | This is a phone-sized app for an ordinary resident. Open the dashboard’s small 3D card and point out the gold apartment window.                                                                                                                                      |
| **2:00–2:40** | Open **Money**, show the latest category donut and tap an expense.                                                                                                                                                                                                           | Amounts are in KZT. Each published month contains 18 generated demo receipts. Publications cannot be deleted; management must append a correction with a visible note.                                                                                               |
| **2:40–3:25** | Open **Issues → Report a problem**. Heating / entrance 2 / floor 5 suggests the existing radiator issue. Show **Me too**. For a fresh report change the floor to **6** and rename the title to **Cold corridor radiator**, choose **Use generated demo photo**, then submit. | Similar open problems are suggested before submission. Keep the fresh issue’s title recognizable. Its status starts as New.                                                                                                                                          |
| **3:25–3:55** | Switch to standalone 3D, return to live, and log in with the same resident phone and OTP. Find the new red pin at entrance 2 / floor 6. Click it.                                                                                                                            | Changes arrive within three seconds. The pin opens the description, photo and full history. A larger pin means more apartments are affected.                                                                                                                         |
| **3:55–4:50** | Open Management. Log in as chairman `+77000000001`. Open **Issue board** and move the fresh issue to **In Progress**. Assign **Astana Plumbing**. Save.                                                                                                                      | Dragging and opening a card both work. A contractor is required before work starts. Show the amber pin in 3D.                                                                                                                                                        |
| **4:50–5:35** | Move that issue to **Resolved**. Use the generated demo result photo and save. Return to 3D, then Resident → notification bell.                                                                                                                                              | Resolution requires proof. The pin turns green; the reporting resident receives a private in-app notification. Open it to see the complete audit trail.                                                                                                              |
| **5:35–6:15** | Resident → dashboard → the **A say in our shared home** card → vote on the open camera poll. Switch to live 3D.                                                                                                                                                              | Apartment 45’s window lights up. One apartment gets one ballot, even with several residents. Open results stay sealed; the separately seeded closed poll shows its results. These polls are explicitly advisory.                                                     |
| **6:15–7:00** | Management → **3D View → Balance overlay**. Then show Resident → **My private balance**. Optionally import `demo/balances.csv` as the accountant.                                                                                                                            | Only the chairman’s admin embed requests balance-colored windows. Residents see their own balance only. Finish with announcements, feedback, the winter/summer toggle, and the future neighbouring buildings.                                                        |

For a repeat presentation, the cinematic always replays from clean scripted data. Live records deliberately persist. Use a different open poll or create a fresh one if apartment 45 already voted. The chairman can close a poll early to reveal results. New reports for an already published month must use **Add a visible correction**.

## Implemented stories

| ID    | End-to-end behavior                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-01 | Phone challenge, fixed demo OTP, JWT session, invite registration                                                                                                                          |
| US-02 | Chairman creates building, one invite per apartment, revoke and rotate                                                                                                                     |
| US-03 | Publish monthly receipt-backed expenses; original publication preserved; append-only corrections                                                                                           |
| US-04 | Category donut, correct totals, individual receipt viewer                                                                                                                                  |
| US-05 | Resident photo report with category and entrance/floor or common-area location                                                                                                             |
| US-06 | Kanban, contractor assignment, required resolution photo, saved status history, reopen                                                                                                     |
| US-07 | Private reporter notifications and read state                                                                                                                                              |
| US-08 | Similar open issue suggestions and one “Me too” per apartment                                                                                                                              |
| US-09 | Announcements feed and resident notification fanout                                                                                                                                        |
| US-10 | Advisory polls, dates, one ballot per apartment, results only after closing                                                                                                                |
| US-11 | Atomic CSV balance imports and backend-enforced apartment privacy                                                                                                                          |
| US-12 | First-launch guide remembered in the browser and persisted feedback                                                                                                                        |
| 3D-01 | API polling, SSE endpoint, instanced windows, status pins, money particles, announcement waves, voting windows, balance overlay, both embeds                                               |
| 3D-02 | Nine scripted chapters, GSAP clock, smooth camera, phone mock-up, support sparks, walking worker, proof/notification, money, announcement, 68% poll result and neighbouring-building outro |

## Visual direction

The interface follows **120 windows. One shared home.** A warm Astana winter courtyard, a window-shaped identity and a personal story connect the three applications. The public 3D entrance works before sign-in; its story action opens the scripted 90-second film. A keyboard-accessible window picker complements direct 3D selection. **Follow the money** focuses the camera on the shared fund.

The phone and tablet use dedicated scene compositions. Local Libre Franklin and Source Serif 4 fonts avoid runtime CDN requests; their SIL OFL notices are bundled. Both embedded previews start at Low quality, and software renderers automatically start at Low while retaining the manual quality control. Reduced-motion preferences disable entrance travel and ambient snow and use camera cuts in the film.

See the [art direction](docs/design/art-direction.md) and [visual review](docs/design/review.md) for the decisions, screenshots and verification limits.

## Architecture and data

- `backend/`: Go `net/http`, pgx, SQL migration, HS256 JWTs and role-checked REST handlers. API startup requires a signing key with at least 32 characters. The Compose key is an intentional demo default.
- `flutter/`: **one** Flutter project with `lib/main_resident.dart` and `lib/main_admin.dart`. Bundled text fonts cover English, Cyrillic and KZT without runtime font downloads. Shared components keep the palette and interaction patterns consistent. Copy lives in `strings_resident.dart` and `strings_admin.dart`, including parameterized labels for later Kazakh/Russian translations.
- `web3d/`: React 18, Vite, TypeScript, Three.js, React Three Fiber, drei, postprocessing, Zustand and GSAP. All geometry, environment lighting and generated demo imagery are local. The scene has no runtime image/font/HDR CDN dependency.
- `deploy/nginx.conf`: all three web services proxy `/api` to Go. Browser API URLs therefore follow their own origin. Flutter’s iframes receive the session via an origin-checked `postMessage`; JWTs never appear in iframe URLs.
- `backend/internal/app/migrations/001_state.sql`: creates the durable JSONB aggregate and migration ledger. **Demo design choice:** one PostgreSQL row represents the application state. Each mutation locks it with `SELECT … FOR UPDATE`, validates and commits atomically. That serializes simultaneous apartment votes, imports and invitation changes across API instances. It is deliberately a small demo storage model; a larger deployment should separate the aggregate into relational tables and adopt a migration runner for subsequent schema versions.
- Images live on a named disk volume. Uploads accept PNG, JPEG and WebP up to 10 MB; media requires a valid session and matching building. Seed placeholders are clearly labeled generated demo images.

The seed building is **ЖК Ortaq Demo**, Kabanbay Batyr Ave 60, Astana: 3 entrances, 9 floors, 120 apartments. The seed includes the previous three complete calendar months (18 expenses each), six categories, 10 issues with histories, 3 announcements, an open camera poll, a closed bench poll with 68/32 results, and all 120 balances. Apartment 45 is explicitly mapped to entrance 2, floor 5 in the 3D demo’s numbering plan. Each apartment has exactly one unique cell.

Money is stored as integer KZT. A positive balance is prepaid; a negative balance is debt; zero is paid. `demo/balances.csv` has the required `apartment,balance` header. Bad amounts, out-of-building apartments or duplicate rows reject the entire import.

## Privacy and live updates

The API looks up the current account from the JWT subject; clients cannot choose their role, building or apartment. Resident snapshots contain only the requesting apartment’s balance and the requesting resident’s phone. There is no public directory of phone numbers.

`GET /scene` excludes balances and phones. `GET /scene?balances=true` requires the chairman role; the overlay control is offered only inside the admin embed. Accountant and resident requests to the overlay return 403. `GET /balances` and CSV imports require chairman or accountant; `GET /balances/me` derives the apartment from the session and rejects a different requested apartment.

The 3D app and Flutter snapshots refresh every 3 seconds. `GET /events` also exposes an authenticated SSE stream (`event: snapshot`), with heartbeats and connection cancellation, for future clients. It accepts a Bearer header, not URL tokens. The browser app uses polling for a simple, reliable defense setup.

The cinematic uses local deterministic state, never POST/PATCH requests. Its display is labeled **SCRIPTED DEMO · NO DATABASE CHANGES**. Live updates resume when returning to live mode.

## Tests and verification

```sh
make test                         # backend tests with Go’s race detector
make check                        # backend tests + Compose configuration
cd web3d && npm install && npm test && npm run build
# After the five services are running:
make smoke                        # creates a clearly named SMOKE TEST issue
```

Backend coverage includes auth/tamper/expiry/attempt limits, role and building isolation, invite revocation, report arithmetic and immutable revisions, status transitions and result photos, notification privacy, duplicate apartment support, concurrent apartment ballots, sealed results, balance access, atomic CSV rejection, upload content types and media scope, and SSE authorization. Domain checks verify 120 unique cells, apartment 45’s floor, monetary corrections, all cinematic boundaries and continuous camera coordinates.

A real PostgreSQL integration test additionally verifies migrations, restart persistence and competing votes through two independent connection pools. It creates and drops its own unique schema:

```sh
TEST_DATABASE_URL='postgres://USER:PASSWORD@localhost:5432/TEST_DB?sslmode=disable' make test
```

`.github/workflows/demo.yml` runs database-backed tests, 3D tests/build, all Docker builds and the full running-service smoke check on a Docker-enabled runner.

### Verified and remaining checks

The following pass in the authoring environment:

- Backend tests with Go’s race detector, plus Compose configuration validation.
- `flutter analyze --no-pub` with **no issues** and release web builds of **both** Dart entry points, using the pinned Flutter 3.35.7 SDK.
- Strict TypeScript checking, the complete Vite production build (including postprocessing and GSAP), and all six 3D domain checks.
- Browser layout/interaction checks of the compiled bundles: onboarding, resident OTP login, expense breakdown, receipt viewing, duplicate suggestions, photo-required submit, the management board, both iframe session handshakes, authenticated admin overlay requests, and cinematic pause/seek controls. The cinematic made zero write requests during the check. These browser checks use generated API fixtures through Playwright request routing because the sandbox cannot run listening services. They do not replace the real-stack smoke check.

Remaining verification:

- **Docker daemon access is denied.** The actual `docker compose up --build` attempt stops before container builds. Full container startup and `make smoke` against running services remain unverified here.
- **Local TCP and Unix sockets are blocked.** PostgreSQL could not bind either kind of socket. The real PostgreSQL integration test is present but skipped without `TEST_DATABASE_URL`. CI runs it on a normal PostgreSQL service.
- **60 fps on integrated GPU hardware is not benchmarked.** The browser check is a visual check, not a hardware performance result. Low quality disables postprocessing and shadow maps, caps DPR at 1, and is both embeds’ default.

The command sandbox also blocks outbound DNS. Missing dependencies and the Flutter SDK were obtained through browser downloads for the checks above. These temporary caches are excluded from Git and Docker. Normal Docker builds download the declared dependencies themselves. The pinned Flutter dependency lockfile is included.

All requested feature source is present. Remaining work is to run the full Docker/PostgreSQL smoke check and a performance check on the defense laptop, then address any failures those reveal. Production SMS, push delivery, payment collection, legally binding voting and multi-building rollout are outside this explicitly scoped demo.

## Screenshots from browser checks

The screenshots use the compiled applications and seeded API fixtures:

- [Moonlit 3D entrance](docs/screenshots/3d-arrival.png)
- [Phone composition](docs/screenshots/3d-phone.png)
- [Tablet composition](docs/screenshots/3d-tablet.png)
- [Live 3D money flow](docs/screenshots/3d-live.png)
- [Management overview](docs/screenshots/admin-overview.png)
- [Resident home and live 3D card](docs/screenshots/resident-home.png)
- [Onboarding](docs/screenshots/resident-onboarding.png)
- [Monthly report](docs/screenshots/resident-report.png)
- [Chairman issue board](docs/screenshots/admin-board.png)
- [Cinematic process](docs/screenshots/cinematic.png)
- [Scripted advisory result](docs/screenshots/advisory-cinematic.png)

## Story commit history

The authoring runner mounts an empty `.git` directory read-only. Real local commits are therefore retained in **`.history.git`**, with one commit per requested story, in order, each subject starting with its story ID. Any final validation fixes follow those story commits.

```sh
./scripts/git log --oneline
./scripts/git status --short
```

`ortaq-history.bundle` is an exported copy of that history. To use normal Git commands in a new directory:

```sh
git clone ortaq-history.bundle ../ortaq-demo
```

The alternate metadata location and bundle are not part of the Docker build context.
