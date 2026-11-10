# 09 — Known Issues

> Verified defects, inconsistencies, and risks found during the full code read. Severity is from the perspective of a production rebuild.
>
> **ID convention:** `KI-xx`. Use these IDs in the rewrite backlog and in test cases.

---

## Severity legend

| Severity | Meaning |
| :--- | :--- |
| **S1 — Blocker** | Prevents a clean build/test or creates a security/data-loss risk. |
| **S2 — Major** | A core workflow gives wrong or non-persistent results. |
| **S3 — Moderate** | UX/consistency defect with a workaround. |
| **S4 — Minor** | Copy, layout, or maintainability issue. |

---

## 1. Build, test, and structural issues

### KI-01 · S1 · Duplicate `ExamScheduleModel` breaks tests

**Evidence**

```text
flutter test
→ test/excel_db_service_test.dart: Failed to load
→ Error: No named parameter with the name 'grade'
→ argument type ExamScheduleModel/*1*/ can't be assigned to ExamScheduleModel/*2*/
```

Two classes with the same name:

- `core_shared/lib/models/exam_schedule_model.dart` — canonical, `classIdSection`, `examCategory`, `examDate`, `startTime`, `endTime`, `maxMarks`, `marksEntryStatus`.
- `core_shared/lib/models/excel_db/exam_schedule_model.dart` — legacy, `grade`, `date`, `time`, `room`, `status`.

`lib/controllers/excel_db_controller.dart` imports the canonical model but the service returns the legacy one.

**Fix in rewrite:** delete the legacy model; generate one model from one schema; migrate `ExcelDbService` or remove it.

---

### KI-02 · S1 · Dead legacy files fail analysis

`flutter analyze` reports 243 issues. Real compile errors include:

- `lib/features/home/presentation/home_screen.dart` — broken imports and missing `QuickActionCard`/`AppColors`.
- `lib/views/dashboard/widgets/academic_risk_panel.dart` — `senderName`, `RmsCategory.displayName`.
- `lib/views/dashboard/widgets/staff_rollcall_panel.dart` — missing `department`.
- `tool/generate_master_excel_2.dart` — missing `}`.

These files are not in the runtime path, but they block CI and hide real warnings.

**Fix:** delete or repair; add `flutter analyze` to CI with zero-error policy.

---

### KI-03 · S2 · Only a web target exists

No `windows/`, `android/`, `ios/`, `macos/`, or `linux/` folders. The product claims Windows desktop and mobile.

**Fix:** decide targets; run `flutter create --platforms=... .` and commit them; add build pipelines.

---

### KI-04 · S2 · Three competing data/model layers

- Canonical UI models in `core_shared/lib/models/`.
- Legacy duplicate models in `lib/models/`.
- Excel row models in `core_shared/lib/models/excel_db/`.

There are three student shapes, two exam shapes, two syllabus shapes, and two marks shapes. Fields and ID conventions differ.

**Fix:** one domain package; one DB schema; adapters only at import/export boundaries.

---

### KI-05 · S2 · Duplicate test suites and singleton contamination

- `database_upgrade_v2_test.dart` simply imports and runs `database_upgrade_next_test.dart`.
- Tests construct `MockDatabase()` singletons and mutate shared state; order can matter.
- The staff-attendance controller test fails consistently.

**Fix:** inject repositories, reset fixtures per test, delete duplicate wrapper tests.

---

## 2. Security and access control

### KI-06 · S1 · Admin password is never verified

`AdminLoginScreen` validates only that the password is non-empty. `AuthService.canAccessWindowsAdminStatic(email, ...)` checks the email against a hardcoded allow-list or staff role. The pre-filled credentials work for any password.

**Fix:** real auth provider, hashed credentials/SSO, rate limiting, MFA for admins.

---

### KI-07 · S1 · Teacher app has no authentication

`SplashScreen` goes directly to `MainNavScreen`. The teacher identity is hardcoded. Anyone who opens the app is “Prof. Sarah Nawaz”.

**Fix:** teacher login/activation, session, scoped data.

---

### KI-08 · S1 · RBAC is UI-only

