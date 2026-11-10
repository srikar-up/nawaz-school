# 08 — Implementation Status

> **Verified on 2026-11-09.** This is the audit trail: what the Flutter project actually implements, what is demo-only, and what is missing. Use it to scope the rewrite and to avoid porting dead code.

---

## 1. Verification evidence

### 1.1 Toolchain

```text
Flutter 3.41.1 • channel stable
Framework • revision 582a0e7c55 (2026-02-12)
Engine • 2026-02-09
Tools • Dart 3.11.0 • DevTools 2.54.1
```

### 1.2 Test result

```text
flutter test --reporter expanded
→ 22 passed, 5 failed
→ "Some tests failed."
```

| Failing test | Root cause |
| :--- | :--- |
| `test/all_files_smoke_test.dart` fails to load | Imports trigger compile errors in legacy `excel_db_controller.dart` (duplicate `ExamScheduleModel`) and unused dashboard widgets (`senderName`, `displayName`, missing `department`). |
| `test/excel_db_service_test.dart` fails to load | Legacy `ExamScheduleModel` constructor (`grade`, `date`, `time`, `room`, `status`) conflicts with the canonical model. |
| `database_upgrade_next_test` → “6. StaffAttendanceController Metrics & Operations” | `expected: true`, `actual: false` — the controller does not observe the expected check-in. |
| `database_upgrade_test` → “6. StaffAttendanceController Metrics & Operations” | Same failure. |
| `database_upgrade_v2_test` → “6. StaffAttendanceController Metrics & Operations” | Same failure (wrapper test file). |

Passing tests cover:

- Excel attendance sheet initialization.
- `DailyAttendanceRecord` serialization.
- Batch daily attendance + monthly summary.
- Monthly matrix generation.
- `SubjectModel` JSON chapter parsing and cycling.
- Class incharge resolution.
- Staff attendance daily check-in/out/leave (the service-level test, not the controller test).
- Student daily attendance.
- `AttendanceController` incharge permissions and sessions.
- Workbook binary export round-trip.

**Conclusion:** the canonical in-memory Excel logic is partly tested, but the legacy controller and unused widgets block a clean test run.

### 1.3 Static analysis

```text
flutter analyze --no-fatal-infos
→ 243 issues found
```

High-value errors:

| File | Error |
| :--- | :--- |
| `lib/features/home/presentation/home_screen.dart` | Broken relative imports (`../../core/...`), undefined `AppColors`, undefined `QuickActionCard`. |
| `lib/views/dashboard/widgets/academic_risk_panel.dart` | `RmsTicket.senderName` and `RmsCategory.displayName` do not exist. |
| `lib/views/dashboard/widgets/staff_rollcall_panel.dart` | `StaffAccessModel` missing required `department`. |
| `lib/controllers/excel_db_controller.dart` | Duplicate/incompatible `ExamScheduleModel`. |
| `test/excel_db_service_test.dart` | Uses legacy `ExamScheduleModel` fields. |
| `tool/generate_master_excel_2.dart` | Syntax error, missing `}`. |

The main teacher/admin screens compile because they import the canonical `core_shared` models; the failures are concentrated in unused/legacy files and tests. That does **not** make them harmless: they block CI and mislead future developers.

### 1.4 Workbook reality check

```text
nawaz school (1).xlsx             → 8 sheets
nawaz_school_master_database.xlsx → 9 sheets
ExcelMasterService.requiredSheetOrder → 14 sheets
```

The checked-in templates do not match the current 14-sheet code.

### 1.5 Platform check

```text
windows/  → missing
android/  → missing
ios/      → missing
macos/    → missing
linux/    → missing
web/      → present
```

The project cannot currently build a native Windows or mobile app without adding those platform folders.

---

## 2. Feature status matrix

Legend: ✅ implemented and wired · 🟡 partial/demo · 🔴 mock/static · ⚪ absent · ⚠️ broken.

### 2.1 Cross-cutting

