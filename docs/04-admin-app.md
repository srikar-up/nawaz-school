# 04 — Admin Command Center

> **Target user:** principal / owner / academic head / operator.
> **Demo identity:** Dr. Tariq Nawaz · `superadmin@school.com` · SuperAdmin.
> **Entry point:** runtime role switch from the teacher app → `AdminScreen`.
> **Shell:** `lib/features/admin/presentation/admin_screen.dart`.

---

## 1. Entry, login, and loading

### 1.1 How an admin actually enters

1. Teacher app → header/quick action → “Switch to SaaS Admin Console” or “Admin Panel”.
2. `MockDatabase.setRole(UserRole.admin)` notifies listeners.
3. `MainNavScreen` rebuilds.
4. If `db.isAdminAuthenticated` is true (the default), `AdminScreen` opens immediately.
5. If the admin previously signed out, `AdminLoginScreen` appears.

There is **no protected route** and no server-side session.

### 1.2 `AdminLoginScreen`

File: `lib/features/admin/presentation/screens/admin_login_screen.dart`

- 45/55 split: forest-green branding pane with logo + capabilities; white form pane.
- Email field pre-filled `superadmin@school.com`.
- Password field pre-filled `admin12345`, obscured, with visibility toggle.
- “Keep session active” checkbox (local only).
- “Forgot Key?” → snackbar (“Contact Principal IT Office”).
- Quick presets:
  - SuperAdmin: `superadmin@school.com` / `superadmin123`
  - SubAdmin/Ops: `ops.head@nawazschool.edu` / `ops12345`
- “Switch to Teacher Mobile Workspace”.
- Submit:
  - Validates email contains `@` and password non-empty.
  - Waits 600 ms.
  - Calls `AuthService.canAccessWindowsAdminStatic(email, staffDirectory: db.staffList)`.
  - `superadmin@school.com`, `ops.head@nawazschool.edu`, `subadmin@school.com`, `operator@nawazschool.edu` are hardcoded as allowed.
  - Otherwise, the staff record's `canAccessWindowsAdmin` must be true (`SuperAdmin` or `SubAdmin`, active).
  - **Password is never verified.**
- On success, `db.loginAdmin(...)` stores name/role and `_isAdminLoading` is set; the loading screen shows.

### 1.3 `AdminLoadingScreen`

- Repeats an animated logo.
- Steps:
  1. Connecting to Cloud Datastore & Firestore Gateway…
  2. Fetching 7 Master Schema Datasets…
  3. Validating Institutional RBAC Staff Clearance…
  4. Compiling Live Spreadsheet Matrix & Analytical Trends…
  5. Ready! Launching Windows Admin Command Center…
- Each step waits 280 ms; total ~1.7 s. No real work is done.

---

## 2. Console shell

### 2.1 Layout

```text
┌──────────────────────┬────────────────────────────────────────────────────┐
│ Sidebar 230px        │ Top command bar                                    │
│ - brand              │ - global search                                    │
│ - core modules       │ - sync telemetry pill                              │
│ - in-app editors     │ - notifications + admin identity                   │
│ - operations & RMS   ├────────────────────────────────────────────────────┤
│ - teacher switch     │ Master workbook action banner                      │
│                      ├────────────────────────────────────────────────────┤
│                      │ Active module canvas                               │
└──────────────────────┴────────────────────────────────────────────────────┘
```

The design is desktop-first: 230 px sidebar, dense tables, 4–10 px radii, slate background `#F8FAFC`, forest green `#0F4C30`, mint `#10B981`.

### 2.2 Sidebar modules