- Sidebar hides Staff Hub and Vault for SubAdmin.
- `_buildActiveView` guards indices 5 and 9.
- Underlying `MockDatabase` methods have no caller checks.
- Firestore rules use a different role field (`teachers.role`) from the app (`staff.access_level`).

**Fix:** enforce authorization on every API/database operation; use one role source.

---

### KI-09 · S1 · Vault PIN is not checked

`_buildPrincipalSecureVault` unlocks on any button press; the PIN controller is unused.

**Fix:** re-authentication, server-side authorization, encryption at rest, access audit.

---

### KI-10 · S2 · Teacher can take attendance for any class

The teacher attendance screen does not check `isStaffIncharge`. The gate exists in `AttendanceController` for the admin hub only.

**Fix:** scope classes to the authenticated teacher's assignments; enforce in API.

---

### KI-11 · S2 · Impersonation is not real impersonation

The audit viewer renders the real teacher widgets, but they use the global identity and data. Selecting another faculty member changes only the telemetry labels. There is no audit trail or read-only constraint.

**Fix:** explicit impersonation token, read-only mode, time limit, banner, audit event.

---

### KI-12 · S2 · Firestore rules are incomplete and partly broken

Covered: teachers, classes, students, exam_schedules, test_records, announcements.

Missing: attendance_records, student_attendance_summary, staff, timetables, syllabus, rms_tickets, class_incharges, subjects.

Additional problems:

- Exam schedule update/delete rule dereferences `request.resource.data.class_id_section`; deletes have no request resource.
- Test-record rules depend on class-teacher identity, but the app's teacher IDs are `tch_...` while classes store `STAFF-...`/emails.
- Announcements index uses `published_at`, code writes `created_at`.

**Fix:** rewrite rules for every collection; use custom claims; test with the emulator.

---

## 3. Data persistence and integrity

### KI-13 · S1 · Most admin edits are RAM-only

Students, staff, timetable, syllabus, subjects, incharge overrides, RMS tickets, exams, and most announcements are never written to a durable store. A page reload restores seed data.

**Fix:** real repository writes; optimistic UI only after a successful mutation or with a clear pending state.

---

### KI-14 · S1 · Inline “Save” in the live grid does not save

In `LiveSpreadsheetGridScreen._buildStudentsGrid`, the Save button:

```dart
onPressed: () {
  setState(() => _editingRowId = null);
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Saved changes! Synced to Cloud.')),
  );
}
```

The edited controllers are never applied to `db.students`.

**Fix:** validate and call an update method; show real error on failure.

---

### KI-15 · S1 · Excel commit is not transactional

`ExcelMasterService.commitMasterWorkbook` loops over sheets and mutates `MockDatabase` as it goes. A failure later does not roll back earlier sheets. The UI says “Commit All Datasets”.

**Fix:** validate everything first; write in a DB transaction or a staging schema; publish atomically; provide a rollback.

---

### KI-16 · S1 · The checked-in workbooks do not match the code

- `nawaz school (1).xlsx` → 8 sheets.
- `nawaz_school_master_database.xlsx` → 9 sheets.
- Code expects 14.

**Fix:** version the template; support legacy import with explicit mapping; ship the canonical template.

---

### KI-17 · S2 · Student/roster identifiers are inconsistent

- `Student.id` = `stu_1`.
- `Student.studentId` = `STU-10A-01`.
- Firestore document ID is sometimes `student_id`, sometimes internal.
- Marks use `student.id` in seed data and `studentId` in newer code.
- `exportStudentsMaster` writes `student_id` as the human ID.

**Fix:** one primary key (UUID) + one human code; use explicit FKs everywhere.

---

### KI-18 · S2 · Duplicate staff ID `OPS-004`

Seed data has both the electrician (`Ustad Muhammad Aslam`) and support staff (`Mr. Ghulam Qadir`) with `OPS-004`. Staff table operations assume uniqueness; editing/deleting one affects the other lookup.

**Fix:** unique constraint; regenerate demo data.

---

### KI-19 · S2 · Staff, faculty, and teacher identities are disconnected

