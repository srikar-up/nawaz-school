# 07 — Excel & Ingestion

> Excel is the admin's primary bulk-input mechanism. This document records the **actual schemas in code**, the **actual files in the repo**, and the gaps between them.

---

## 1. The three Excel truths

| Artifact | Sheets | Status |
| :--- | :---: | :--- |
| `nawaz school (1).xlsx` (repo root) | **8** | Legacy sample: students, attendance, marks, timetable, syllabus, RMS, exams, staff. |
| `nawaz_school_master_database.xlsx` (repo root) | **9** | Legacy sample plus announcements. |
| `tool/generate_master_excel.dart` | **9** | Old generator matching the 9-sheet file. |
| `ExcelMasterService` / UI | **14** | Current intended master workbook, generated at runtime. |

The UI text is inconsistent: some labels say “8 sheets”, some “7 datasets”, some “14 tabs”. The code's `requiredSheetOrder` contains 14 sheets. The repo files contain 8/9. Any test or user following the checked-in `.xlsx` will fail the 14-sheet validator.

**Rewrite decision:** version the workbook schema and publish one canonical template. Keep compatibility importers for old 8/9-sheet files, but do not call them “master”.

---

## 2. Canonical 14-sheet workbook

File name: `nawaz_school_master_database.xlsx`

Sheet order (from `ExcelMasterService.requiredSheetOrder`):

1. `students_master`
2. `class_incharge_master`
3. `subjects_master`
4. `timetable_master`
5. `staff_attendance_daily`
6. `student_attendance_daily`
7. `attendance_monthly_summary`
8. `attendance_master`
9. `marks_master`
10. `syllabus_master`
11. `rms_records`
12. `exam_schedules`
13. `staff_access`
14. `announcements`

### 2.1 `students_master`

Headers (`ExcelMasterService`):

```text
student_id | roll_number | name | parent_phone | class_name | class_id_section | remarks
```

Rules/notes:

- `student_id` is the intended primary key.
- Duplicate student name in the same section aborts the master ingest.
- `parent_phone` is intended E.164 but only trimmed.
- `class_name` is display (`Grade 10`), `class_id_section` is the key (`10-A`).
- The separate `StudentMasterModel` expects a different layout (`Student ID | Name | Grade | Section | DOB | Parent Contact | Address`), used by the legacy workbook.
- `MockDatabase.ingestStudentsMaster` also accepts `phone_number` and `class` as aliases.

### 2.2 `class_incharge_master`

```text
class_id_section | period_1_default_teacher_id | incharge_staff_id | teacher_name | academic_year
```

Rules:

- One row per section.
- Default roll-call taker = Period 1 teacher.
- `incharge_staff_id` overrides.
- No duplicate-section guard; later rows overwrite earlier ones in memory.

### 2.3 `subjects_master`

```text
subject_code | subject_name | class_id_section | assigned_staff_id | assigned_teacher_name | chapters_json
```

`chapters_json` example:

```json
[
  { "chapterNumber": 1, "chapter": "Quadratic Equations", "status": "completed" },
  { "chapterNumber": 2, "chapter": "Trigonometry", "status": "in_progress" }
]
```

Rules:

- `subject_code` grade-wide (`MATH-10`).
- The parser also accepts a comma-separated list as a fallback; each item becomes a completed chapter.
- No validation that `assigned_staff_id` exists.
- Status values are case-sensitive in the model (`completed`, `in_progress`, `pending`) but seed data sometimes uses `Completed`/`In Progress`; helper getters lowercase, so both work for display, but the JSON writer preserves original casing.

### 2.4 `timetable_master`

```text
timetable_id | class_id_section | subject_code | subject | teacher_email | day_of_week | start_time | end_time | period_number | room_number
```

Rules:

- `day_of_week` can be a name (`Monday`) or an integer (1–5); parsers differ.
- `start_time`/`end_time` are `HH:mm:ss`.
- `teacher_email` should resolve to a teacher ID; **the actual master ingest stores the raw value**.
- `period_number` is required by the intended schema but ignored by the `MockDatabase` timetable ingest, which computes `(i % 6) + 1`.
- Conflict guard only compares identical start times within the same uploaded file.

### 2.5 `staff_attendance_daily`

```text
record_id | staff_id | date | check_in_time | check_out_time | status | leave_reason
```