| Section | Module | Badge | Restriction |
| :--- | :--- | :--- | :--- |
| Core | Dashboard Overview | — | — |
| Core | Student Attendance Hub | LIVE | — |
| Core | Attendance Access Desk | INCHARGE | — |
| Core | Subject Assignments | ALLOC | — |
| Core | Exam Assignment Hub | EXAM | — |
| Core | Staff & Access Hub | RBAC | SuperAdmin only |
| Core | Announcements Hub | FCM | — |
| Core | Multi-Excel Center | 7-XLSX / 6-XLSX | — |
| Core | Analytical Trends | — | — |
| Editors | Live Spreadsheet Grid | LIVE | — |
| Editors | Teacher Audit Viewer | — | — |
| Editors | Executive PDF | — | — |
| Operations | Leave Desk | alert count | — |
| Operations | Maintenance Logs | alert count | — |
| Operations | Principal Vault | alert count | SuperAdmin only |
| Operations | Profile & Security | ROOT/OPS | — |

The SubAdmin restriction is only a sidebar hide + view guard; the underlying DB methods are callable from anywhere.

### 2.3 Top command bar

- Global search field: writes to `_gridSearchQuery`; only affects the live-grid state, not a global search.
- “Active Sync: 4 Master CSVs Linked • 14ms” — static.
- Notification bell with red dot if any pending RMS.
- Admin identity card (hardcoded subtitle “Principal (Admin Clearance)”).

### 2.4 Master workbook action banner

- Badge “MASTER WORKBOOK”.
- Filename `nawaz_school_master_database.xlsx (All Collections)`.
- “Download Master (.xlsx)”:
  - Calls `AdminStateController.downloadMasterWorkbook()`.
  - Generates 14 sheets from the current in-memory DB via `ExcelMasterService.exportMasterWorkbook`.
  - Snackbar says 14 tabs.
- “Open In-App Grid” → index 6.
- “Upload Spreadsheet / XLSX”:
  - File picker; if `.xlsx`, stages the workbook and opens the ingestion center.
  - If text/CSV, auto-detects schema and ingests immediately.

---

## 3. Module-by-module specification

### 3.1 Dashboard Overview — index 0

File: `admin_screen.dart` → `_buildBentoDashboard`.

**Header:** “Administrative Command Center”, actions “Exam Management” → analytics, “Edit Spreadsheets In-App” → grid.

**KPI row**

| Card | Value | Status |
| :--- | :--- | :--- |
| Total Enrolled Students | `db.students.length` | ✅ live |
| Active Faculty Members | `db.facultyList.length` | ✅ live (but faculty list is separate from staff list) |
| Institutional Attendance | `db.schoolWideAttendanceRate` | ✅ live from student statuses |
| Academic Risk Radar | `db.schoolWideAtRiskStudents.length` | ✅ live |

**Daily Attendance Registry Matrix**

`AdminAttendanceSummaryWidget`:

- Date picker.
- Stats: institutional rate, total enrolled, present, absent, late.
- Class teacher roll-call submission table: section, teacher, submitted time, rate.
- Absent/late roster with parent phone and “call parent” snackbar.
- Prefers `AttendanceService.getInstitutionDailyStatsStream(date, fallbackDb: db)`; when Firestore is unavailable, uses in-memory statuses.
- Fallback class statuses are partly hardcoded: 10-A with 94% rate, 9-A with 91.5% rate.

**Syllabus Delivery Balance & Velocity Matrix**

- Half-donut gauge is **hardcoded 67% completed / 20% in progress / 13% pending**.
- “Weekly Institutional Target: +14 Topics / Week (On Schedule)” — static.
- Velocity rows are **hardcoded**:
  - Mathematics / Grade 10-A / Prof. Sarah Nawaz / 75% / +3 topics/wk / On Track
  - Physics / Grade 10-A / Dr. Imran Ali / 45% / 1 topic/wk / Behind Pace
  - General Science / Grade 9-A / Ms. Ayesha Malik / 82% / +4 topics/wk / Ahead
  - Chemistry / Grade 10-A / Prof. Sarah Nawaz / 70% / +2 topics/wk / On Track
  - Computer Science / Grade 10-A / Mr. Bilal Siddiqui / 60% / +2 topics/wk / On Track