| Feature | Status | Evidence / notes |
| :--- | :---: | :--- |
| Firebase initialization | 🟡 | Attempted in `main.dart`; errors swallowed; no options file. |
| Firestore persistence | 🟡 | Best-effort writes in attendance/assessment/announcements; core data in RAM. |
| Offline cache/queue | ⚪ | Profile toggle only. |
| Authentication | 🔴 | Admin email check only; teacher no login. |
| RBAC enforcement | 🟡 | UI hiding + view guards; no server enforcement. |
| Session persistence | ⚪ | All state in memory. |
| Notifications | 🔴 | `print` only. |
| File import | ✅ | Web/IO conditional implementations. |
| File export | ✅ | Master workbook/CSV download; path copy partly inaccurate. |
| Responsive layout | 🟡 | Admin desktop + teacher phone; no tablet/compact strategy. |
| Theming | ✅ | Two coherent themes. |
| Localization | ⚪ | English only, hardcoded strings. |
| Accessibility | 🔴 | Very small admin text, no semantic labels, limited keyboard support. |
| Audit log | ⚪ | No event log. |
| Observability | ⚪ | No logging/metrics/crash reporting. |
| Tests | 🟡 | 22 pass, 5 fail; no widget/integration tests. |

### 2.2 Teacher app

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Splash / branding | ✅ | 1 s, asset fallback. |
| App shell / tabs | ✅ | IndexedStack; 3 screens reached indirectly. |
| Class switcher | ✅ | Uses `db.classes` derived from timetable. |
| Dashboard KPIs | 🟡 | Attendance/risk live; “In Progress” and module counts static. |
| Urgent notices banner | ✅ | In-memory announcements. |
| Roll-call | ✅ | Full in-memory flow; cloud best-effort. |
| Reason presets | ✅ | Local map; saved in daily record. |
| Period handover | 🟡 | Hardcoded periods; no data effect. |
| Attendance incharge gate | ⚪ | Not applied in teacher screen. |
| Timetable list | 🟡 | Data-driven but fixed dates and fake live/upcoming. |
| Marks entry | ✅ | Auto-unlock + batch + local sync. |
| Marks ledger | ✅ | Data-driven. |
| Marks lock | 🟡 | Status label only. |
| Syllabus tracker | ✅ | In-memory JSON chapters. |
| Student report card | ✅ | Rendered from student data. |
| PDF report | ⚪ | No PDF dependency. |
| WhatsApp share | 🔴 | Snackbar simulation. |
| RMS create/list | ✅ | In-memory, keyword classification. |
| RMS reply thread | ⚪ | Single principal note only. |
| Notices feed | ✅ | In-memory + optional Firestore. |
| Profile | 🟡 | Static contact/classes; toggles cosmetic. |
| Offline sync | 🔴 | Toggle only. |
| Teacher auth | ⚪ | No login. |

### 2.3 Admin app

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Login UI | ✅ | Polished split layout; pre-filled demo credentials. |
| Password verification | ⚪ | Never checked. |
| Loading sequence | 🔴 | Timed animation, no real fetch. |
| Dashboard KPIs | ✅ | Live counts/attendance/risk. |
| Attendance matrix | ✅ | Live in-memory + fallback statuses. |
| Syllabus velocity | 🔴 | Hardcoded 67%/rows. |
| Risk radar | 🟡 | Live count/student list; static banner. |
| Quick RMS actions | ✅ | Mutates ticket status. |
| Multi-Excel download | ✅ | Generates 14 sheets. |
| Multi-Excel upload/validate | 🟡 | Header/row validation only; no type/FK/conflict checks. |
| Multi-Excel commit | 🟡 | Non-transactional, in-memory. |
| Single CSV import | 🟡 | Comma-split parser, auto-detect, in-memory. |
| Live grid browse | ✅ | All 14 datasets. |
| Live grid inline edit | 🔴 | Student Save is fake. |
| Live grid add | ✅ | Dataset-specific, in-memory. |
| Live grid delete | ✅ | Students/marks/timetable/syllabus/exams/staff. |
| Staff CRUD | ✅ | In-memory; RBAC changes. |
| Staff RBAC enforcement | 🟡 | UI only. |
| Class incharge override | ✅ | In-memory. |
| Subject assignment | ✅ | In-memory. |
| Exam assignment | ✅ | In-memory + teacher view. |
| Student attendance hub | ✅ | Rich in-memory roll-call/matrix/inspector. |
| Parent call/WhatsApp | 🔴 | Snackbars. |
| Leave approvals | ✅ | In-memory. |
| Maintenance logs | ✅ | In-memory. |
| Principal vault | 🟡 | Fake PIN; no encryption. |
| Teacher audit viewer | 🟡 | Renders real widgets, not scoped identity. |
| Executive PDF | 🔴 | Static text + snackbar. |
| Announcements | ✅ | Compose/publish/pin/delete; image path bug. |
| FCM push | 🔴 | `print`. |
| Admin profile | 🟡 | Static session info; fake password change. |
| Sign out | ✅ | Flips auth flag. |