Statuses: Present, Absent, Half-Day, On Leave.
`record_id` format: `SA_YYYYMMDD_STAFF_ID`.

### 2.6 `student_attendance_daily`

```text
record_id | student_id | student_name | class_id_section | date | day_of_week | session_type | status | remarks | marked_by_staff_id | marked_at
```

- `record_id`: `ATT_YYYYMMDD_{AM|PM|FULL}_{studentId}`.
- `session_type`: Morning, Afternoon, Full_Day.
- `status`: Present, Absent, Late, Leave/Excused.
- Backward compatible with a 10-column layout (no `session_type`).

### 2.7 `attendance_monthly_summary`

```text
summary_id | student_id | student_name | class_id_section | month | year | working_days | days_present | days_absent | days_late | days_excused | attendance_percentage | absent_dates_list
```

- `summary_id`: `SUM_YYYYMM_STUDENT`.
- `month` is numeric in the master schema but the legacy model stores a name (`August`).
- Percentage formula: `(present + 0.5 * late) / working_days * 100`.

### 2.8 `attendance_master`

```text
record_id | student_id | student_name | class_id_section | date | status | total_classes_conducted | total_classes_attended | attendance_percentage
```

Cumulative registry. `record_id` example: `ATT-STU-10A-01-2026-08-26`.

### 2.9 `marks_master`

```text
test_id | student_id | student_name | class_id_section | subject | exam_category | marks_obtained | max_marks | exam_date
```

- `exam_category`: `ca1`, `ca2`, `midTerm`, `endTerm` (legacy also `classTest`).
- No range validation in the master parser.
- The legacy `MarksMasterModel` expects `Student ID | Name | Grade | Section | Exam Type | Subject | Max Marks | Marks Obtained | Score Percentage`.

### 2.10 `syllabus_master`

```text
syllabus_item_id | class_id_section | subject | chapter_number | chapter_title | topic_title | completion_status
```

- `completion_status`: TRUE/FALSE, 1/0, Completed/Pending.
- The admin blueprint describes `Completed`/`Pending`; the model parses booleans.

### 2.11 `rms_records`

```text
ticket_id | sender_email | nlp_tag | subject_line | message_body | status | created_at
```

- `nlp_tag`: Staff Leave / Maintenance / Confidential / Academic.
- `status`: pending / underReview / approved / resolved / rejected.
- The legacy `RmsRecordModel` uses a different layout: `Record ID | Type | Description | Date | Status | Created By | Review | Reply By | Assigned Staff`.

### 2.12 `exam_schedules`

```text
exam_id | class_id_section | subject | exam_category | exam_date | start_time | end_time | max_marks | assigned_teacher_email
```

- No validation that the class/subject/teacher exists.
- The legacy `ExamScheduleModel` expects `Exam ID | Subject | Grade | Date | Time | Room | Status`.

### 2.13 `staff_access`

```text
staff_id | name | email | phone_number | staff_type | access_level | department | status
```

- `access_level`: SuperAdmin, SubAdmin, TeacherApp, NoAccess.
- `status`: Active / Disabled.
- `Privilege` is derived from this sheet in the UI.
- No validation of access level or staff type values.

### 2.14 `announcements`

```text
announcement_id | title | content | importance_level | target_audience | publisher_name | is_pinned | created_at
```

- Importance: Normal / Important / Urgent / Emergency.
- Audience: All / TeachersOnly / StudentsOnly / Class10 / Class9.
- `is_pinned`: TRUE/FALSE.

---

## 3. The legacy 8/9-sheet files

### 3.1 8-sheet file: `nawaz school (1).xlsx`

Sheets:

1. `students_master` — `Student ID | Name | Grade | Section | DOB | Parent Contact | Address`
2. `attendance_master` — cumulative
3. `marks_master` — legacy marks
4. `timetable_master` — `Day | Time | Grade | Section | Subject ID | Subject | Teacher | Staff ID | Room`
5. `syllabus_master` — `Syllabus ID | Subject | Grade | Topic | Start Date | End Date | Completed`
6. `rms_records` — legacy RMS
7. `exam_schedules` — legacy exams
8. `staff_access` — `Staff ID | Name | Role | Access Level | Email | Department`

### 3.2 9-sheet file: `nawaz_school_master_database.xlsx`

