# 05 — Data Model

> This document describes the **canonical domain model used by the running app** (`core_shared/lib/models/...`), plus the duplicate legacy model and the storage mappings. Where the code disagrees with itself, the discrepancy is called out.

---

## 1. Domain map

```mermaid
erDiagram
    STAFF ||--o{ CLASS : "class teacher / incharge"
    STAFF ||--o{ SUBJECT : "assigned teacher"
    STAFF ||--o{ TIMETABLE : "teaches"
    STAFF ||--o{ RMS_TICKET : "raises"
    STAFF ||--o{ STAFF_ATTENDANCE : "has"
    CLASS ||--o{ STUDENT : "enrols"
    CLASS ||--o{ TIMETABLE : "has periods"
    CLASS ||--o{ SUBJECT : "offers"
    CLASS ||--o{ CLASS_INCHARGE : "has"
    STUDENT ||--o{ TEST_RECORD : "earns"
    STUDENT ||--o{ ATTENDANCE_RECORD : "has daily"
    STUDENT ||--o{ ATTENDANCE_SUMMARY : "has cumulative"
    EXAM ||--o{ TEST_RECORD : "produces"
    SUBJECT ||--o{ SYLLABUS_TOPIC : "contains"
    ANNOUNCEMENT }o--|| STAFF : "published by"
```

---

## 2. Identity and ID conventions

| Entity | Primary key | Format / example | Notes |
| :--- | :--- | :--- | :--- |
| Staff | `staff_id` | `STF-001`, `TCH-001`, `OPS-001` | Used by Excel, admin, incharge. |
| Teacher (Firestore) | `teacher_id` | `tch_sarah_01` or `STF-001` | Separate `teachers` collection; ID may equal staff ID. |
| Class | `class_id_section` | `10-A`, `9-B` | Composite of grade + section. |
| Student | `student_id` | `STU-10A-01` | Also a Firestore doc ID in some paths. |
| Student roll | `roll_number` | `01`, `10A-01` | Unique within section only. |
| Subject offering | `subject_code` + `class_id_section` | `MATH-10` + `10-A` | `assignmentId = subjectCode-classIdSection`. |
| Timetable period | `timetable_id` / `id` | `TT-10A-P1` or generated `tt_...` | No enforced format. |
| Exam | `exam_id` | `EXM-10A-MATH-CA1`, `EXAM-...-...` | Two generators exist. |
| Test record | `record_id` | `{STUDENT}_{EXAM}` or `{STUDENT}_{SUBJECT}_{CATEGORY}` | Deterministic in newer code; two formats. |
| Attendance (daily batch) | `attendance_id` | `10-A_2026-08-26` | Section + date; one doc per day. |
| Attendance (granular) | `record_id` | `ATT_20260826_AM_STU-10A-01` | Session-aware. |
| Monthly summary | `summary_id` | `SUM_202608_STU-10A-01` | Year+month+student. |
| Staff attendance | `record_id` | `SA_20260826_STAFF-01` | Date + staff. |
| Class incharge | `class_id_section` | `10-A` | One active record per section. |
| RMS ticket | `note_id` / `ticket_id` | `RMS-2026-001` | Human-readable sequence. |
| Announcement | `announcement_id` | `ANN-2026-001` | Human-readable sequence. |

**Rewrite recommendation:** use UUID/ULID database keys for all rows, keep human-readable codes as unique secondary fields (student number, roll, ticket number) so imports remain friendly.

---

## 3. Entities

### 3.1 `Student`

File: `core_shared/lib/models/student.dart`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Internal UUID / Firestore document key. |
| `studentId` | String | Human student number, e.g. `STU-10A-01`. Defaults to `STU-$rollNumber`. |
| `rollNumber` | String | Roll within section. |
| `name` | String | Full name. |
| `parentPhone` | String | Guardian contact. |
| `className` | String | Display name, e.g. `Class 10-A`. |
| `classIdSection` | String | Section key, e.g. `10-A`. Defaults heuristically from class name. |
| `avatarUrl` | String | Unused in the current UI. |
| `attendanceStatus` | `AttendanceStatus` | `present`, `absent`, `late`, `excused`. |
| `attendanceRate` | double | 0.0–1.0 historical rate (seed/imported). |
| `recentTestScores` | `List<double>` | Percentages used for risk and report slips. |
| `remarks` | String | Free-text note. |

**Derived**