- Note that these teacher names do not match the seeded staff (`Dr. Imran Khan`, `Ms. Ayesha Siddiqa`). The copy is cosmetic.

**Risk Radar**

- Count from `db.schoolWideAtRiskStudents`.
- Static banner: “Grade 10-A Physics Class Mean: 44% — Critical baseline failure (<50%)”.
- Lists up to 2 at-risk students with average scores.

**Quick RMS & Leave Action Desk**

- Shows first leave ticket with Approve → `RmsStatus.approved`.
- Shows first maintenance ticket with Resolve → `RmsStatus.resolved`.
- Counts “N Pending” from leave + maintenance lengths (not filtered by status).

**Ledger status bar**

- live row counts for students, marks, timetable, syllabus.
- “Cloud Sync Engine v2.4 Active” — static.

**Assessment:** a strong visual dashboard, but only the KPI counts, attendance matrix, and risk list are real. The curriculum and velocity panels are static.

---

### 3.2 Multi-Excel Center — index 1

File: `screens/multi_excel_center_screen.dart`.

**Purpose:** download, inspect, validate, and commit bulk school data.

#### Hero banner

- `nawaz_school_master_database.xlsx`, described as “14-tab”.
- “Upload Master (.xlsx)” and “Download Unified Workbook (.xlsx)”.
- **SubAdmin sees only blueprints with index < 7** in the dataset strip; SuperAdmin sees all 14.

#### Dataset blueprint switcher

Each tab shows a short title and current row count:

`Students Roster → Incharge Permissions → Subjects & Syllabus → Master Timetable → Staff Daily Attendance → Student Daily Sessions → Monthly Attendance Rollup → Attendance Registry → Marks Ledger → Syllabus Topics → RMS & Leave Desk → Exam Schedules → Staff & RBAC Hub → Announcements Hub`.

#### Staged workbook health grid

After uploading `.xlsx`:

- Parses with `ExcelMasterService.parseAndValidateMasterWorkbook`.
- Produces a `MasterWorkbookHealthReport`:
  - overall validity,
  - total rows,
  - sheets found,
  - per-sheet `SheetHealthCard` with missing headers, errors, warnings, parsed rows,
  - execution time.
- UI text claims “All 8 Sheets” in several places even though the service defines 14 required sheets.
- Per-tab cards show present/missing, valid/invalid, row count, first error.
- “Discard Workbook” and “Commit All 8 Datasets to Cloud Database” (label stale; code commits all 14).

#### Schema inspector

For the active blueprint:

- Required headers as green badges.
- Header descriptions.
- Validation rules.
- Foreign-key requirements.
- CSV boilerplate sample.

#### Single-sheet staging

- File picker or paste raw CSV.
- `stageRawCsv`:
  - Reads header line.
  - Compares to current blueprint's required headers.
  - Stores validation errors and up to 10 preview rows.
- 3-row preview table (actually up to 10 rows in state; the label says 3).
- Commit calls `db.parseAndIngestCsv(targetType, rawCsv)`.

#### Commit result dialog

- Success/failure icon.
- Message.
- Rows processed / inserted / updated.
- Error log list.
- “Open In Live Grid →” on success.

#### Gaps

- The master workbook parser validates headers and parses rows but **does not validate value types, duplicate keys, foreign keys, or timetable collisions** before commit. Those checks are scattered in `MockDatabase` ingest methods.
- The commit is not atomic across sheets; a later sheet can fail after earlier sheets have mutated state.
- The actual repo workbooks have 8/9 sheets, not 14.
- Some UI copy says 7/8 datasets, while the code has 14.
- The workbook has no styling/bold headers despite the snackbar claim.
- No versioning, no import history, no rollback.

---

### 3.3 Live Spreadsheet Grid — index 6

File: `screens/live_spreadsheet_grid_screen.dart`.

**Purpose:** view and edit every dataset without Excel.