Same as above plus `announcements`.

### 3.3 Compatibility

- The app's 14-sheet validator will report all missing sheets for these files.
- `ExcelDbService` (legacy) is designed for these sheets; it is not used by the running UI.
- `tool/generate_master_excel.dart` generates this 9-sheet layout.
- `tool/generate_master_excel_2.dart` is broken (syntax error).

**Recommendation:** ship a migration import path that detects 8/9/14 sheets and maps them to the canonical schema, with a clear “legacy workbook” warning.

---

## 4. Ingestion entry points

### 4.1 Master workbook upload

```text
Admin → Multi-Excel Center → Upload Master (.xlsx)
  → FileImporter.pickAndReadFile()
  → AdminStateController.stageMasterWorkbookBytes(fileName, bytes)
  → ExcelMasterService.parseAndValidateMasterWorkbook(bytes)
      → for each required sheet:
          - find sheet case-insensitively
          - read header row
          - map expected columns
          - parse rows into Map<String, dynamic>
          - create SheetHealthCard
      → MasterWorkbookHealthReport
  → UI shows per-sheet health cards
  → “Commit All Datasets”
      → ExcelMasterService.commitMasterWorkbook(report, db)
          → for each valid sheet, call the matching db.ingest* method
  → snackbar / result dialog
```

**Validation actually performed**

- Sheet presence.
- Header presence (accepts `snake_case` and de-underscored variants).
- Row count > 0.
- Empty rows skipped.
- No type/format validation.
- No duplicate-key validation at the report stage.
- No foreign-key validation.
- No conflict validation for timetables.
- No all-or-nothing transaction.

**Commit semantics**

- Valid sheets mutate `MockDatabase` immediately.
- Invalid/missing sheets are skipped (`stats[sheet] = 0`).
- There is no rollback if a later sheet fails.
- `db.notifyListeners()` fires once at the end.

### 4.2 Single-sheet CSV staging

```text
Multi-Excel Center → choose dataset → Paste Raw Text or Choose File
  → stageRawCsv(fileName, content)
      - split lines
      - header validation against current blueprint
      - preview first 10 rows
  → “Commit Staged File”
      → db.parseAndIngestCsv(targetType, rawCsv)
          - split lines
          - auto-detect target if 'auto'
          - call ingest* method
```

**Auto-detection order**

1. `staff_access_master` if `access_level` or `staff_type`.
2. `attendance_master` if `total_classes_conducted` or `attendance_percentage`.
3. `exam_schedules` if `exam_id` or `exam_date` or `exam_category`.
4. `rms_records` if `note_id` or `classification_tag` or `message_body`.
5. `students_master` if `phone_number`/`rollnumber`/`student_id`, etc.
6. `marks_master` if `marks_obtained` or `test_id`.
7. `timetable_master` if `start_time`/`teacher_id`/`day_of_week`.
8. `syllabus_master` if `chapter_number`/`completion_status`/`syllabus_item_id`.
9. Fallback `students_master`.

**Problem:** the CSV parser splits on commas without handling quoted commas, so names/addresses with commas break columns.

### 4.3 Direct file upload from the action banner

- `.xlsx` → stage master workbook.
- Text/CSV → auto-detect and ingest immediately.
- No preview for the immediate path.

### 4.4 Legacy Excel services

| Service | Entry | Target |
| :--- | :--- | :--- |
| `ExcelDbService` | `loadFromBytes` / `loadTemplateFromAssets` / `initializeEmptyWorkbook` | In-memory workbook CRUD. |
| `ExcelAttendanceService` | Load/save daily attendance, recompute monthly | Legacy workbook. |
| `ExcelIngestionService` | `ingestTeachersMaster`, `ingestClassesMaster`, `ingestStudentsTemplate`, `ingestMarksMaster` | Firestore batches. |
| `ExcelMasterService` | 14-sheet export/validate/commit | `MockDatabase`. |

Only `ExcelMasterService` is wired into the current admin UI. The others are dead/test code.

---

## 5. Export

### 5.1 Master workbook export

`ExcelMasterService.exportMasterWorkbook(db)` builds a new `Excel` object:

- Renames `Sheet1` → `students_master`.
- Appends headers and rows for all 14 sheets.
- Encodes to bytes.
- `FileExporter.saveAndDownloadBytes` downloads/writes the file.