- `StaffModel` (`staffList`) is the admin directory.
- `TeacherAccount` (`facultyList`) is the timetable/audit list.
- `TeacherModel` is the Firestore auth directory.
- IDs differ (`STAFF-01`, `TCH-001`, `tch_sarah_01`).

The dashboard “Active Faculty” count, staff hub count, and timetable teacher matching can disagree.

**Fix:** one staff/teacher entity; one ID; role/access as attributes.

---

### KI-20 · S2 · Attendance excused rows break percentage math

`AttendanceRecordModel` computes `present / total * 100`, but total includes excused students while the numerator excludes them. `present + absent + late` may be less than `total`.

**Fix:** define denominator explicitly; include excused in total and decide whether they count as present; display the policy.

---

### KI-21 · S2 · Attendance daily vs monthly vs cumulative duplicates

The app maintains:

- `DailyAttendanceRecord` (per student/session).
- `AttendanceRecordModel` (per class/day with embedded records).
- `StudentAttendanceSummaryModel` (cumulative).
- `MonthlyAttendanceSummary` (monthly).
- `AttendanceMasterRecordModel` (cumulative rows).
- `Student.attendanceRate` (a fourth baseline).

They are updated by different paths and can disagree.

**Fix:** one append-only attendance entry table + derived summaries; never store redundant percentages unless versioned.

---

### KI-22 · S2 · Monthly summary export is hardcoded

`ExcelMasterService._populateAttendanceMonthlySummary` writes month `8`, year `2026`, and a fixed absent-date list for every student.

**Fix:** export the actual selected month; derive dates from records.

---

### KI-23 · S2 · CSV parser breaks on quoted commas

`parseAndIngestCsv` splits every line on `,` without quote handling. Names/addresses containing commas shift columns.

**Fix:** use a real CSV parser (RFC 4180) with quoted fields and escaped quotes.

---

### KI-24 · S2 · Image announcement attachment corrupts binary data

`AdminAnnouncementScreen._pickAttachment` does:

```dart
_attachedImageBytes = Uint8List.fromList(picked.content.codeUnits);
```

`picked.content` is text; binary image bytes become UTF-16-ish code units. The upload then base64-encodes the wrong bytes.

**Fix:** use `picked.bytes` from a binary file picker; validate MIME/size; store in object storage.

---

### KI-25 · S2 · Timetable conflict detection is incomplete

`MockDatabase.ingestTimetableMaster` checks only identical start times in the uploaded file, not overlapping intervals, existing DB rows, or room conflicts. The master workbook commit relies on this method.

**Fix:** interval overlap checks for teacher/class/room across the whole dataset, ideally DB constraints.

---

### KI-26 · S2 · Teacher email is not resolved to teacher ID on timetable import

The schema says `teacher_email` maps to `teacher_id`, but `ingestTimetableMaster` stores the raw `teacher_id`/email. `TimetablePeriod.staffId` then guesses `STAFF-01` for anything containing `tch_`.

**Fix:** explicit staff lookup; fail the row if unresolved.

---

### KI-27 · S2 · Exam uniqueness and ID generation are inconsistent

- Admin Hub: `EXAM-{section}-{subject3}-{category}-{timestamp%1000}`.
- Seed/legacy: `EXM-10A-MATH-CA1`.
- Test records: `{student}_{exam}` or `{student}_{subject}_{category}`.
- `TestRecord.testId` may be used as a student ID by mistake (`syncWithMockDb` maps `t.id` to `examId`).

**Fix:** one exam ID; one test-record ID; explicit FKs; uniqueness constraints.

---

### KI-28 · S2 · “Lock” is cosmetic

After “Batch Commit & Lock”, the exam status becomes `Submitted`, but there is no server rule preventing a later edit, and the UI has no edit path only because it hides the button. Direct API/DB edits are possible.

**Fix:** enforce status transitions and deadlines server-side; log corrections.

---

## 4. Calculations and behavior defects

### KI-29 · S2 · Dashboard syllabus percentage is scaled twice