#### Toolbar

- Grade filter: All / 9 / 10 / 11 / 12.
- Section filter: All / 10-A / 10-B / 9-A / 9-B.
- Faculty filter from `db.facultyList`.
- Live search.
- Reset.
- Download master `.xlsx`.
- Add Row.
- Ingestion Center shortcut.

#### Dataset tabs

All 14 datasets with live row counts. SubAdmin sees only the first 7.

| Index | Dataset | Grid behaviour |
| :---: | :--- | :--- |
| 0 | Students Roster | Table; edit opens inline fields; Save shows snackbar and **does not write to DB**; Delete works. |
| 1 | Incharge Permissions | Read-only table. |
| 2 | Subjects & Syllabus | Read-only table. |
| 3 | Master Timetable | Table; delete works; add via toolbar. |
| 4 | Staff Attendance | Read-only table. |
| 5 | Student Daily Sessions | Reuses the cumulative attendance grid. |
| 6 | Monthly Attendance Rollup | Also reuses the cumulative attendance grid. |
| 7 | Attendance Registry | 4-way status toggle per student; increments cumulative attendance. |
| 8 | Marks Ledger | Read-only table; delete works. |
| 9 | Syllabus Topics | Toggle completion; delete works. |
| 10 | RMS Archive | Table; status dropdown updates ticket. |
| 11 | Exam Schedules | Table; delete works. |
| 12 | Staff & RBAC | Table; inline access elevation; activate/deactivate; delete. Hidden for SubAdmin. |
| 13 | Announcements | Read-only table. |

#### Add Row modal

Dataset-specific fields:

- Students: name, section, phone.
- Attendance: name, section, held/attended (creates a student then records attendance — this is conceptually wrong).
- Marks: name, section, subject, marks, max.
- Timetable: subject, section, fixed Monday 08:30–09:15 / Room 204.
- Syllabus: topic, section, subject, chapter.
- RMS: teacher/author, section, subject/tag, message.
- Exams: subject, section, category, date, max marks.

Adds directly to `MockDatabase` and shows a “Synced to Cloud” snackbar.

#### Gaps

- Inline “Save” for students is fake.
- The same attendance grid is reused for daily and monthly datasets, so those tabs are mislabeled.
- No column sorting despite “Sorting Center”.
- No pagination/virtualisation; large schools will stutter.
- No validation beyond “name not empty”.
- Editing is limited to students/staff/RMS status; most datasets are read-only.

---

### 3.4 Analytical Trends — index 2

File: `admin_screen.dart` → `_buildAnalyticalTrendsView`.

**Purpose:** formal exam management and subject analytics.

- Header and “+ Setup Formal Exam”.
- Principal-mandated exam list from `db.principalMandatedExams`:
  - title, subject, class, weightage, max marks, class mean, pass/fail counts.
- “ANALYTICS: CLASS 10-A MATHEMATICS” block:
  - “Class Mean (μ): 74% / Passing Benchmark” — hardcoded.
  - Grade distribution rows: “A Grade (>85%) 8 Students”, “B Grade (50–84%) 22 Students”, “Failing (<35%) N Students” — first two hardcoded, failing count live.
- “Setup Formal Institutional Exam” dialog:
  - Category: mid-term or end-term.
  - Class: 10-A or 9-A.
  - Subject: Mathematics, Physics, General Science.
  - Title, total marks, weightage.
  - Calls `db.createPrincipalExamination(...)` with a date 14 days ahead.
  - Inserts a cohort `TestRecord` with 65% initial scores and `isPrincipalMandated = true`.
- No trend line chart, no historical timeline, no subject selector, no per-student drill-down.

---

### 3.5 Leave Desk — index 3

File: `admin_screen.dart` → `_buildLeaveManagementDesk`.