Export mappings:

| Sheet | Source |
| :--- | :--- |
| students | `db.students` |
| class incharge | `db.classIncharges` |
| subjects | `db.subjects` (chapters JSON) |
| timetable | `db.timetablePeriods` |
| staff attendance | `db.staffAttendanceRecords` |
| student daily attendance | `db.dailyAttendanceRecords` |
| monthly summary | `db.students` + summary lookup (hardcoded month 8/2026) |
| attendance master | `AttendanceAggregationService.buildAttendanceMasterRows(db)` |
| marks | `db.testRecords` |
| syllabus | `db.syllabusTopics` |
| RMS | `db.rmsTickets` |
| exams | `db.examSchedules` |
| staff | `db.staffDirectory` |
| announcements | `db.announcements` |

**Issues**

- Monthly summary export hardcodes August 2026 and a generic absent-date list.
- Timetable export derives a subject code from the subject text rather than using the real `subjectId`.
- Announcement `created_at` is written as an ISO string, while the index expects `published_at` in some queries.
- The workbook has no cell styling, column widths, data validation, freeze panes, or notes; the UI claims “formatted bold headers”.
- No export of audit history or per-dataset subsets (except legacy CSV methods).

### 5.2 Legacy CSV exports

`MockDatabase` provides:

- `exportStudentsMaster`
- `exportAttendanceMaster`
- `exportMarksMaster`
- `exportTimetableMaster`
- `exportSyllabusMaster`
- `exportRmsRecords`
- `exportExamSchedules`
- `exportStaffAccessMaster`

They produce simple CSV strings, not `.xlsx`.

---

## 6. Ingestion validation rules as implemented

| Sheet | Required | Duplicate guard | Type guard | FK guard | Transaction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| students | name; class section in some paths | name+section aborts; student ID warns | none | none | no |
| class incharge | section | none (last wins) | none | none | no |
| subjects | code + section | none (last wins) | JSON parse falls back | none | no |
| timetable | section, subject | same start time in file only | none | none | no |
| staff attendance | staff_id + date | record ID | status enum fallback | none | no |
| student daily attendance | student_id + date | record ID | status enum fallback | none | no |
| monthly summary | student_id | summary ID | numeric fallbacks | none | no |
| attendance master | student_id | none | numeric fallbacks | none | no |
| marks | student/test | test ID (legacy) | numeric fallbacks | name→student, fallback first | no |
| syllabus | item ID | item ID | bool fallback | none | no |
| RMS | note ID | none | category heuristic | none | no |
| exams | exam ID | exam ID | numeric fallback | none | no |
| staff | name + email | email in batch | email contains `@` | none | no |
| announcements | announcement ID | ID | pin parser | none | no |

**Rewrite requirement:** validate every rule **before** writing, produce a row-level error report, and either commit the whole workbook atomically or explicitly support a partial import with sheet-level status.

---

## 7. Template and file-generation tools

- `tool/generate_master_excel.dart`: generates a 9-sheet workbook using hardcoded demo rows. Does not match the 14-sheet current schema.
- `tool/generate_master_excel_2.dart`: intended second generator; currently has a syntax error (`Expected to find '}'` at the end), so `dart run`/analysis fails.
- Neither tool is invoked by the app. They are development utilities.

**Recommendation:** replace both with a single, tested generator that reads the canonical schema definitions and emits a template with:

- header row,
- example row,
- data validation lists,
- column widths,
- frozen header,
- a “README” sheet with field rules and version.

---

## 8. Import UX requirements for the rewrite

1. **Choose what to import**: full workbook or one dataset.
2. **Dry run**: parse + validate, show a per-row diff (insert/update/skip/error).
3. **Resolve errors in place**: download an error CSV with row numbers and messages.
4. **Commit**: atomic or clearly labelled partial commit.
5. **Report**: counts inserted/updated/skipped/failed per sheet; a downloadable log.
6. **History**: who imported what, when, from which file, with a rollback option for the last import.
7. **Idempotency**: re-uploading the same file must not duplicate rows; use stable keys and upserts.
8. **Versioning**: reject or migrate old 8/9-sheet workbooks with a clear message.
9. **Large files**: stream/parse in a background job; don't block the UI.
10. **Security**: validate file type/size, sanitise formulas (CSV injection), and never execute macros.