`MockDatabase.getSyllabusProgress` returns a 0–1 fraction. The dashboard's “Math: Quadratic Eq.” in-progress card passes `mathProgress / 100.0` to a `LinearProgressIndicator`, producing ~0.0065 (0.65% fill). The module card passes the same fraction to `PercentRing`, which treats values ≤1 as fractions and shows 65%. The two cards therefore disagree; the linear bar is wrong, not the ring.

**Fix:** return 0–100 consistently; format as percent; test.

---

### KI-30 · S2 · Pass threshold differs (35% vs 40%)

`TestRecord.isFailing` uses `< 35`; `passCount`/`failCount` use `< 0.40`. The UI mixes both.

**Fix:** one policy constant; document whether 35% is “risk” and 40% is “pass”.

---

### KI-31 · S2 · At-risk rule does not match the product spec

Product says “below 35% across three sequential tests”; code flags average `< 35` or last score `< 35` with ≥2 scores. A single bad quiz can flag a student permanently.

**Fix:** configurable consecutive-test rule; separate “watch” from “critical”.

---

### KI-32 · S2 · Exam auto-unlock depends on device clock and local time

`isConcluded` parses a local date + time with no timezone. A wrong device clock unlocks exams early or late.

**Fix:** store UTC + institution timezone; compute status server-side; cache.

---

### KI-33 · S2 · Class-specific announcements are invisible to teachers

`streamAnnouncementsForTeachers` filters to `All`, `TeachersOnly`, and legacy variants. `Class10`/`Class9` notices are excluded, even for teachers of those classes.

**Fix:** resolve audience against the teacher's class assignments; include class audiences.

---

### KI-34 · S2 · “Daily” and “Monthly” admin grid tabs show the cumulative attendance grid

In `LiveSpreadsheetGridScreen._buildActiveDataGrid`, indices 5 and 6 both call `_buildAttendanceGrid(db)`, which renders `db.attendanceSummaries` (cumulative). The tabs are mislabeled and the data is wrong for the selected dataset.

**Fix:** implement real daily/monthly views or remove the tabs.

---

### KI-35 · S3 · Admin attendance hub is read-only for the demo admin

The controller's `_activeStaffId` is hardcoded `STAFF-01`. For classes where another staff is incharge (10-B, 9-A, etc.), the admin sees “View Only” and cannot edit. There is no role bypass for admins.

**Fix:** admins should always have override rights; show the actual acting admin.

---

### KI-36 · S3 · Period-1 teacher resolution ignores the selected day

`getPeriod1TeacherForClass` scans any period with `periodNumber == 1`, not the current day. It can pick Tuesday's period 1 when resolving Monday.

**Fix:** include `day_of_week` and validate, or store the default explicitly.

---

### KI-37 · S3 · Missing-data fallbacks hide problems

- `getSyllabusProgress` returns `0.65` when no topics exist.
- Dashboard attendance falls back to 85%.
- Report/module rings use fixed 88%/94% fallbacks.
- Admin analytics uses 74%/8/22.

These values can be mistaken for real data.

**Fix:** show “No data” explicitly; never fabricate percentages.

---

### KI-38 · S3 · `Student.classIdSection` heuristic is wrong for non-grade-10 data

Default: `className.contains('10') ? '10-A' : '9-A'`. Any other grade (11, 12, 8) defaults to `9-A` unless explicitly provided.

**Fix:** require class section; derive from a lookup, not substring.

---

### KI-39 · S3 · Timetable period’s teacher name mapping is demo-specific

`TimetablePeriod.teacher` maps only `STAFF-01/02/03` and `sarah`; otherwise returns “Engr. Raheem”. Real teachers will display incorrectly.

**Fix:** join to staff by ID; never hardcode names in the model.

---

### KI-40 · S3 · “Live Now” and “Upcoming” filters are hardcoded

Timetable marks period 2 on Monday as live and treats periods <2 as past. It is not based on the current time or date.

**Fix:** compute from actual start/end and now; handle no-current-period state.

---

### KI-41 · S3 · Attendance date selection does not reload local state

In `AttendanceScreen`, changing `_selectedDate` updates the date pill but `_attendanceMap` is not reinitialized. The screen continues showing the previous day's local edits until class change/reload.