- Filters tickets classified as staff leave or leave request.
- Shows ticket ID, sender name/email, subject, body.
- “Approve Leave” → `RmsStatus.approved` + principal note.
- “Reject” → `RmsStatus.rejected` + note.
- No date range, no leave balance, no substitution assignment, no attachment.

---

### 3.6 Maintenance Logs — index 4

- Filters maintenance and facility/gear tickets.
- Shows room or [Maintenance], reporter, subject, body.
- “Mark Resolved” → `RmsStatus.resolved`.
- “Assign Work Order” → `RmsStatus.underReview` + note.
- No assigned technician field in UI, no SLA, no cost, no history.

---

### 3.7 Principal Vault — index 5

- SuperAdmin only.
- Locked state: PIN field (`1234` hint) and “Unlock Secure Vault”.
- **The PIN is not checked**; any input unlocks.
- Unlocked: list of confidential tickets (subject, sender, body), “Lock Vault”.
- No encryption, no audit log, no redaction.

---

### 3.8 Teacher Audit Viewer — index 7

- Left console:
  - Faculty dropdown (`db.facultyList`).
  - “Audit Profile View” button (snackbar only).
  - Telemetry: derived pseudo-UUID, assigned classes, “Google Pixel 8 Pro • Android 14”, “14ms”.
  - Screen chips: Dashboard, Roll Call, Timetable, Marks, Syllabus, RMS.
- Right pane: 340×640 phone chassis containing an `IndexedStack` of the **real teacher widgets**:
  - `DashboardScreen`
  - `AttendanceScreen`
  - `TimetableScreen`
  - `MarksScreen`
  - `SyllabusScreen`
  - `ReportsScreen`
  - `RmsScreen`
- The widgets all use the same `MockDatabase` and the hardcoded teacher identity. Selecting another faculty member changes telemetry but **not** the data or screens.
- No real impersonation, no read-only lock, no consent/audit record.

---

### 3.9 Executive PDF — index 8

- Header with “Compile Executive PDF Audit”.
- Static preview card:
  - attendance compliance 96%,
  - Grade 10-A Physics risk <50%,
  - 67% syllabus completion.
- Button shows a snackbar claiming a file was written to `C:\SchoolManagement\Exports\Audits\executive_audit_report.pdf`.
- **No PDF library, no file, no query.**

---

### 3.10 Staff & Access Hub — index 9

File: `screens/staff_access_hub_screen.dart`.

**Purpose:** universal staff directory and RBAC.

**Metrics:** total employees, SuperAdmins, SubAdmins, TeacherApp accounts, no-access accounts. Live counts from `db.staffList`.

**Toolbar:** staff type, access level, department filters, search, reset.

**Table:** staff ID, name, type, department, phone, email, privilege dropdown, status toggle, edit, delete.

**Add/Edit modal**

- Staff ID (disabled when editing; uniqueness checked).
- Full name.
- Corporate email (uniqueness checked; basic format).
- Phone.
- Staff type: Principal, Vice Principal, Teacher, Operator, Electrician, Bus Driver, Support Staff.
- Access level: SuperAdmin, SubAdmin, TeacherApp, NoAccess.
- Auto-suggests access level based on staff type.
- Privilege description callout.
- Department.
- Active switch.
- Calls `db.addNewStaffMember` / `db.updateStaffMember`.
- Delete confirmation.

**Access levels**

| Level | Intended capability |
| :--- | :--- |
| SuperAdmin | Full admin, imports, RBAC, vault, role delegation. |
| SubAdmin | Academic/operator access; cannot alter staff roles. |
| TeacherApp | Teacher workspace only. |
| NoAccess | Operational staff; no login. |

**Gaps**

- RBAC is not enforced outside sidebar/guard code.
- Deleting/altering a SuperAdmin is allowed.
- No invitation/activation flow, no password, no audit.
- Staff directory (`staffList`) and faculty list (`facultyList`) are separate, so “Active Faculty” and “Staff” counts differ.
- Duplicate seeded staff ID `OPS-004` exists (electrician and support staff both use it).

