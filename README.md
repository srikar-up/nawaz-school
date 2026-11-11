# Nawaz School RMS — React PWA prototype

A working replacement prototype for the failed Flutter app, built as **two separate web applications** that share one temporary Node/JSON data service:

| Workspace | Folder | URL | Design target |
| :--- | :--- | :--- | :--- |
| **Teacher app** | `teacher-app/` | `/teacher/` | Mobile-first installable PWA |
| **Admin console** | `admin-panel/` | `/admin/` | Desktop-first installable PWA |
| **Shared data API** | `server/` | `/api/*` | Temporary local cache until Firebase |

Both apps are React 18 + Vite + plain CSS, with custom design tokens based on `school_rms_ui_design_system.md` and the reference images. Data is connected live through Server-Sent Events, so a teacher submitting attendance or marks updates the admin console immediately, and admin announcements/requests appear in the teacher app.

---

## 1. Quick start

```powershell
npm install
npm run build
npm start
```

Then open **http://localhost:4000/** for the launcher.

- Teacher PWA: http://localhost:4000/teacher/
- Admin PWA: http://localhost:4000/admin/
- API health: http://localhost:4000/api/health

### Development mode (hot reload)

```powershell
npm run dev
```

This starts:

- API server on `http://localhost:4000`
- Teacher app on `http://localhost:5173`
- Admin app on `http://localhost:5174`

The Vite dev servers proxy `/api` to the Node server, so the apps behave the same as the production build.

### Reset the demo data

Use **Admin → Settings → Reset demo database**, or:

```powershell
npm run seed
```

The server seeds a new `server/data/db.json` on first start if the file is missing.

---

## 2. Demo accounts

| App | Person | Email | Password |
| :--- | :--- | :--- | :--- |
| Admin | Dr. Tariq Nawaz (SuperAdmin) | `admin@nawazschool.edu` | `admin123` |
| Admin | Mr. Usman Ali (SubAdmin) | `subadmin@nawazschool.edu` | `subadmin123` |
| Teacher | Prof. Sarah Nawaz | `teacher@nawazschool.edu` | `teacher123` |
| Teacher | Dr. Imran Khan | `imran@nawazschool.edu` | `teacher123` |
| Teacher | Ms. Ayesha Siddiqa | `ayesha@nawazschool.edu` | `teacher123` |
| Teacher | Mr. Bilal Siddiqui | `bilal@nawazschool.edu` | `teacher123` |

All apps also expose one-click demo buttons on their sign-in screens.