- `isAtRisk`: average of recent scores `< 35`, or the last score `< 35` (with at least 2 scores).
- `attendance`: `attendanceRate * 100`.
- `averageScore`: mean of recent scores.

**Canonical `StudentModel`** (used by Firestore/Excel and result matrices):

| Field | Type |
| :--- | :--- |
| `studentId` | String |
| `rollNumber` | String |
| `name` | String |
| `classIdSection` | String |
| `gradeLevel` | String |
| `parentPhone` | String |
| `searchKeywords` | `List<String>` (prefix/ngram tokens for Firestore search) |

The two student classes coexist. `Student` is the UI/analytics model; `StudentModel` is the Firestore/import model. They are not interchangeable.

#### Duplicate `StudentMasterModel` (Excel)

`StudentMasterModel`: `studentId, name, grade (int), section, dob, parentContact, address`. This is a **third** student shape and does not include roll number, class section, or remarks.

---

### 3.2 `StaffModel`

File: `core_shared/lib/models/staff_model.dart`
Collection: `/staff/{staff_id}`

| Field | Type | Description |
| :--- | :--- | :--- |
| `staffId` | String | `STF-001`, `TCH-001`, etc. |
| `name` | String | Full legal name. |
| `phone` | String | Contact phone. |
| `email` | String | Lowercase login email. |
| `staffType` | String | `Principal`, `Vice Principal`, `Teacher`, `Operator`, `Electrician`, `Bus Driver`, `Support Staff`. |
| `accessLevel` | String | `SuperAdmin`, `SubAdmin`, `TeacherApp`, `NoAccess`. |
| `department` | String | Department / wing. |
| `isActive` | bool | Login/attendance eligibility. |
| `createdAt` | DateTime | Creation timestamp. |
| `joiningDate` | DateTime? | Optional joining date. |

**Capability getters**

- `isSuperAdmin` (also true for `superadmin@school.com`)
- `isSubAdmin`
- `isTeacherApp`
- `hasNoAccess`
- `canAccessWindowsAdmin` = active && (SuperAdmin || SubAdmin)
- `canAccessTeacherApp` = active && (SuperAdmin || SubAdmin || TeacherApp)
- `hasSoftwareLogin` = active && access != NoAccess

**Problems**

- Seeded `OPS-004` is used twice (electrician and support staff), violating the PK.
- `facultyList` (`TeacherAccount`) is a separate model from `StaffModel`, so active faculty vs staff counts diverge.
- Firestore rules use `teachers.role == 'admin'`, not `staff.access_level`.

---

### 3.3 `TeacherModel` / `TeacherAccount`

**`TeacherModel`** — Firestore `/teachers/{teacher_id}`:

| Field | Type |
| :--- | :--- |
| `teacherId` | String |
| `name` | String |
| `email` | String |
| `department` | String |
| `role` | `admin` \| `teacher` |
| `createdAt` | DateTime |

**`TeacherAccount`** — in-memory faculty directory:

| Field | Type |
| :--- | :--- |
| `id` | String (`tch_sarah_01`) |
| `name` | String |
| `email` | String |
| `department` | String |
| `assignedClasses` | `List<String>` display names |
| `isActivated` | bool |

Neither is linked by foreign key to `StaffModel`; the same person may exist in all three with different IDs (`TCH-001`, `STAFF-01`, `tch_sarah_01`).

---

### 3.4 `ClassModel`

Collection: `/classes/{class_id_section}`

| Field | Type | Description |
| :--- | :--- | :--- |
| `classIdSection` | String | PK, `10-A`. |
| `gradeLevel` | String | `10` or `Grade 10`. |
| `section` | String | `A`. |
| `classTeacherId` | String | FK to `teachers.teacher_id`. |
| `classTeacherEmail` | String | Denormalised lowercase email for query. |

`displayName` = `Grade $gradeLevel-$section`.

---

### 3.5 `TimetablePeriod`