---

### 3.11 Announcements Hub — index 10

File: `screens/admin_announcement_screen.dart`.

**Composer (left, 440 px)**

- Headline title (required).
- Target audience: All, TeachersOnly, StudentsOnly, Class10, Class9.
- Priority pills: Normal, Important, Urgent, Emergency.
- Publisher signature.
- Sticky pin switch (auto-on for urgent/emergency).
- Body (required, 5 lines).
- Image attachment (via file picker; converted to a data URI by `AnnouncementService`).
- Publish button.

**Ledger (right)**

- Filter chips by priority, search.
- Sorted pinned-first then newest.
- Card: priority, audience, pinned, relative time, title, body, publisher, optional image, Pin/Unpin, Delete.
- Publish writes to `db.announcements` and, if Firestore is available, `announcements/{id}` with merge.
- Urgent/emergency “push” only prints to console.

**Gaps**

- Attachment path is questionable: `FileImporter` returns text `content`; the screen converts `content.codeUnits` to bytes, which corrupts binary images.
- No scheduling, expiry, draft, delivery receipts, or read tracking.
- Audience filtering is implemented in the teacher stream, but no server-side query/index for all combinations.

---

### 3.12 Student Attendance Hub — index 12

File: `views/attendance/student_attendance_hub_screen.dart`.

**Purpose:** admin attendance oversight and correction.

**Top control bar**

- Section: 10-A, 10-B, 9-A, 9-B.
- Date navigator (previous / picker / next).
- Session: Morning, Afternoon, Full Day.
- Incharge badge: “Incharge: X” or “View Only (Incharge: X)”.
- “Mark All Present” and “Save & Sync to Sheet”.

**KPI row:** attendance rate, total roster, present, absent, late/excused.

**Workspace modes**

1. **Live Roll-Call**
   - Roster table with roll, name/ID, 4-way P/A/L/E toggle, remarks icon.
   - Tapping a row selects the student for the inspector.
   - Remarks dialog.
   - Read-only when the active staff (`STAFF-01`) is not the class incharge.
2. **Monthly Matrix Grid**
   - Days 1–31 columns, status code per day, monthly rate.
   - Uses `db.getDailyMatrixForMonth`.

**Student Inspector**

- Current status.
- Identity card.
- Monthly percentage ring and present/absent/late counts.
- Absence log with “Mark Excused”.
- “Call Parent” snackbar.
- “WhatsApp Alert” snackbar.

**Persistence**

- `AttendanceController.saveAndSync()` → `db.batchSaveDailyAttendance` → recompute monthly summary/matrix.
- No Firestore call in this path.

**Gaps**

- Only four sections in the picker (no 10-B/9-B/11/12 despite other screens using them).
- Incharge identity is hardcoded `STAFF-01`; the admin is always “View Only” for classes where another staff is incharge.
- “Call Parent” and “WhatsApp Alert” are simulations.
- Monthly matrix defaults missing days to Present, which can overstate attendance.
- Recompute duplicates “days present” as effective attended (late counts half) — labels can be misleading.

---

### 3.13 Attendance Access Desk — index 13

File: `screens/attendance_access_hub_screen.dart`.

**Purpose:** decide who may take roll-call for each section.

**Rule:** default is the Period-1 timetable teacher; admin can override with any staff member.

**UI:** grade filter, section cards (10-A, 10-B, 9-A, 9-B, 11-A, 11-B, 12-A, 12-B). Each card shows:

- Section badge.
- Default Period-1 teacher.
- “Admin Override” or “Period 1 Default” tag.
- Active incharge dropdown.
- Reset to default (when overridden).

**Persistence:** `db.setClassInchargeOverride(...)` / `db.getPeriod1TeacherForClass(...)`.

**Gaps**

