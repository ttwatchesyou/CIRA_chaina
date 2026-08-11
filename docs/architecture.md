# Architecture

## Scope of the current release

The platform currently runs as a single internal computer-vision workspace without a login screen. Project management, server-backed image ingestion, class management, bounding-box annotation, and immutable YOLO dataset generation use the shared `account_mo` owner; the existing account/session schema remains available for re-enabling login later.

## Components

```text
Browser (Next.js App Router)
  ├─ Direct access to one shared workspace
  ├─ Server-rendered project pages
  └─ REST API routes
        ├─ Shared-workspace ownership checks
        ├─ Service layer (business rules and transactions)
        ├─ Repository layer (Prisma queries)
        ├─ SQLite now / PostgreSQL later
        └─ Server file storage

Training Worker (separate process)
  ├─ register + heartbeat HTTP calls
  ├─ download generated dataset
  ├─ poll and claim jobs assigned to that worker
  ├─ download the immutable Dataset ZIP
  ├─ run Python + PyTorch + Ultralytics on CPU or NVIDIA GPU
  ├─ upload best.pt, last.pt, and results.csv to the Server
  └─ report heartbeat, progress, metrics, cancellation, and logs to the API
```

The web app never runs model training itself. The worker is deliberately a separate app so a training PC can be added, replaced, or disconnected without taking the browser application down.

## Data flow

1. Opening the app selects the shared `account_mo` workspace without requiring a session cookie.
2. A user submits the Create Project modal.
3. `POST /api/projects` validates the payload with Zod and creates a `Project` owned by the shared workspace with its `ActivityLog` in one Prisma transaction.
4. The UI redirects to `/projects/:projectId`; every page, image route, and mutating endpoint uses the same shared owner.
5. Upload validates JPG/PNG/WebP signatures, calculates SHA-256, writes the source file and a generated thumbnail under the shared storage subtree, and stores only metadata in `Image`. ZIP extraction is bounded by compressed size, image count, per-image size, and total expanded size.
6. A time-limited mobile QR link is a project-specific upload capability; the link is revoked on demand or after expiry and uses the project owner's storage subtree.
7. The Konva workspace loads annotations per image. Box edits are kept in an undo/redo history, debounced into an ordered auto-save queue, validated at the API boundary, and stored as normalized `x`, `y`, `width`, and `height` values from 0–1.
8. Deleting a class with related annotations requires explicit confirmation; the server removes those annotations transactionally and recalculates affected image statuses.
9. Dataset generation snapshots the current classes and annotated images, assigns deterministic Train/Validation/Test splits, copies source images, converts normalized boxes to YOLO label files, and writes `data.yaml` plus `dataset.json`. The user may retain original files or choose 120, 320, or 640-pixel square exports.
10. Fixed-size exports auto-orient each source image, preserve its aspect ratio, add YOLO-style gray letterbox padding, encode JPEG at quality 88, and transform every normalized box into the padded coordinate space. The same policy is applied to all splits.
11. Each Dataset Version receives a monotonic project version number in the shared workspace directory. Download streams a ZIP without loading the whole archive into memory; deletion also removes generated storage.
12. Each Training Worker authenticates with a shared internal API token, registers a stable `WORKER_KEY`, sends a heartbeat every 5–10 seconds, and is marked offline after 30 seconds without a heartbeat.
13. A Training Job is pinned to one or more immutable Dataset Versions and one Worker. A compatibility primary Dataset relation is retained, while `TrainingJobDataset` records the ordered complete selection.
14. Before download, the Server builds one temporary YOLO bundle: class names are merged case-insensitively, class indexes are remapped, filenames are prefixed, original split assignment is retained, and duplicate source Image IDs keep the first selected occurrence.
15. The Worker claims queued work, downloads the merged Dataset ZIP, and reports lifecycle events. Job snapshots are also available through an SSE endpoint.
16. The Worker safely extracts the bundle, resolves its `data.yaml`, runs Ultralytics, reports each completed Epoch, and reacts to cancellation by terminating the Python process.
17. The Worker uploads `best.pt` first, followed by optional `last.pt` and `results.csv`. Only after those uploads succeed does it mark the job Completed.
18. Worker job cache and the Server's temporary merged bundle are removed on completion, failure, or cancellation; logs and uploaded Model artifacts remain on the Server. Simulation remains an explicit opt-in mode for queue diagnostics and never creates a fake `.pt` file.

## Storage convention

```text
storage/
  accounts/account_mo/
    projects/<projectId>/original/    # source image files
    projects/<projectId>/thumbnails/  # generated thumbnails
    datasets/<datasetVersionId>/      # YOLO images, labels, data.yaml
  training/<trainingJobId>/logs/      # worker logs
  models/<projectId>/<trainingJobId>/ # best.pt, last.pt, result files (or legacy Simulation report)
```

The database contains paths and metadata only—never base64 image data. `STORAGE_ROOT` may point to local disk or a mounted server volume. An external object-storage provider is intentionally not assumed; adding S3, Google Drive, or another provider requires provider-specific credentials and an adapter.

## Database portability

Prisma has a single datasource. Use SQLite locally with `DATABASE_URL=file:./dev.db`; a future deployment can change the datasource provider and URL to PostgreSQL. Lifecycle/status values are stored as constrained application strings rather than SQLite-incompatible database enums. IDs are CUIDs and all timestamps use Prisma defaults, both of which migrate cleanly.

## API conventions

Every route returns one of these shapes:

```ts
{ data: T }
{ error: { code: string; message: string; issues?: Record<string, string[] | undefined> } }
```

Input validation stays at API boundaries. Pages access the service layer directly for server rendering, preventing UI components from owning database logic.