> These credentials are demo-only. The server uses a small in-memory account map, not production authentication. See [Firebase later](#10-firebase-later).

---

## 3. What is implemented

### Teacher PWA

- Sign-in with demo accounts and university-style demo shortcut.
- **Home** — greeting, live date, next class, attendance hero, quick actions, today's schedule, urgent notice, attendance summary, risk students, work counters, recent notices.
- **Attendance** — class selector for incharge sections, date/session, default present, Present/Absent/Late/Excused control, reason presets + custom note, live summary, edit after submission, save to shared API, plus a GitHub-style **monthly student register**: one row per student, every day across the row, status-coloured squares and a rate column. The session picker follows the school attendance mode set by the admin: either **Morning / Afternoon** or a single **Full day** register.
- **Classes** — assigned sections, class rosters, attendance and scores, student detail sheet, guardian phone action.
- **Tasks** — school-wide exam list with the assigned teacher named on every card; only the assigned teacher can enter marks, while colleagues' submitted results open read-only. Includes automatic open/submitted states, marks validation, live average, confirmation and exam lock; assignment list and create/review/delete flow.
- **Timetable** — follows the admin-configured Monday–Friday or Monday–Saturday week, including Saturday periods created in the admin builder, with live/next period highlighting and whole-school view.
- **Syllabus** — assigned subjects, chapter progress ring, tap-to-cycle chapter status saved to API.
- **Reports** — printable student progress slip, attendance + assessments, teacher remark, parent-ready WhatsApp message.
- **Requests** — leave, maintenance, equipment and confidential requests; status and principal note; separate from public notices.
- **Notices** — priority filters, pinned/urgent sections, expandable feed.
- **School directory** — searchable faculty and staff list with role, department, email/phone actions, teaching load and assessment duties; filter for teachers or office/support staff.
- **More / Profile** — install prompt, preferences, sync status, directory link, admin-panel link, sign out.
- PWA manifest, service worker, generated icons, offline banner and last-known data cache.

### Admin console

- Split-screen sign-in with SuperAdmin/SubAdmin demo accounts.
- **Overview** — school KPIs, pictogram launchpad, attendance trend chart, agenda, class registers, risk radar, recent announcements and activity.
- **Attendance** — date stepper, school-wide stats, class submission status, register review/correction drawer, CSV export, and a GitHub-style **monthly student register** with whole-school/class filtering, student search, status-coloured day squares and per-student rates. A register switch toggles between Morning / Afternoon and the single Full day view, matching the school attendance mode.
- **Settings** — school profile, attendance mode (morning + afternoon, or one full-day register), SupAdmin guard, account card, data connection info, JSON backup, student CSV export, data-exchange shortcut, admin install prompt, demo reset, sign out.
- **Students** — searchable/filterable/paginated directory, add/edit/delete, CSV import and export, student detail drawer with attendance and scores.
- **Staff & access** — SuperAdmin-only directory, roles and access levels, staff profile, create/edit/delete, attendance status, self-protection rules.
- **Classes & subjects** — class selector, subject-teacher assignment with instant timetable propagation, syllabus progress, full weekly timetable grid with a link into the builder.
- **Curriculum & syllabus** — one shared syllabus per class standard (for example Grade 10 Mathematics) with a subject × section coverage matrix. Create a subject with chapters, share it with every section of the grade, or add it to the missing sections later. Chapters can be typed, pasted as a plain numbered list, or pasted as JSON; a **Copy prompt** button produces a ready-made prompt for a syllabus photo in any AI chat, and the JSON reply fills the editor. Editing a curriculum updates every section while keeping each section's chapter progress by chapter name. Includes a typed-table test suite, an isolated API test and an admin UI test.
- **Timetable builder** — principal/admin weekly editor for every class. Configure working days Monday–Friday or Monday–Saturday, add/remove periods, edit start/end times, assign subject/teacher/room per slot, detect teacher and class clashes before save, keep the draft editable through Sunday, and publish/reopen when final.
- **Exams & marks** — schedule/delete assessments, statuses, result matrix, grade distribution, CSV export, pass/fail summaries.
- **Assignments** — cross-school assignment table, status changes, create/delete.
- **Announcements** — composer (audience, priority, pin) and searchable feed with pin/unpin/delete.
- **Requests & leave** — filters, approval workflow, principal note, confidential principal vault restricted to SuperAdmin.
- **Reports** — live attendance trend, enrollment and grade donuts, subject performance, risk table, plain-language executive summary, print/CSV.
- **Data exchange** — two-way CSV system for all 15 datasets. Export a ZIP containing one CSV per collection plus `manifest.json`, `schema.json`, `data.json` and a README; import the ZIP, individual CSVs or a JSON backup. Files are parsed and validated entirely in the browser first, with per-dataset insert/update/remove counts, foreign-key and calculation checks, error report download, merge/upsert or replace modes, then atomic commit to the shared cache and live sync to both apps.
- Global search with `Ctrl/Cmd+K`, notification popover, live sync chip, responsive off-canvas sidebar.
- PWA manifest, service worker, icons.

### Shared server

- Express REST API with file persistence at `server/data/db.json`.
- Seeded demo school generated relative to today:
  - 56 students, 4 sections (10-A, 10-B, 9-A, 9-B)
  - 12 staff with SuperAdmin/SubAdmin/TeacherApp/NoAccess levels
  - 24 subject offerings with chapters, 120 timetable periods
  - 24 school days of attendance (one class intentionally pending today)
  - 9 exams across submitted/open/upcoming, assessment records
  - assignments, announcements, requests, staff attendance, class incharges, activity log
- Server-Sent Events endpoint for live sync.
- Timetable endpoints for cell upsert/delete and week settings, with teacher/class overlap checks, Monday–Saturday configuration, Sunday editing window and publish lock.
- Atomic CSV import endpoint (`POST /api/import`) with SuperAdmin guard, schema version check, duplicate-ID/foreign-key/nested-entry validation, derived-field recalculation and merge/replace modes.
- Server-side authorization checks for admin, SuperAdmin and class attendance incharge.
- Attendance-mode enforcement: the server accepts only the session types that match `meta.attendanceMode` (morning + afternoon, or one full-day register) and rejects the rest without writing.
- Static hosting of both built PWAs and a launcher page with live API status.
- Demo reset endpoint.

---

## 4. Folder structure

```text
school pwa/
├── teacher-app/                 # Mobile-first React PWA
│   ├── public/                  # manifest, service worker, icons, favicon
│   └── src/
│       ├── components/          # shell, sheet, badges, rings, toast, etc.
│       ├── context/             # session, cache, SSE live sync
│       ├── lib/                 # API client + formatters/domain helpers
│       ├── pages/               # Home, Attendance, Classes, Tasks, ...
│       └── styles/              # tokens.css + app.css
├── admin-panel/                 # Desktop-first React PWA
│   ├── public/
│   └── src/
│       ├── components/          # sidebar, topbar, charts, tables, modals
│       ├── context/
│       ├── lib/                 # API client, formatters, CSV/ZIP data exchange
│       ├── pages/               # Overview, Students, Staff, Exams, Data exchange, ...
│       └── styles/
├── server/
│   ├── src/seed.js              # deterministic demo school
│   ├── src/store.js             # JSON persistence + change events
│   ├── src/import-validation.js # schema, merge and atomic import validation
│   ├── src/index.js             # REST API + SSE + static hosting
│   ├── public/index.html        # launcher page
│   ├── data/db.json             # generated at runtime (gitignored)
│   ├── smoke-test.mjs           # API + shared-data tests
│   └── ui-test.mjs              # Chrome browser route checks + screenshots
├── screenshots/                 # generated verification screenshots
├── docs/                        # original legacy-product documentation
├── reffrense image/             # design references
├── school_rms_ui_design_system.md
└── README.md
```

---

## 5. Shared data model (temporary cache)

The JSON database contains these collections:

```text
meta
staff
classes
students
subjects
timetable
exams
testRecords
assignments
attendanceSessions
staffAttendance
classIncharges
announcements
rmsTickets
activities
```

The app clients read the whole dataset from `GET /api/state` and listen to `/api/events`. When another client writes, the SSE event triggers a debounced refetch; the current state is also stored in `localStorage` for offline preview.

### API endpoints

```text
GET    /api/health
POST   /api/auth/login
GET    /api/state
GET    /api/events?staffId=...

POST   /api/students
PATCH  /api/students/:id
DELETE /api/students/:id
POST   /api/students/bulk

POST   /api/staff
PATCH  /api/staff/:id
DELETE /api/staff/:id

POST   /api/attendance

PUT    /api/timetable
DELETE /api/timetable/:id
PATCH  /api/timetable/settings

POST   /api/exams
PATCH  /api/exams/:id
DELETE /api/exams/:id
POST   /api/exams/:id/marks

PATCH  /api/subjects/:id
POST   /api/subjects/:id/chapters

POST   /api/curricula
PATCH  /api/curricula/:id
POST   /api/curricula/:id/apply
DELETE /api/curricula/:id

POST   /api/assignments
PATCH  /api/assignments/:id
DELETE /api/assignments/:id

POST   /api/announcements
PATCH  /api/announcements/:id
DELETE /api/announcements/:id

POST   /api/rms
PATCH  /api/rms/:id

PATCH  /api/meta
POST   /api/import
POST   /api/reset
```

Every non-auth request uses the temporary `x-staff-id` session header. The server checks active staff, role and class-incharge status for sensitive writes.

---

## 6. Verification

### Build

```powershell
npm run build
```

Result:

```text
teacher-app: 1615 modules transformed, built successfully
admin-panel: 1618 modules transformed, built successfully
```

### API + shared-data smoke test

Start the server first (`npm start`), then:

```powershell
npm run test:api
```

It verifies:

- API health
- launcher and both PWA HTML bundles
- manifests, service workers and icons
- admin and teacher login; wrong password rejection
- seed data counts
- admin announcement → teacher state
- teacher attendance → admin state
- teacher request → admin approval → teacher state
- school-wide exam visibility; non-assigned teacher blocked from marks entry (HTTP 403)
- teacher marks submission → admin result matrix
- admin student create/delete
- CSV import: invalid foreign key rejected with HTTP 422; full 15-dataset import accepted, normalized and synced
- timetable builder: Saturday enabled, teacher conflict rejected, published timetable locked, slot removed
- demo reset restores seed

Latest run:

```text
✓ API health
✓ Launcher page
✓ Static PWAs
✓ PWA assets
✓ Admin login
✓ Teacher login
✓ Password validation
✓ Seed data — 56 students · 12 staff · 120 periods
✓ Admin → teacher announcement
✓ Teacher → admin attendance
✓ Teacher → admin request
✓ Admin decision → teacher
✓ Teacher exam scope
✓ Teacher marks → admin results
✓ Student CRUD
✓ CSV data exchange
✓ Timetable builder
✓ Demo reset

All smoke tests passed.
```

### Browser UI test with screenshots

Requires Google Chrome (or update `CHROME` in `server/ui-test.mjs`):

```powershell
npm run test:ui
```

It drives both apps in headless Chrome, visits every route, opens the result matrix, student modal, timetable settings and slot editor, and global search; checks that teachers see colleague exams read-only while retaining marks entry only on their own exam; verifies the school directory and the per-student monthly attendance register; exports the full CSV bundle, re-imports it, validates it locally and commits it through the server; fails on any console/page error; checks the SubAdmin restrictions; and writes screenshots to `screenshots/`.

Latest run:

```text
Teacher home rendered
Teacher route /attendance, /attendance/registry, /classes, /tasks, /more,
              /timetable, /syllabus, /reports, /requests, /notices, /staff, /profile
Teacher exam list shows colleagues read-only and own evaluation action
Non-assigned open exam is blocked from marks entry
Submitted colleague exam is viewable read-only
Admin overview rendered
Admin route /attendance, /attendance/registry, /students, /staff, /classes,
             /timetable, /exams, /assignments, /announcements, /requests,
             /reports, /data, /settings
Monthly attendance registry rendered student rows and class filtering
Timetable builder settings and slot editor opened
CSV bundle exported, re-imported and validated locally
Validated CSV bundle committed and synced through the server
Admin result matrix opened
Admin student modal opened
Admin global search opened and returned results
SubAdmin restrictions enforced in the UI

All browser checks passed with no console or page errors.
```

Screenshots include:

- `teacher-loading.png`, `teacher-login.png`, `teacher-home.png`, `teacher-attendance.png`
- `teacher-classes.png`, `teacher-tasks.png`, `teacher-exams-all.png`
- `teacher-attendance-registry.png`, `teacher-staff.png`, `teacher-exam-readonly.png`
- `teacher-timetable-saturday.png`
- `admin-login.png`, `admin-overview.png`, `admin-attendance.png`
- `admin-students.png`, `admin-staff.png`, `admin-classes.png`
- `admin-exams.png`, `admin-results.png`, `admin-announcements.png`
- `admin-attendance-registry.png`, `admin-attendance-registry-class.png`
- `admin-timetable.png`, `admin-timetable-settings.png`, `admin-timetable-slot.png`
- `admin-data-exchange.png`, `admin-data-import-preview.png`, `admin-data-imported.png`
- `admin-requests.png`, `admin-reports.png`, `admin-settings.png`
- `admin-student-modal.png`, `admin-search.png`, `admin-subadmin-restricted.png`

---

## 7. Design decisions

- **Separate frontends, shared data.** Teacher and admin are independent PWAs, not one role-switched app.
- **Teacher = mobile-first speed.** Single column, bottom navigation, large touch controls, sticky save, warm indigo + yellow hero inspired by the teacher reference.
- **Admin = calm oversight.** Fixed sidebar, large pictogram launchpad, pastel KPI cards, charts, dense but readable tables inspired by the admin references.
- **Shared brand tokens.** Indigo `#4338CA`, yellow `#FACC15`, teal `#0D9488`, off-white background, Plus Jakarta Sans.
- **School crest.** The white-background crest appears on the teacher splash/login, while the transparent crest is used in the admin sidebar, admin sign-in and loading screens.
- **Accessible status language.** Attendance always shows words, not color alone; large targets and visible labels.
- **No fake success.** Actions await server responses; failures show the real server message.
- **Local-first data portability.** CSV files are parsed and validated in the browser before commit. The server re-validates the same schema, recalculates derived fields and writes atomically, so a partial or failed import cannot leave mixed data.
- **Editable timetable week.** Working days and period times are school settings, not hard-coded. The week defaults to a draft through Sunday, only publishes when the principal/admin explicitly locks it, and enforces teacher/class clash checks on every slot write.
- **Attendance as a register.** Daily records are arranged like the reference: one student per row, every day of the month across the row, and status-coloured squares with a per-student rate column. Present, late, excused, absent and missing registers are distinct; the table scrolls horizontally with sticky student and rate columns.
- **Printing works.** Student slips and executive reports have print styles; browser “Save as PDF” produces a real PDF.
- **WhatsApp share is real.** The teacher report opens a prefilled `wa.me` link instead of pretending a message was sent.
- **PWA installability.** Manifests, service worker shell cache and masked icons are present; the UI prompts via the browser install event when available.

---

## 8. Resolved legacy issues

Unlike the old Flutter prototype, this codebase intentionally fixes:

- separate teacher/admin clients and builds
- one temporary shared data source instead of RAM-only state
- server-enforced admin/incharge/assignee checks for main writes, including exam marks
- school-wide exam visibility with evaluation restricted to the assigned teacher
- working inline edits instead of fake “Save” snackbars
- one attendance status vocabulary (`present`, `absent`, `late`, `excused`)
- one pass threshold (35%) across teacher marks and admin reports
- real CSV exports and student CSV import
- real print/PDF and WhatsApp handoff
- no demo passwords in production builds (the local shim is documented)

---

## 9. Known prototype limitations

These are deliberately deferred until Firebase/backend integration:

- **Auth**: `x-staff-id` header shim with demo credentials, not secure production authentication. Replace with Firebase Auth custom claims.
- **Persistence**: JSON file on the local server, not concurrent multi-school storage. Replace with Firestore/Firebase Storage.
- **Live sync**: whole-state SSE refetch, not granular Firestore snapshots. Fine for a demo, not for scale.
- **Push notifications**: not implemented; preferences are saved locally and labelled as future Firebase functionality.
- **Excel**: full CSV bundle import/export is implemented for all datasets; the legacy 14-sheet `.xlsx` pipeline is not ported yet. Convert workbooks to the exported CSV layout first.
- **Attachments**: announcement images and request attachments are not implemented in this prototype.
- **Multi-year history**: a single 2026–2027 academic year is seeded. The timetable builder edits the active week template; per-week historical snapshots are not versioned yet.
- **Impersonation / audit viewer / deep RBAC matrix**: not ported; the activity feed is a lightweight audit trail.
- **FCM / WhatsApp Cloud API**: WhatsApp uses the OS web share link; there is no verified delivery receipt.

---

## 10. Firebase later

The client/server boundary is already isolated in:

- `teacher-app/src/lib/api.js`
- `admin-panel/src/lib/api.js`

To migrate:

1. Create a Firebase project, Auth, Firestore and Storage.
2. Mirror the shared collections from `server/src/seed.js` into Firestore.
3. Replace `api.getState`, mutations and `EventSource` with Firebase SDK calls and `onSnapshot` listeners.
4. Add custom claims for `SUPER_ADMIN`, `SUB_ADMIN`, `TEACHER`, `NO_ACCESS`.
5. Move validation and attendance/marks permissions into Firestore security rules or Cloud Functions.
6. Replace local demo accounts with Firebase Auth; remove the `x-staff-id` shim.
7. Keep the same screens, routes and visual tokens.

The teacher/admin split, data shapes, print views and UI state have been designed to survive that move.

---

## 11. Useful commands

```powershell
npm run dev            # API + both Vite dev servers
npm run dev:server     # API only
npm run dev:teacher    # teacher dev server
npm run dev:admin      # admin dev server
npm run build          # production build of both PWAs
npm start              # serve API + both built PWAs on :4000
npm run seed           # force-reseed the JSON demo database
npm run test:api       # shared-data smoke tests (server must be running)
npm run test:ui        # Chrome route checks + screenshots (server must be running)
npm run test:attendance       # attendance-mode rules (no servers needed)
npm run test:attendance:api   # API enforcement on an isolated instance
npm run test:attendance:ui    # teacher + admin mode UI (dev servers needed)
npm run test:attendance:flow  # full-day submit, isolated API + teacher build
npm run test:photo           # profile photo crop/preview/upload, isolated
npm run test:polish          # unsaved guard, help dialog, full-day topbar (dev servers)
npm run test:curriculum      # curriculum rules and AI/JSON pasting
npm run test:curriculum:api  # curriculum API on an isolated instance
npm run test:curriculum:ui   # curriculum admin page on an isolated instance
```

For the visual prototype and design rationale, see `target.md` (the UI/UX design
system for both apps) and `school_rms_architecture_lifecycle_blueprint.md`
(architecture and lifecycle), plus the reference images in `reffrense image/`
and the generated screenshots in `screenshots/`.

---

## Current architecture

> The hosting notes earlier in this file describe the original single-origin
> prototype (/teacher and /admin under one server). They are superseded.

| Layer | Runs on | Notes |
| --- | --- | --- |
| Teacher PWA | Vite + React | own origin, built with `base: '/'` |
| Admin panel | Vite + React | own origin, built with `base: '/'` |
| API | Express | own origin |
| Database | Firestore | reached only through the Firebase Admin SDK |
| Media | Cloudinary | signed uploads, signature issued by the API |
| Auth | Firebase Auth | `Authorization: Bearer <idToken>` |

The browser never talks to Firestore: `firestore.rules` denies all client
access and only the server holds Admin credentials.

### Local development

```
npm run dev            # API :4000, teacher :5173, admin :5174
npm run build          # builds both PWAs
npm --workspace server run start
```

Serve both PWAs from the API server for a production preview:
`http://localhost:4000/teacher/` and `/admin/`.

### Authentication

Firebase UIDs equal staff ids (`STF-001`), so a verified token maps directly
to a staff record. Create or refresh the demo accounts:

```
npm --workspace server run create:users
```

### Google sign-in

Both login screens offer **Continue with Google** next to the password form.

- The server resolves the Google account by its **verified email** when the uid
  is not a staff id (`resolveStaff` in `server/src/auth.js`). An unknown or
  unverified email gets `403 No staff profile is linked to this account`.
- Firebase's default "one account per email" rule means the first Google
  attempt for an existing password account fails with
  `account-exists-with-different-credential`. The client keeps that credential
  and links it silently on the next password sign-in, so Google is passwordless
  from then on.
- To skip that one-time password step, set **Firebase Authentication →
  Settings → User account linking → Create multiple accounts for each identity
  provider**. The email mapping then handles Google users directly.
- Required in the Firebase console, once per origin:
  - **Authentication → Sign-in method → Google** enabled.
  - **Authentication → Settings → Authorized domains**: add
    `nawaz-school-teacher.srikarsensai.workers.dev` and
    `nawaz-school-admin.srikarsensai.workers.dev`.

No Google client secret exists in either app; the popup is handled entirely by
Firebase Auth, and the API still sees only an ID token.

### Profile photos

1. Choosing a file opens a **crop and preview dialog** first: drag to reposition,
   zoom 1×–3×, rotate in 90° steps, reset, and see the result at small and large
   avatar sizes. Nothing is uploaded until **Save photo** is pressed.
2. The framed square is rendered to a 512×512 WebP (quality 0.8) in the browser.
3. `POST /api/auth/cloudinary-sign` returns parameters signed for that exact
   `public_id` - after checking the caller may edit that record.
4. Browser uploads straight to Cloudinary.
5. `PATCH /api/{staff|students}/:id/photo` stores
   `{ url, publicId, updatedAt, updatedBy }`.

`Avatar` accepts the stored `photo` metadata everywhere, so an uploaded image
replaces the initials on the profile, Home, More, the admin topbar/sidebar,
student and staff lists, and reports. If an image fails to load, the avatar
falls back to initials instead of a broken image.

RBAC: Principal / SuperAdmin edit anyone; a teacher edits only their own photo.

### Attendance mode

Schools either keep **two registers a day** (morning and afternoon) or a
**single full-day register**. The admin picks the mode in **Settings →
Attendance mode**; it is stored as `meta.attendanceMode`:

| Value | Session types | Teacher UI |
| --- | --- | --- |
| `twoSessions` (default) | `Morning`, `Afternoon` | segmented Morning / Afternoon control |
| `fullDay` | `FullDay` | one **Full day** button plus a short explanation |

Rules:

- The server is the source of truth. `POST /api/attendance` rejects a session
  type that does not match the mode with a plain-language `400`, and nothing is
  written.
- `PATCH /api/meta` accepts only `twoSessions` or `fullDay`; anything else is a
  `400`.
- Changing the mode never rewrites existing registers. Old sessions keep the
  type they were submitted with, and admin views filter by the selected type.
- The teacher UI follows a live mode change without a reload; a teacher's
  in-progress selection is replaced only when the saved mode actually changes.
- Imports and backups that predate the setting, or carry an unknown value, fall
  back to the current server mode instead of failing.
- Shared helpers live in `server/src/attendance-mode.js`, with identical copies
  in `teacher-app/src/lib/attendance.js` and
  `admin-panel/src/lib/attendance.js`; a unit test checks the three stay in
  sync.

### Curriculum and syllabus

A **curriculum** is the syllabus for one class standard, for example Grade 10
Mathematics. It is stored in the `curricula` collection and shared by every
section of that grade, while each section keeps its own subject offering in
`subjects` so teachers can track chapter progress separately.

- **Admin → Curriculum** shows a subject × section coverage matrix. Green means
  the subject already exists in that section; amber means it is missing.
- Creating a subject can immediately add it to every section of the grade.
  Existing teacher assignments are kept.
- Chapters can be typed one per line, pasted as a numbered list, or pasted as
  JSON. The editor accepts:
  - `["Chapter 1", "Chapter 2"]`
  - `[{ "title": "Chapter 1" }]`
  - `{ "subjectName": "Mathematics", "chapters": [...] }`
- **Copy prompt** copies an instruction block for any AI chat. Attach the
  syllabus photo there, paste the reply into the JSON box, then press
  **Fill chapters from this**. Nothing is sent to an AI service from the app.
- Editing a curriculum updates every linked class offering. Chapter progress is
  matched by chapter title, so reordering or renaming other chapters does not
  reset completed work; new chapters start as not started.
- Renaming a subject also updates timetable, exam and assignment labels that
  point at it.
- Removing a curriculum removes it from the standard only. Class subject cards,
  chapters and teacher assignments stay.
- The teacher **Syllabus** screen reads the same class offerings, so a teacher
  sees new chapters after the admin shares or edits the curriculum.
- Existing databases are migrated once at boot: shared curricula are derived
  from the current class subjects and `meta.curriculaSeeded` prevents the
  migration from running again.

### Tests

```
npm run test:db                             # Firestore architecture, isolated namespace
npm run test:auth                           # auth identity mapping
npm run test:attendance                     # attendance-mode rules + app parity
npm run test:attendance:api                 # mode enforcement, isolated API :4100
npm run test:attendance:ui                  # teacher + admin UI, needs dev servers
npm run test:attendance:flow                # full-day submit through the teacher UI, isolated
npm run test:photo                          # crop/preview/upload, isolated API + Cloudinary folder
npm run test:polish                         # unsaved-attendance guard, help dialog, full-day topbar
npm run test:curriculum                     # curriculum rules + AI/JSON parsing
npm run test:curriculum:api                 # curriculum API, isolated :4100
npm run test:curriculum:ui                  # admin curriculum page, isolated API + Vite
node server/test/profile-photo.e2e.mjs      # needs dev servers running
node server/test/profile-ui.e2e.mjs
node server/test/live-sync.e2e.mjs
node server/test/photo-cleanup.e2e.mjs
npm run test:production                     # hits the three deployed Workers
node server/test/google-mapping.e2e.mjs     # verified-email identity path, self-cleaning
```

---

## Deployment (Cloudflare Workers)

Three independent Workers, three separate origins:

| App | Worker | URL |
| --- | --- | --- |
| Teacher PWA | `nawaz-school-teacher` | https://nawaz-school-teacher.srikarsensai.workers.dev |
| Admin panel | `nawaz-school-admin` | https://nawaz-school-admin.srikarsensai.workers.dev |
| API | `nawaz-school-api` | https://nawaz-school-api.srikarsensai.workers.dev |

A custom domain can replace these later with `routes`/`custom_domains` in each
`wrangler.jsonc`; no application code depends on the `workers.dev` names.

### Build and deploy

```bash
export VITE_API_URL=https://nawaz-school-api.srikarsensai.workers.dev
export VITE_TEACHER_URL=https://nawaz-school-teacher.srikarsensai.workers.dev
export VITE_ADMIN_URL=https://nawaz-school-admin.srikarsensai.workers.dev

npm run build
npm run deploy:api        # wrangler deploy --config server/wrangler.jsonc
npm run deploy:teacher
npm run deploy:admin
```

`npm run deploy:teacher` / `deploy:admin` must run with the app workspace as the
current directory (the npm workspace scripts do this for you); Wrangler resolves
`assets.directory` relative to its config file.

### API secrets

The API Worker holds these as encrypted secrets. Upload them from a local file
that is never committed:

```bash
npx wrangler secret bulk server/.dev.vars --config server/wrangler.jsonc
```

| Secret | Purpose |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin credentials for the REST layer |
| `FIREBASE_API_KEY` | Web API key used to resolve ID tokens |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | signed uploads and deletes |
| `CORS_ORIGINS` | comma-separated teacher + admin origins |

Variables (not secrets) live in `server/wrangler.jsonc`: `RUNTIME=workers`,
`DATA_BACKEND=firestore`, `DISABLE_FILE_CACHE=true`.

After a `wrangler rollback`, re-run the `secret bulk` command: a Worker version
created earlier can predate secrets added later, and the API will fail to boot
without them. A boot that exceeds 20s now returns `503` instead of hanging.

### Why the API has a REST Firebase layer

`firebase-admin` cannot run on Workers: its Firestore client speaks gRPC over
raw TCP. `wrangler.jsonc` therefore aliases `firebase-admin/app|firestore|auth`
to `server/src/workers/*`, which implement the same surface over Google's REST
APIs (service-account JWT minted with WebCrypto, ID tokens validated through
Identity Toolkit). The Node server keeps using the real Admin SDK.

`DISABLE_FILE_CACHE=true` turns off the local `db.json` mirror on Workers; the
in-memory database is hydrated from Firestore on the first request, and
`context.waitUntil(flushStore())` keeps each mutation alive until it is written.

Cold-start safeguards, because a Worker call is the first request a teacher makes:

- `OPTIONS` preflights never wait for the database, so CORS cannot fail during a
  slow boot.
- Every Google call has an 8–10s timeout and one retry.
- Boot is capped at 20s and returns `503` (with CORS headers) instead of hanging.
- A Worker never falls back to seed data when Firestore is unreachable: a later
  mutation would overwrite the real database. Node keeps its JSON fallback.
- `/` on the API Worker returns a JSON description instead of trying to read
  project files that do not exist in the Workers runtime.

### Local Workers runtime

```bash
npx wrangler dev --config server/wrangler.jsonc   # http://127.0.0.1:8787
```

Secrets come from `server/.dev.vars` (git-ignored).