- Only 4 sections have seeded incharge records; others fall back to `STAFF-01`.
- Period-1 detection scans the timetable for `periodNumber == 1`; if the timetable is empty or has no period 1, it falls back to STAFF-01.
- No effective-date or academic-year versioning.
- The teacher app does not actually enforce this gate.

---

### 3.14 Subject Assignments — index 14

File: `screens/subject_assignment_hub_screen.dart`.

**Purpose:** assign a teacher to a subject in a section.

**Rules stated in code:**

- Subject code is grade-wide (e.g. `MATH-10`).
- A teacher can teach multiple subjects/sections.
- The same subject can have different teachers in different sections.
- Teachers should only see their assigned subjects.

**UI:** grade filters, assignment cards with subject code, subject name, section, syllabus module count, assigned faculty dropdown.

**Add Assignment modal:** subject dropdown, section dropdown, faculty dropdown; code derived from subject abbreviation + grade.

**Persistence:** `db.updateSubjectAssignment(...)` — updates the matching subject/section or creates a new `SubjectModel` with two default chapters.

**Gaps**

- Subject list is a fixed six-item list.
- No workload/conflict validation.
- No deletion/end-date.
- New assignments get default placeholder chapters (“Fundamentals & Introduction”, “Core Concepts…”), not real curriculum.
- Teacher scoping is loose string matching, not a real assignment table.

---

### 3.15 Exam Assignment Hub — index 15

File: `screens/exam_assignment_hub_screen.dart`.

**Purpose:** create assessments and assign them to teachers.

**Form**

1. Assessment type: Unit Test/CA-1, Class Test/CA-2, Mid-Term, End-Term.
2. Target class: 10-A, 10-B, 9-A, 9-B.
3. Subject: Mathematics, Physics, Chemistry, English, Computer Science, Biology.
4. Assigned faculty: dropdown from `staffList` (falls back to two hardcoded teachers).
5. Exam date (`YYYY-MM-DD`).
6. Max marks (auto-suggests 50/100 by category).

**Submit**

- Builds `EXAM-{section}-{subject3}-{category}-{timestamp%1000}`.
- `db.addExamSchedule(schedule)`.
- Status banner with teacher name/email.
- Snackbar.

**Roster**

- All exams with category, effective status, subject/section, assigned teacher, date/time, max marks, delete.
- Shows `TOTAL`, `OPEN`, `SUBMITTED` states via `ExamScheduleModel`.

**Gaps**

- No start/end time fields in the form (defaults 09:00–11:00).
- No section filtering on the roster.
- No conflict detection with timetable/other exams.
- No edit, only delete.
- Auto-unlock is based on device time; clock skew affects it.

---

### 3.16 Profile & Security — index 11

File: `screens/admin_profile_screen.dart`.

- Hero identity card with name, role badge, email, staff ID.
- Sign out → `db.logoutAdmin()`.
- RBAC privilege matrix:
  - Master Excel ingestion (full/6 datasets)
  - Staff directory & RBAC (root/restricted)
  - Principal vault (root/restricted)
  - Live grid
  - FCM broadcast
  - Teacher impersonation
- Session/device card (Windows 11, TLS 1.3, local security store, Executive Suite 101) — static.
- “Change Password” dialog — accepts any values and shows success; no update.
- “Open Teacher Mobile Workspace” → role switch.

---

## 4. Admin use cases