---

## 3. Data persistence reality

| Data | Survives app reload? | Survives reload if Firestore configured? | Notes |
| :--- | :---: | :---: | :--- |
| Students | ❌ | ❌ (no write path) | Seed data recreated. |
| Staff | ❌ | ❌ | Seed data recreated. |
| Classes | ❌ | ❌ | Derived/seed. |
| Timetable | ❌ | ❌ | Seed data. |
| Subjects/syllabus | ❌ | ❌ | Seed data. |
| Exams | ❌ | ✅ (only if `AssessmentService` created exam; admin hub does not write) | Admin-created exams are RAM-only. |
| Test records | ❌ | ✅ (teacher marks batch only) | Admin grid edits are RAM-only. |
| Daily attendance | ❌ | ✅ (teacher submit only) | Admin attendance hub is RAM-only. |
| Monthly attendance | ❌ | ❌ | Recomputed in RAM. |
| Staff attendance | ❌ | ❌ | RAM only. |
| Announcements | ❌ | ✅ (publish path only) | Pin/delete attempt Firestore. |
| RMS | ❌ | ❌ | RAM only. |
| Class incharge | ❌ | ❌ | RAM only. |
| Admin session | ❌ | ❌ | RAM only. |
| Images | ❌ | ❌ | Data URI/local only. |

**Bottom line:** the app is a high-fidelity interactive prototype. Nothing is guaranteed to survive a refresh except a few best-effort Firestore writes that require a configured Firebase project and matching rules.

---

## 4. Screen inventory and status

| Screen / widget | File | Status |
| :--- | :--- | :---: |
| Splash | `features/splash/presentation/splash_screen.dart` | ✅ |
| Main navigation / role switch | `features/navigation/presentation/main_nav_screen.dart` | ✅ |
| Teacher header | `shared/widgets/app_header.dart` | ✅ |
| Teacher dashboard | `features/dashboard/presentation/dashboard_screen.dart` | 🟡 |
| Teacher attendance | `features/attendance/presentation/attendance_screen.dart` | ✅ |
| Teacher timetable | `features/timetable/presentation/timetable_screen.dart` | 🟡 |
| Teacher marks | `features/marks/presentation/marks_screen.dart` | ✅ |
| Teacher syllabus | `features/syllabus/presentation/syllabus_screen.dart` | ✅ |
| Teacher reports | `features/reports/presentation/reports_screen.dart` | 🟡 |
| Teacher RMS | `features/rms/presentation/rms_screen.dart` | ✅ |
| Teacher notices | `features/announcements/presentation/teacher_notices_screen.dart` | ✅ |
| Teacher profile | `features/profile/presentation/teacher_profile_screen.dart` | 🟡 |
| Admin login | `features/admin/.../admin_login_screen.dart` | 🟡 |
| Admin loading | `features/admin/.../admin_loading_screen.dart` | 🔴 |
| Admin console | `features/admin/presentation/admin_screen.dart` | ✅ shell; 🟡 data |
| Multi-Excel Center | `features/admin/.../multi_excel_center_screen.dart` | ✅ |
| Live Grid | `features/admin/.../live_spreadsheet_grid_screen.dart` | 🟡 |
| Staff & Access | `features/admin/.../staff_access_hub_screen.dart` | ✅ |
| Announcements | `features/admin/.../admin_announcement_screen.dart` | ✅ |
| Attendance Access | `features/admin/.../attendance_access_hub_screen.dart` | ✅ |
| Subject Assignment | `features/admin/.../subject_assignment_hub_screen.dart` | ✅ |
| Exam Assignment | `features/admin/.../exam_assignment_hub_screen.dart` | ✅ |
| Student Attendance Hub | `views/attendance/student_attendance_hub_screen.dart` | ✅ |
| Admin Profile | `features/admin/.../admin_profile_screen.dart` | 🟡 |
| Attendance summary widget | `features/admin/.../admin_attendance_summary_widget.dart` | ✅ |
| Legacy home | `features/home/presentation/home_screen.dart` | ⚠️ unused/broken |
| Legacy admin dashboard | `views/dashboard/admin_dashboard_screen.dart` | ⚠️ unused/broken |
| Legacy panels | `views/dashboard/widgets/*` | ⚠️ unused |

---

## 5. Code that can be deleted in the rewrite

Safe to drop (not part of the running app):