**Fix:** load the selected date's records into the map on date change.

---

### KI-42 · S3 · Teacher scope matching can hide valid classes

`TimetableScreen` compares `p.staffId` (mapped to `STAFF-01`) to `activeTeacherId` (`tch_sarah_01`) and falls back to a name match. Renaming a teacher or changing ID format hides their schedule.

**Fix:** one teacher ID, explicit assignment.

---

### KI-43 · S3 · Student report uses seed `recentTestScores`

The report card’s “Recent Assessments” are `Student.recentTestScores`, a simple list appended by `updateStudentScore`. It does not show subject/term/test names, and it can double-count when marks are submitted repeatedly.

**Fix:** query test records by student/term; group by subject; show max marks and grades.

---

### KI-44 · S3 · Teacher profile is largely static

Contact phone, faculty room, assigned classes, and meta chips are hardcoded. Only the name/email come from the DB.

**Fix:** load staff profile and assignments from the API.

---

## 5. Reporting, communication, and integrations

### KI-45 · S2 · Executive PDF is fake

No PDF library, no generation, no file. The button shows a snackbar with a Windows path.

**Fix:** implement a server-side PDF renderer or client-side `pdf` package; attach real data; test download.

---

### KI-46 · S2 · WhatsApp/report sharing is fake

No `url_launcher`, no share intent, no PDF. The confirmation sheet just shows a snackbar.

**Fix:** generate a PDF, use the platform share sheet (`share_plus`), or open `wa.me` with a deep link; fall back to download.

---

### KI-47 · S2 · Push notifications are fake

`AnnouncementService._dispatchPushNotification` prints to console. No FCM dependency in `pubspec.yaml`, no token registration.

**Fix:** add FCM/APNs or a web-push provider; store tokens; send from a trusted backend; handle opt-out.

---

### KI-48 · S2 · “Offline sync” is a cosmetic toggle

`_offlineSyncEnabled` is a local `bool` in the profile screen. No local database, queue, connectivity listener, or retry.

**Fix:** implement a real offline store (SQLite/Drift/IndexedDB), outbox pattern, conflict resolution.

---

### KI-49 · S3 · “Encrypted” RMS copy is false

Tickets are plain in-memory objects and best-effort Firestore documents. There is no encryption or access control specific to confidential tickets.

**Fix:** remove the claim or implement encryption/field-level access control.

---

### KI-50 · S3 · Contact actions are snackbars

Admin attendance “Call Parent”/“WhatsApp Alert” and teacher report “Dispatch” do not invoke phone, SMS, WhatsApp, or email.

**Fix:** use `url_launcher`/share intents with consent and audit.

---

## 6. Excel/import issues (summary)

| ID | Issue | Severity |
| :--- | :--- | :--- |
| KI-16 | Workbook 8/9 vs 14 sheets | S1 |
| KI-15 | Non-transactional commit | S1 |
| KI-23 | CSV quote handling | S2 |
| KI-25 | Timetable overlap gaps | S2 |
| KI-26 | Teacher email not resolved | S2 |
| KI-51 | Auto-detect order misclassifies files | S3 |
| KI-52 | `ExcelMasterService` UI says 8 sheets | S4 |
| KI-53 | `tool/generate_master_excel_2.dart` syntax error | S2 |
| KI-54 | Monthly summary export hardcoded | S2 |
| KI-55 | No import history/rollback | S2 |
| KI-56 | No schema version in file | S2 |
| KI-57 | Duplicate key validation is inconsistent (abort vs warn) | S2 |
| KI-58 | Marks import falls back to first student when name not found | S1 |

---

## 7. UI/UX and accessibility

### KI-59 · S2 · Admin text is extremely small

Many labels are 8.5–11 px; table headers 9–10 px; controls 28–34 px tall. This fails common accessibility and readability standards on 1080p and below.

**Fix:** 12 px minimum for body, 14+ for primary, larger hit targets, zoom support.

### KI-60 · S3 · The admin console assumes a wide viewport

Sidebar + 4-column KPIs + 60/40 split + wide tables. No compact layout or horizontal scroll strategy for smaller laptops.