| ID | Use case | Trigger | Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| A-01 | Sign in | Role switch / sign-out | Admin console | 🟡 password ignored |
| A-02 | View school KPIs | Dashboard | Counts/attendance/risk | ✅ live counts |
| A-03 | Review daily attendance | Dashboard | Matrix + absent list | ✅ in-memory |
| A-04 | Download master workbook | Multi-Excel Center | 14-sheet `.xlsx` | ✅ generated |
| A-05 | Upload/validate/commit workbook | Multi-Excel Center | In-memory data replaced/merged | ✅ with gaps |
| A-06 | Paste/import a single CSV | Multi-Excel Center | Auto-detected ingest | ✅ |
| A-07 | Browse 14 datasets | Live Grid | Tables | ✅ |
| A-08 | Add a student | Live Grid | Student added | ✅ |
| A-09 | Inline-edit a student | Live Grid | Should persist | 🔴 fake save |
| A-10 | Delete students/marks/timetable/syllabus/exams/staff | Live Grid | Removed from RAM | ✅ |
| A-11 | Manage staff and RBAC | Staff Hub | CRUD + access level | ✅ in-memory |
| A-12 | Override attendance incharge | Access Desk | Incharge changed | ✅ |
| A-13 | Assign subject teacher | Subject Hub | Assignment changed | ✅ |
| A-14 | Schedule/assign exam | Exam Hub | Exam in teacher queue | ✅ |
| A-15 | Take/administer attendance | Attendance Hub | Daily + monthly records | ✅ |
| A-16 | Approve/reject leave | Leave Desk | Ticket status | ✅ |
| A-17 | Resolve/assign maintenance | Maintenance | Ticket status | ✅ |
| A-18 | Read confidential notes | Vault | Notes shown | 🟡 fake PIN |
| A-19 | Audit teacher screen | Audit Viewer | Real teacher widgets | 🟡 not scoped |
| A-20 | Compile executive PDF | Executive PDF | File produced | 🔴 snackbar |
| A-21 | Publish announcement | Announcements Hub | Feed item | ✅ |
| A-22 | Pin/delete announcement | Announcements Hub | Feed change | ✅ |
| A-23 | Change password | Profile | Password updated | 🔴 fake |
| A-24 | Sign out | Profile | Login screen on next admin switch | ✅ |

---

## 5. Admin screens not in the main navigation

These exist but are superseded or unused:

| File | Why it matters |
| :--- | :--- |
| `admin_screen.dart` → `_buildMultiExcelCenter()` | Older 5-tab ingestion UI; dead code. |
| `admin_screen.dart` → `_buildInAppSpreadsheetGridEditor()` | Older 4-sheet grid; dead code. |
| `views/dashboard/admin_dashboard_screen.dart` | Older admin dashboard; not routed; has compile errors. |
| `views/dashboard/widgets/*` | Panels for the old dashboard; not used by current admin. |

---

## 6. Admin experience gaps to fix in the rewrite

1. **Real authentication.** Verify passwords, use secure sessions, and remove demo presets from production.
2. **Server-side RBAC.** SuperAdmin/SubAdmin/Teacher/NoAccess must be enforced by the API and database, not by hidden sidebar items.
3. **Real data tables.** Add server-side pagination, sorting, filtering, bulk selection, and optimistic updates with rollback.
4. **Persistent inline editing.** Every editable cell must issue a validated mutation and show an error if it fails.
5. **Import pipeline.** Validate types, keys, foreign keys, duplicates, and timetable collisions before any write; make the commit transactional or report per-sheet results; support rollback.
6. **One schema.** Align the 14-tab workbook, Firestore collections, and UI models.
7. **Real analytics.** Compute trends, distributions, and velocity from records; remove hardcoded 67%/74%/44% copy.
8. **Real reporting.** Generate PDF/CSV from live queries; save to a known path or download.
9. **Real audit tool.** Impersonation must be explicit, read-only, time-boxed, consent-aware, and logged.
10. **Real vault.** Require re-authentication, encrypt sensitive notes at rest, and audit access.
11. **Staff/faculty unification.** One staff directory should drive faculty lists, RBAC, timetable, and incharge resolution.
12. **Bulk operations.** Add multi-select delete, CSV export per dataset, and import history.
13. **Responsive behaviour.** The admin layout assumes a wide screen; add a compact layout or explicitly require desktop.
14. **Accessibility.** Dense 8.5–11 px text and tiny controls fail accessibility; the rewrite should set a minimum readable size and keyboard navigation.