File: `core_shared/lib/models/timetable.dart`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Period row key. |
| `classIdSection` | String | Section. |
| `subjectId` | String | Subject code, e.g. `SUB-MATH-10`. |
| `subject` | String | Display subject, e.g. `Mathematics (Algebra)`. |
| `teacherId` | String | Teacher/staff identifier (inconsistent formats). |
| `dayOfWeekInt` | int | 1 = Monday … 5 = Friday (7 supported in parsing). |
| `startTime24` | String | `HH:mm:ss`. |
| `endTime24` | String | `HH:mm:ss`. |
| `periodNumber` | int | 1-based period index. |
| `className` | String | Display name. |
| `room` | String | Room/lab. |
| `startTime` | String | Display `08:30 AM`. |
| `endTime` | String | Display `09:15 AM`. |
| `dayOfWeek` | String | `Monday`. |
| `topicPreview` | String | Lesson preview. |
| `isLab` | bool | Lab flag. |

**Convenience getters**

- `teacherEmail`: if `teacherId` contains `@`, return it; otherwise `s.nawaz@school.edu`.
- `staffId`: if `teacherId` contains `tch_`, return `STAFF-01`; otherwise return `teacherId`.
- `teacher`: maps `STAFF-01/02/03` or `sarah` to demo names; anything else → `Engr. Raheem`.

These mappings are fragile and incorrect for real data.

---

### 3.6 `SubjectModel` and `ChapterProgress`

File: `core_shared/lib/models/subject_model.dart`
Sheet: `subjects_master`

| Field | Type | Description |
| :--- | :--- | :--- |
| `subjectCode` | String | Grade-wide code, `MATH-10`. |
| `subjectName` | String | `Mathematics`. |
| `classIdSection` | String | `10-A`. |
| `assignedStaffId` | String | `STAFF-01`. |
| `assignedTeacherName` | String | Denormalised. |
| `chapters` | `List<ChapterProgress>` | JSON-encoded in the sheet. |
| `rowIndex` | int? | Excel row. |

**`ChapterProgress`**

| Field | Type |
| :--- | :--- |
| `chapterNumber` | int? |
| `chapter` | String |
| `status` | `pending` \| `in_progress` \| `completed` |

`nextStatus()` cycles pending → in_progress → completed → pending.
`completionPercentage = completed / total * 100` (0–100).

`chaptersJson` is a JSON array; `parseChaptersJson` accepts a JSON array or a comma-separated fallback.

---

### 3.7 `SyllabusTopic`

File: `core_shared/lib/models/syllabus.dart`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Internal ID. |
| `syllabusItemId` | String | `SYL-10A-M01`. |
| `classIdSection` | String | `10-A`. |
| `subject` | String | `Mathematics`. |
| `chapterNumber` | int | 1-based. |
| `chapterTitle` | String | Chapter name. |
| `topicTitle` | String | Topic name. |
| `completionStatus` | bool | Completed? |
| `completedAt` | DateTime? | When ticked. |
| `notes` | String | Optional. |

This is a **second** syllabus representation alongside `SubjectModel.chapters`. Teacher UI uses `SubjectModel`; admin ingestion uses `SyllabusTopic`.

---

### 3.8 `TestRecord` (UI/analytics)

File: `core_shared/lib/models/test_record.dart`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Internal key. |
| `testId` | String | Human/test code. |
| `studentId` | String (may be internal `stu_1`) | Student reference. |
| `studentName` | String | Denormalised. |
| `classIdSection` | String | Section. |
| `className` | String | Display. |
| `subject` | String | Subject. |
| `title` | String | Assessment title. |
| `marksObtained` | double | Mutable. |
| `maxMarks` | double | Default 50. |
| `date` | DateTime | Assessment date. |
| `feedback` | String | Optional. |
| `examCategory` | `ExamCategory` | `classTest`, `ca1`, `ca2`, `midTerm`, `endTerm`. |
| `isPrincipalMandated` | bool | Mid/end or explicit. |
| `createdBy` | String | Teacher/principal label. |
| `weightagePercent` | double | Default 20. |
| `studentScores` | `Map<String,double>` | Cohort scores keyed by student. |

**Derived**

- `percentage = marksObtained / maxMarks * 100`
- `isFailing = percentage < 35`
- `classAveragePercentage`: average of `studentScores / maxMarks * 100`
- `isClassAtRisk = classAveragePercentage < 50`
- `passCount` / `failCount`: pass threshold **40%**.

**Inconsistency:** `isFailing` uses 35%, `passCount` uses 40%.

---

### 3.9 `TestRecordModel` (Firestore)

File: `core_shared/lib/models/test_record_model.dart`
Collection: `/test_records/{record_id}`