**Fix:** responsive breakpoints; collapsible sidebar; stacked cards; table scroll.

### KI-61 · S3 · Demo copy masquerades as telemetry

“Active Sync: 4 Master CSVs Linked • 14ms”, “Cloud Sync Engine v2.4 Active”, “Windows 11 Pro”, “TLS 1.3”, “Live Audit Tunnel Active”, “FCM ENABLED” are static.

**Fix:** remove or only show real values.

### KI-62 · S3 · Image lightbox cannot display all supported sources consistently

Teacher notices use `Image.asset` for non-data URLs and `Image.network` for data URIs. Local file paths and http URLs are not handled consistently.

**Fix:** one image source resolver (network/asset/file/data) with error/placeholder states.

### KI-63 · S4 · Navigation labels and screen titles drift

“RMS Desk”, “RMS Request & Leave Desk”, “Relationship Management System”; “Live Spreadsheet Grid”, “In-App Live Spreadsheet Grid Editor”; “Executive PDF”, “Executive Progress Report PDF Compiler”.

**Fix:** one term per concept in the design system.

### KI-64 · S4 · Date formats are inconsistent

`24/8/2026`, `2026-08-26`, `Monday`, hardcoded `24`–`28`, `Yesterday`. No locale handling.

**Fix:** use a single date library/format and the institution's timezone/locale.

---

## 8. Performance and scale

### KI-65 · S2 · Everything is in memory and rebuilt globally

`MockDatabase.notifyListeners()` rebuilds every `AnimatedBuilder` screen. Tables are `ListView` of all rows with no pagination. A real school with thousands of students/marks will be slow.

**Fix:** server-side pagination/filtering, virtualised lists, scoped state, query caching.

### KI-66 · S3 · Master workbook generation is synchronous on the UI isolate

`ExcelMasterService.exportMasterWorkbook` builds all 14 sheets on the main isolate. Large datasets will freeze the UI.

**Fix:** isolate/background job, progress UI, streaming.

### KI-67 · S3 · No request cancellation/debouncing

Search filters mutate every keystroke and rebuild tables. No debounce.

**Fix:** debounce search, cancel stale requests.

---

## 9. Miscellaneous

| ID | Issue | Severity |
| :--- | :--- | :--- |
| KI-68 | No audit trail for marks/attendance/staff/RBAC/vault | S2 |
| KI-69 | No academic-year scoping; historical data mixes years | S2 |
| KI-70 | No timezone model | S2 |
| KI-71 | No localization; all strings hardcoded | S3 |
| KI-72 | No error boundary/telemetry; silent catch blocks | S2 |
| KI-73 | `Firebase.initializeApp()` without options can throw and is swallowed | S2 |
| KI-74 | Tests rely on shared singleton state | S2 |
| KI-75 | Seed demo data differs from documentation names | S4 |
| KI-76 | `TestRecord` mutability (`marksObtained`, `studentScores`) can cause stale UI | S3 |
| KI-77 | `getAtRiskStudents` class match uses substring; “10-A” could match “10-AB” | S3 |
| KI-78 | Attendance “mark all present” can overwrite justified absences without confirmation | S3 |
| KI-79 | Deleting a student does not cascade delete their test/attendance records | S2 |
| KI-80 | Deleting a staff member does not clean up timetable/incharge/subject references | S2 |

---

## 10. Recommended fix order (if repairing instead of rewriting)

1. **KI-01, KI-02, KI-04, KI-05** — one model layer, green analyze/test.
2. **KI-06, KI-07, KI-08, KI-09, KI-12** — auth, RBAC, rules, vault.
3. **KI-13, KI-14, KI-15, KI-16** — real persistence, real inline save, transactional import, canonical workbook.
4. **KI-17 to KI-28** — identity/schema/consistency.
5. **KI-29 to KI-44** — calculation and UX correctness.
6. **KI-45 to KI-50** — real integrations.
7. **KI-59 to KI-67** — accessibility, responsive, performance.
8. **KI-68 to KI-80** — audit, years, timezone, cleanup.

For a rewrite, treat every S1/S2 item as a non-negotiable acceptance criterion.
