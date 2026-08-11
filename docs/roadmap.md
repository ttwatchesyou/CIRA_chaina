# Development roadmap

| Phase | Outcome | Verification gate |
| --- | --- | --- |
| 1 | Project creation, project overview, navigation, SQLite/Prisma foundation | `yarn db:deploy`, `yarn typecheck`, `yarn build` |
| 2 | Multi-file/folder/ZIP image upload, hashing, queue, thumbnail library | Complete: server validation, duplicate handling, thumbnail and ZIP integration tests |
| 3 | Konva annotation canvas, classes, undo/redo, auto-save | Complete: persistence, class deletion, ownership isolation, TypeScript and lint checks |
| 4 | Versioned deterministic dataset generation and YOLO ZIP export | Complete: split/layout, YOLO conversion, Original/120/320/640 exports, letterbox coordinate tests, ZIP integrity, deletion cleanup, and ownership isolation |
| 5 | Independent worker registration, heartbeat, machine status | Complete: token auth, machine specs, heartbeat, port discovery and 30-second offline timeout |
| 6 | Training queue, job control, real-time logs/progress | Complete: multi-Dataset bundle, queue, claim, real Ultralytics CPU/GPU runner, Epoch metrics, cancel, retry and cache cleanup |
| 7 | Model artifacts, metrics, downloads, results view | Complete: authenticated `best.pt`/`last.pt`/`results.csv` upload, Models UI and Ultralytics-style ZIP download; CPU end-to-end smoke test verified |
| 8 | Production hardening | Pending: multi-GPU field testing, account authorization, PostgreSQL/object storage, worker token rotation and deployment monitoring |

Each phase retains backwards-compatible database migrations and keeps paths under `storage/` out of the database payload. Do not begin a new phase until its build, TypeScript check, routes, and migration are verified.