| Field | Type | Description |
| :--- | :--- | :--- |
| `recordId` | String | `{STUDENT}_{EXAM}` or `{STUDENT}_{SUBJECT}_{CATEGORY}`. |
| `studentId` | String | `STU-10A-01`. |
| `studentName` | String | Denormalised. |
| `rollNumber` | String | Optional. |
| `classIdSection` | String | Section. |
| `subject` | String | Subject. |
| `examId` | String | FK to exam. |
| `examCategory` | String | `ca1`, `ca2`, `midTerm`, `endTerm`. |
| `marksObtained` | double | Clamped 0..max. |
| `maxMarks` | double | > 0. |
| `scorePercentage` | double | Computed. |
| `isPassed` | bool | `>= 35%`. |
| `enteredByTeacherId` | String | Attribution. |
| `updatedAt` | DateTime | Last update. |

**Derived:** `letterGrade` A+ ≥90, A ≥80, B ≥70, C ≥60, D ≥50, E ≥35, F <35.

`buildRecordId` prefers `{student}_{exam}` when an exam ID exists.

---

### 3.10 `ExamScheduleModel`

File: `core_shared/lib/models/exam_schedule_model.dart`
Collection: `/exam_schedules/{exam_id}`

| Field | Type | Description |
| :--- | :--- | :--- |
| `examId` | String | PK. |
| `classIdSection` | String | Section. |
| `subject` | String | Subject. |
| `examCategory` | String | `ca1`, `ca2`, `midTerm`, `endTerm`. |
| `examDate` | String | `YYYY-MM-DD`. |
| `startTime` | String | `HH:mm:ss`. |
| `endTime` | String | `HH:mm:ss`. |
| `maxMarks` | double | Max score. |
| `assignedTeacherId` | String | Staff/teacher ID. |
| `assignedTeacherEmail` | String | Denormalised. |
| `assignedTeacherName` | String | Denormalised. |
| `marksEntryStatus` | String | `Upcoming`, `Open`, `Submitted`, `Locked`. |
| `marksSubmissionDeadline` | DateTime? | Optional. |

**Status methods**

- `isConcluded(now)`: uses `examDate` + `endTime` local.
- `effectiveStatus`: Submitted/Locked win; otherwise Open if concluded; else stored status.
- `isUnlockedForEntry`, `isSubmitted`, `isLocked`, `isUpcoming`.
- `statusColor` / `statusBgColor` for UI.

**Duplicate legacy class:** `core_shared/lib/models/excel_db/exam_schedule_model.dart` has `examId, subject, grade, date, time, room, status`. This class is incompatible and is the cause of the test compile failure.

**Second UI-level representation:** `TestRecord` also carries cohort scores, so an exam may have both a `TestRecord` and multiple `TestRecordModel` rows.

---

### 3.11 Attendance models

#### `AttendanceStatus`

| Value | Code | Label | Meaning |
| :--- | :--- | :--- | :--- |
| `present` | P | Present | Counts fully attended. |
| `absent` | A | Absent | Counts absent. |
| `late` | L | Late | Counts 0.5 attended in monthly aggregation. |
| `excused` | E | Excused | Counts excused; not present. |

`AttendanceStatus.fromString` accepts P/Present, A/Absent, L/Late, E/Excused/Leave; default Present.

#### `SessionType`

`morning`, `afternoon`, `fullDay` (labels `Morning`, `Afternoon`, `Full_Day`).

#### `DailyAttendanceRecord`

Sheet `student_attendance_daily` / `attendance_daily`:

`record_id, student_id, student_name, class_id_section, date, day_of_week, session_type, status, remarks, marked_by_staff_id, marked_at`

ID: `ATT_{YYYYMMDD}_{AM|PM|FULL}_{studentId}`.

#### `MonthlyAttendanceSummary`

Sheet `attendance_monthly_summary`:

`summary_id, student_id, student_name, class_id_section, month, year, working_days, days_present, days_absent, days_late, days_excused, attendance_percentage, absent_dates_list`

ID: `SUM_{YYYYMM}_{studentId}`.

Formula in the sheet service: `(present + 0.5 * late) / working_days * 100`.
Formula in the mock DB: counts effective attended as `present + round(0.5 * late)`, with fallbacks.

#### `AttendanceRecordModel` / `StudentAttendanceItem`

Firestore `attendance_records/{section}_{date}`:

| Field | Type |
| :--- | :--- |
| `attendanceId` | String |
| `classIdSection` | String |
| `date` | `YYYY-MM-DD` |
| `takenByTeacherId` | String |
| `takenByTeacherName` | String |
| `totalStudents` | int |
| `presentCount` | int |
| `absentCount` | int |
| `lateCount` | int |
| `attendancePercentage` | double |
| `records` | List of `{student_id, roll_number, student_name, status, remarks}` |
| `submittedAt` | Timestamp |

**Note:** `excused` is not counted as present/absent/late; `present / total * 100` ignores excused, which makes the percentage inconsistent when excused rows exist.

#### `StudentAttendanceSummaryModel`

Collection `student_attendance_summary/{student_id}`:

`student_id, student_name, roll_number, class_id_section, total_conducted, total_attended, total_absent, total_late, cumulative_percentage, last_updated`

Risk tiers: `optimal ≥75`, `moderateRisk 60–74.99`, `criticalRisk <60`.

#### `StaffAttendanceRecord`

Sheet `staff_attendance_daily`:

`record_id, staff_id, date, check_in_time, check_out_time, status, leave_reason`

Statuses: `Present`, `Absent`, `Half-Day`, `On Leave`.
ID: `SA_{YYYYMMDD}_{STAFF_ID}`.

---

### 3.12 `ClassInchargeModel`

Sheet `class_incharge_master`:

| Field | Type | Description |
| :--- | :--- | :--- |
| `classIdSection` | String | PK. |
| `period1DefaultTeacherId` | String | Default roll-call taker. |
| `inchargeStaffId` | String | Active incharge. |
| `teacherName` | String | Denormalised. |
| `academicYear` | String | `2026-2027`. |
| `rowIndex` | int? | Excel row. |

`isOverridden`: Period-1 default differs from active incharge.

**Rule:** if no incharge record, `MockDatabase.isStaffIncharge` falls back to the teacher of the class's period 1; if none, `STAFF-01`.

---

### 3.13 `RmsTicket`

File: `core_shared/lib/models/rms_ticket.dart`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Internal. |
| `noteId` | String | `RMS-2026-001`. |
| `timestamp` | DateTime | Created at. |
| `teacherId` | String | Sender. |
| `teacherName` | String | Denormalised. |
| `teacherEmail` | String | Denormalised. |
| `category` | `RmsCategory` | Classification. |
| `subject` | String | Short title. |
| `messageBody` | String | Body. |
| `roomNumber` | String? | Extracted/maintenance room. |
| `isConfidential` | bool | Vault flag. |
| `adminResolutionStatus` | `RmsStatus` | Pending/under review/approved/rejected/resolved. |
| `principalNote` | String? | Admin reply. |
| `priority` | String | Medium default. |

**Categories:** `staffLeave`, `maintenance`, `confidential`, `generalOperational`, `operationalPriority`, `facilityGearMalfunction`, `leaveRequest`, `studentDisciplinary`, `academicResource`.

**Statuses:** `pending`, `underReview`, `approved`, `rejected`, `resolved`.