- `lib/features/home/`
- `lib/views/dashboard/` (old dashboard + its widgets)
- `lib/models/` (legacy duplicates), after migrating any test-only logic
- `lib/services/excel_db_service.dart`, `excel_attendance_service.dart`
- `lib/controllers/excel_db_controller.dart`
- `lib/core/services/excel_ingestion_service.dart` (Firestore teacher/class importer, never wired)
- `lib/core/services/attendance_aggregation_service.dart` (only used by export)
- `lib/core/services/database_service.dart` (unused by UI)
- Legacy methods in `admin_screen.dart`: `_buildMultiExcelCenter`, `_buildInAppSpreadsheetGridEditor`, `_buildStudentsMasterTab`, `_buildMarksMasterTab`, `_buildTimetableMasterTab`, `_buildSyllabusMasterTab`, `_buildRmsArchiveTab`
- `tool/generate_master_excel.dart`, `tool/generate_master_excel_2.dart` (replace with one tested generator)

Keep and port:

- Domain concepts and formulas in `core_shared/lib/models/` and `services/`.
- Teacher screens’ UX patterns and visual language.
- Admin Bento design tokens and dense table patterns.
- Excel sheet definitions (after reconciliation).
- The seed data as a demo fixture, clearly labelled.

---

## 6. Objective-level readiness

| Question | Answer |
| :--- | :--- |
| Can a principal understand the product? | ✅ Yes, the admin UI is broad and visually clear. |
| Can a teacher complete core tasks? | ✅ Yes, in memory. |
| Is data durable? | ❌ No. |
| Is access controlled? | ❌ No, beyond UI hiding. |
| Can it build for Windows/mobile today? | ❌ No platform folders. |
| Are reports/WhatsApp real? | ❌ No. |
| Is the Excel schema consistent? | ❌ No (8/9 vs 14). |
| Is the codebase ready to extend? | ❌ No (duplicate models, dead code, global singleton). |
| Is it a suitable blueprint for a rewrite? | ✅ Yes — the workflows, data concepts, and UI intent are valuable. |

The rewrite should treat this repository as a **working prototype and domain reference**, not as a production baseline.

---

## 7. Features described in the product notes but absent from the code

These appear in `admin.md`, `school_app_system_logic.md`, or `system_features_and_excel_architecture.md` as current or planned capabilities, but there is no implementation in the running app:

| Described feature | Status | Evidence |
| :--- | :---: | :--- |
| Financial fee ledger, dues, receipts | ⚪ | No fee model, screen, service, or table. |
| Multi-admin granular RBAC (Academic Head, Accounts, Department Heads) | 🟡 | Only SuperAdmin/SubAdmin/TeacherApp/NoAccess; no per-module granular permissions. |
| AI/constraint-based timetable generator | ⚪ | Timetable is imported or manually added; no solver. |
| SMS / WhatsApp API broadcast gateway | ⚪ | No provider integration; only UI copy. |
| Parent portal / student portal | ⚪ | Parents/students are data records only. |
| Homework/assignment hub with attachments and QR scanner | ⚪ | No homework model or screen. |
| Peer teacher substitution/swapping hub | ⚪ | No swap request model; leave desk has no substitution workflow. |
| Voice-to-text feedback engine | ⚪ | No speech dependency or UI. |
| Offline-first SQLite cache and background sync | ⚪ | Toggle only; no local DB/outbox. |
| Real PDF report-card engine | ⚪ | No PDF dependency; static preview only. |
| Real FCM push notifications | ⚪ | `print` only; no FCM dependency/token flow. |
| Real teacher impersonation/audit tunnel | 🟡 | Renders real teacher widgets, but no scoped identity or audit log. |
| School-wide risk timeline / historical trend chart | ⚪ | Static bars/copy; no time-series data. |
| Syllabus delay badges based on deadlines | ⚪ | No deadlines or velocity calculation in data. |
| Automated parent phone/WhatsApp alerts | ⚪ | Snackbar simulations. |
| Bulk transactional import with rollback | 🟡 | Import exists, but commit is non-transactional. |
| Advanced search across all entities | 🟡 | Per-grid search only; top bar search writes to grid state. |
| Notifications inbox/read state | ⚪ | Notice feed has no per-user read/unread persistence. |
| Academic-year promotion/rollover | ⚪ | No promotion or year-rollover workflow. |

These are good candidates for the rewrite roadmap, but they should be explicitly scoped rather than assumed to exist because the original notes mention them.