**Classification:** see [Business Rules § 7](06-business-rules.md#7-rms-classification).

---

### 3.14 `AnnouncementModel`

Collection `/announcements/{announcement_id}`

| Field | Type | Description |
| :--- | :--- | :--- |
| `announcementId` | String | PK. |
| `title` | String | Headline. |
| `content` | String | Body. |
| `importanceLevel` | String | `Normal`, `Important`, `Urgent`, `Emergency`. |
| `targetAudience` | String | `All`, `TeachersOnly`, `StudentsOnly`, `Class10`, `Class9`. |
| `imageUrl` | String? | Asset, URL, or data URI. |
| `isPinned` | bool | Sticky. |
| `publisherName` | String | Author. |
| `createdAt` | DateTime | Publish time. |

Helpers: `requiresAlertHeader`, `relativeTimeFormatted`, `isEmergency/isUrgent/isImportant/isNormal`.

**Default pin:** Urgent/Emergency default pinned when parsed from Firestore.

---

### 3.15 `ClassResultMatrix`

DTOs for the admin/teacher result matrix:

- `StudentMarkEntry { studentId, studentName, marksObtained }`
- `StudentResultRow { student, ca1, ca2, midTerm, endTerm }`
  - `totalObtained`, `totalMaxMarks`, `cumulativePercentage`
  - `isAtRisk`: any term <35 or cumulative <35
  - `overallGrade` A+..F
- `ClassResultMatrix { classIdSection, subject, rows }`
  - `totalStudents`, `atRiskStudentsCount`, `passedStudentsCount`
  - `classAveragePercentage`
  - `ClassResultMatrix.build(...)` joins students and records by section/subject and maps categories.

**Gap:** `DatabaseService.getClassResultMatrix` and `AssessmentService.getClassResultMatrixStream` exist but are not used by the admin analytics screen.

---

## 4. Storage mapping

### 4.1 Firestore collections

| Collection | Model | Used? | Rules? |
| :--- | :--- | :---: | :---: |
| `teachers` | `TeacherModel` | ❌ | ✅ |
| `classes` | `ClassModel` | ❌ | ✅ |
| `students` | `StudentModel` | ❌ | ✅ |
| `attendance_records` | `AttendanceRecordModel` | ✅ via `AttendanceService` | ❌ |
| `student_attendance_summary` | `StudentAttendanceSummaryModel` | ❌ | ❌ |
| `exam_schedules` | `ExamScheduleModel` | ✅ via `AssessmentService` | ✅ |
| `test_records` | `TestRecordModel` | ✅ via `AssessmentService` | ✅ |
| `announcements` | `AnnouncementModel` | ✅ via `AnnouncementService` | ✅ |
| `staff` | `StaffModel` | ❌ | ❌ |
| `timetables` (intended) | `TimetablePeriod` | ❌ | ❌ |
| `syllabus` (intended) | `SyllabusTopic` | ❌ | ❌ |
| `rms_tickets` (intended) | `RmsTicket` | ❌ | ❌ |
| `class_incharges` (intended) | `ClassInchargeModel` | ❌ | ❌ |
| `subjects` (intended) | `SubjectModel` | ❌ | ❌ |

### 4.2 Firestore rules gaps

`firestore.rules` defines helpers based on:

- `teachers/{uid}.role == 'admin'` for admin.
- `classes/{section}.class_teacher_email` for class assignment.
- `test_records` writes only if `entered_by_teacher_id` matches and the teacher is the class teacher.
- Announcements admin-only write.

Missing entirely:

- attendance writes/reads for teachers
- student attendance summaries
- staff directory reads/writes
- timetable reads/writes
- syllabus reads/writes
- RMS create/read/update
- class incharge writes
- subject assignments
- exam schedule class-teacher check uses `request.resource.data.class_id_section` — on delete this field is absent and the rule fails.

Because missing rules default-deny, the app's best-effort Firestore writes to those collections would fail in a real project. The code catches the failures, so the UI appears to work.

### 4.3 Firestore indexes

`firestore.indexes.json` provides:

- students: `(class_id_section, roll_number)`, `(grade_level, roll_number)`, `(class_id_section, name)`
- test_records: `(class_id_section, subject, exam_category)`, `(student_id, exam_category)`, `(class_id_section, updated_at desc)`
- exam_schedules: `(class_id_section, exam_date)`
- announcements: `(target_audience, published_at desc)`, `(importance_level, published_at desc)`

**Code/field mismatch:** queries use `created_at`, not `published_at`, in some places (`AnnouncementService.streamAllAnnouncements` uses `created_at`, indexes use `published_at`). The `toMap()` writes `created_at`. This would cause missing-index or empty results.

### 4.4 Excel workbook mapping

| Sheet | Domain | Canonical model |
| :--- | :--- | :--- |
| `students_master` | Roster | `Student` / `StudentModel` / `StudentMasterModel` |
| `class_incharge_master` | Attendance permissions | `ClassInchargeModel` |
| `subjects_master` | Subjects + JSON syllabus | `SubjectModel` |
| `timetable_master` | Timetable | `TimetablePeriod` / `TimetableMasterModel` |
| `staff_attendance_daily` | Staff attendance | `StaffAttendanceRecord` |
| `student_attendance_daily` | Daily roll-call | `DailyAttendanceRecord` |
| `attendance_monthly_summary` | Monthly rollup | `MonthlyAttendanceSummary` |
| `attendance_master` | Cumulative registry | `AttendanceMasterRecordModel` |
| `marks_master` | Marks | `TestRecord` / `TestRecordModel` / `MarksMasterModel` |
| `syllabus_master` | Syllabus topics | `SyllabusTopic` / `SyllabusMasterModel` |
| `rms_records` | RMS tickets | `RmsTicket` / `RmsRecordModel` |
| `exam_schedules` | Exams | `ExamScheduleModel` |
| `staff_access` | Staff/RBAC | `StaffModel` / `StaffAccessModel` |
| `announcements` | Broadcasts | `AnnouncementModel` |

See [07 — Excel & Ingestion](07-excel-and-ingestion.md) for exact columns and conflicts.

---

## 5. Enum summary

| Enum | Values |
| :--- | :--- |
| `UserRole` | `teacher`, `admin` |
| `AttendanceStatus` | `present`, `absent`, `late`, `excused` |
| `AttendanceRecordStatus` | `present`, `absent`, `late` |
| `StaffAttendanceStatus` | `present`, `absent`, `halfDay`, `onLeave` |
| `SessionType` | `morning`, `afternoon`, `fullDay` |
| `ExamCategory` | `classTest`, `ca1`, `ca2`, `midTerm`, `endTerm` |
| `AttendanceRiskTier` | `optimal`, `moderateRisk`, `criticalRisk` |
| `RmsCategory` | 9 values (see above) |
| `RmsStatus` | `pending`, `underReview`, `approved`, `rejected`, `resolved` |
| `ImportanceLevels` | `Normal`, `Important`, `Urgent`, `Emergency` |
| `TargetAudiences` | `All`, `TeachersOnly`, `StudentsOnly`, `Class10`, `Class9` |
| `AccessLevels` | `SuperAdmin`, `SubAdmin`, `TeacherApp`, `NoAccess` |
| `StaffTypes` | `Principal`, `Vice Principal`, `Teacher`, `Operator`, `Electrician`, `Bus Driver`, `Support Staff` |
| `MarksEntryStatus` | `Upcoming`, `Open`, `Submitted`, `Locked` |

---

## 6. Canonical schema recommendation

For the rewrite, collapse the competing models into one set of tables/collections. Minimum viable schema:

```text
academic_years(id, label, starts_on, ends_on, is_active)

staff(id, staff_code, name, email, phone, staff_type, department,
      access_level, is_active, joined_on, created_at)

classes(id, academic_year_id, grade_level, section, display_name,
        class_teacher_staff_id)

students(id, student_code, roll_number, name, class_id, parent_phone,
         date_of_birth, address, status, created_at)
  unique (class_id, roll_number)
  unique (student_code, academic_year_id)

subjects(id, code, name, grade_level)
subject_offerings(id, subject_id, class_id, teacher_staff_id)
  unique (subject_id, class_id)

timetable_periods(id, class_id, subject_offering_id, teacher_staff_id,
                  day_of_week, period_number, starts_at, ends_at, room)

syllabus_items(id, subject_offering_id, chapter_number, chapter_title,
               topic_title, status, completed_at)

exams(id, class_id, subject_offering_id, category, title, exam_date,
      starts_at, ends_at, max_marks, assigned_teacher_staff_id,
      marks_status, submission_deadline)

test_records(id, exam_id, student_id, subject_offering_id, marks_obtained,
             max_marks, entered_by_staff_id, entered_at, updated_at)
  unique (exam_id, student_id)

attendance_sessions(id, class_id, date, session_type, period_number,
                    taken_by_staff_id, submitted_at)
attendance_entries(id, session_id, student_id, status, remarks)
  unique (session_id, student_id)

staff_attendance(id, staff_id, date, check_in, check_out, status, leave_reason)
  unique (staff_id, date)

class_incharges(id, class_id, default_staff_id, active_staff_id,
                academic_year_id, created_at)

rms_tickets(id, ticket_no, sender_staff_id, category, subject, body,
            room, priority, is_confidential, status, principal_note,
            created_at, resolved_at)

announcements(id, title, body, importance, audience, image_url, is_pinned,
              publisher_staff_id, published_at, expires_at)

audit_events(id, actor_staff_id, action, entity, entity_id, before, after,
             ip, created_at)
```

Key choices:

- Use UUID/ULID `id` plus human-readable codes.
- Keep foreign keys explicit; do not parse IDs from strings.
- Normalise timetable and subject assignment through `subject_offerings`.
- Store attendance at session level, not one doc per class per day.
- Store exam and test records separately, with a unique `(exam_id, student_id)`.
- Keep one syllabus representation (status enum, not bool + JSON + chapters).
- Add `academic_year_id` everywhere a school year matters.
- Add audit columns (`created_at`, `updated_at`, `created_by`) and soft delete where history matters.
