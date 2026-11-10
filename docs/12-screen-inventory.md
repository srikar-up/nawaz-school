# 12 — Screen Inventory & Traceability

> File-level map from route/widget to feature, data source, and implementation status. Use this to locate behaviour during the rewrite.

---

## 1. Entry points

| Entry | File | Role | Behaviour |
| :--- | :--- | :--- | :--- |
| `main()` | `lib/main.dart` | Both | Initializes Firebase (best-effort), runs `NawazSchoolTeacherApp`. |
| `NawazSchoolTeacherApp` | `lib/main.dart` | Both | `MaterialApp`, light theme, `SplashScreen`. |
| `SplashScreen` | `lib/features/splash/presentation/splash_screen.dart` | Both | 1 s brand animation → `MainNavScreen`. |
| `MainNavScreen` | `lib/features/navigation/presentation/main_nav_screen.dart` | Both | Chooses teacher shell or admin tree by `db.isAdmin`; handles login/loading gates. |
| `AdminScreen` | `lib/features/admin/presentation/admin_screen.dart` | Admin | Main admin shell and 16-module switch. |

---

## 2. Teacher screens and widgets

| # | Widget | File | Purpose | Data source | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| T1 | `SplashScreen` | `features/splash/presentation/splash_screen.dart` | Branding/transition | Asset `logo.jpeg` | ✅ |
| T2 | `MainNavScreen` | `features/navigation/presentation/main_nav_screen.dart` | Shell, tabs, role switch, quick actions | `MockDatabase` | ✅ |
| T3 | `TeacherAppHeader` | `shared/widgets/app_header.dart` | Greeting, class picker, notices, profile/role | `db` | ✅ |
| T4 | `DashboardScreen` | `features/dashboard/presentation/dashboard_screen.dart` | Daily home | `db.students`, announcements, risk, syllabus | 🟡 |
| T5 | `AttendanceScreen` | `features/attendance/presentation/attendance_screen.dart` | Roll-call | `db.studentsInSelectedClass`, `AttendanceService`, `db.batchSaveDailyAttendance` | ✅ |
| T6 | `TimetableScreen` | `features/timetable/presentation/timetable_screen.dart` | Schedule | `db.timetable` | 🟡 |
| T7 | `MarksScreen` | `features/marks/presentation/marks_screen.dart` | Exam marks + ledger | `db.examSchedules`, `AssessmentService`, `db.testRecords` | ✅ |
| T8 | `SyllabusScreen` | `features/syllabus/presentation/syllabus_screen.dart` | Chapter progress | `db.getSubjects*`, `db.updateSubjectChapters` | ✅ |
| T9 | `ReportsScreen` | `features/reports/presentation/reports_screen.dart` | Student report slip | `db.studentsInSelectedClass` | 🟡 |
| T10 | `RmsScreen` | `features/rms/presentation/rms_screen.dart` | Requests/leave/maintenance/confidential | `db.rmsTickets`, `db.submitRmsTicket` | ✅ |
| T11 | `TeacherNoticesScreen` | `features/announcements/presentation/teacher_notices_screen.dart` | Broadcast feed | `AnnouncementService`, `db.announcements` | ✅ |
| T12 | `TeacherProfileScreen` | `features/profile/presentation/teacher_profile_screen.dart` | Faculty profile/preferences | `db`, hardcoded fields | 🟡 |
| T13 | `DashboardSkeleton` | `core_shared/lib/widgets/skeleton_loader.dart` | Loading placeholder | — | ✅ |

### 2.1 Teacher shared widgets

| Widget | File | Used by |
| :--- | :--- | :--- |
| `AuroraBackground` | `core_shared/lib/widgets/aurora_background.dart` | Most teacher screens |
| `PercentRing` | `core_shared/lib/widgets/percent_ring.dart` | Dashboard, attendance, marks, reports, syllabus |
| `StatMetricCard` | `core_shared/lib/widgets/stat_metric_card.dart` | Legacy/unused teacher widgets |
| `QuickActionCard` | `core_shared/lib/widgets/quick_action_card.dart` | Old home screen (unused) |
| `SkeletonLoader` | `core_shared/lib/widgets/skeleton_loader.dart` | Dashboard skeleton |

---

## 3. Admin screens and widgets

| # | Widget | File | Purpose | Data source | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| A1 | `AdminLoginScreen` | `features/admin/presentation/screens/admin_login_screen.dart` | Admin auth UI | `db.staffList`, `AuthService` | 🟡 |
| A2 | `AdminLoadingScreen` | `features/admin/presentation/screens/admin_loading_screen.dart` | Timed boot animation | none | 🔴 |
| A3 | `AdminScreen` | `features/admin/presentation/admin_screen.dart` | Shell, dashboard, analytics, RMS, vault, audit, PDF | `MockDatabase` | ✅/🟡 |
| A4 | `MultiExcelCenterScreen` | `features/admin/presentation/screens/multi_excel_center_screen.dart` | Workbook download/validate/commit | `AdminStateController`, `ExcelMasterService` | ✅ |
| A5 | `LiveSpreadsheetGridScreen` | `features/admin/presentation/screens/live_spreadsheet_grid_screen.dart` | 14-dataset grids | `AdminStateController`, `db` | 🟡 |
| A6 | `StaffAccessHubScreen` | `features/admin/presentation/screens/staff_access_hub_screen.dart` | Staff CRUD/RBAC | `db.staffList` | ✅ |
| A7 | `AdminAnnouncementScreen` | `features/admin/presentation/screens/admin_announcement_screen.dart` | Broadcast composer/ledger | `AnnouncementService`, `db.announcements` | ✅ |
| A8 | `AttendanceAccessHubScreen` | `features/admin/presentation/screens/attendance_access_hub_screen.dart` | Class incharge overrides | `db.classIncharges`, `db.timetable` | ✅ |
| A9 | `SubjectAssignmentHubScreen` | `features/admin/presentation/screens/subject_assignment_hub_screen.dart` | Subject-teacher allocation | `db.subjects`, `db.staffList` | ✅ |
| A10 | `ExamAssignmentHubScreen` | `features/admin/presentation/screens/exam_assignment_hub_screen.dart` | Exam creation/assignment | `db.examSchedules`, `db.staffList` | ✅ |
| A11 | `AdminProfileScreen` | `features/admin/presentation/screens/admin_profile_screen.dart` | RBAC/session/sign-out | `db`, static copy | 🟡 |
| A12 | `StudentAttendanceHubScreen` | `views/attendance/student_attendance_hub_screen.dart` | Admin roll-call/matrix/inspector | `AttendanceController`, `db` | ✅ |
| A13 | `AdminAttendanceSummaryWidget` | `features/admin/presentation/widgets/admin_attendance_summary_widget.dart` | Dashboard attendance matrix | `AttendanceService`, `db` | ✅ |
| A14 | `BentoTheme` | `features/admin/presentation/widgets/bento_theme.dart` | Admin design tokens + painters | — | ✅ |
| A15 | `AdminStateController` | `features/admin/presentation/controllers/admin_state_controller.dart` | Filters, blueprints, staging, workbook generation | `db`, `ExcelMasterService` | ✅ |

### 3.1 Admin screens embedded in `AdminScreen`

| Method | Purpose | Status |
| :--- | :--- | :---: |
| `_buildBentoDashboard` | KPIs, attendance matrix, syllabus/velocity, risk, quick RMS | 🟡 |
| `_buildAnalyticalTrendsView` | Formal exams + static analytics | 🟡 |
| `_buildLeaveManagementDesk` | Leave approve/reject | ✅ |
| `_buildMaintenanceOperationsTracker` | Maintenance resolve/assign | ✅ |
| `_buildPrincipalSecureVault` | Confidential notes | 🟡 |
| `_buildTeacherSystemImpersonationAuditTool` | Phone wireframe with real teacher widgets | 🟡 |
| `_buildExecutiveProgressReportCompiler` | Static report preview | 🔴 |
| `_buildRestrictedAccessView` | SubAdmin guard | ✅ UI |

### 3.2 Legacy admin screens/components (not routed)

| File | Status | Notes |
| :--- | :---: | :--- |
| `views/dashboard/admin_dashboard_screen.dart` | ⚠️ unused/broken | Old dashboard; compile errors. |
| `views/dashboard/widgets/sidebar_navigation.dart` | ⚠️ unused | Old sidebar. |
| `views/dashboard/widgets/top_command_bar.dart` | ⚠️ unused | Old command bar. |
| `views/dashboard/widgets/kpi_metrics_row.dart` | ⚠️ unused | Old KPI row. |
| `views/dashboard/widgets/attendance_matrix_panel.dart` | ⚠️ unused | Old attendance matrix. |
| `views/dashboard/widgets/syllabus_velocity_panel.dart` | ⚠️ unused | Old velocity panel. |
| `views/dashboard/widgets/academic_risk_panel.dart` | ⚠️ unused/broken | `senderName`, `displayName`. |
| `views/dashboard/widgets/staff_rollcall_panel.dart` | ⚠️ unused/broken | Missing `department`. |
| `admin_screen.dart` → `_buildMultiExcelCenter` | ⚠️ dead | Older 5-tab ingestion UI. |
| `admin_screen.dart` → `_buildInAppSpreadsheetGridEditor` | ⚠️ dead | Older 4-sheet grid. |

---

## 4. Controllers

| Controller | File | Used by | Responsibility |
| :--- | :--- | :--- | :--- |
| `AttendanceController` | `lib/controllers/attendance_controller.dart` | `StudentAttendanceHubScreen` | Section/date/session state, roll-call toggles, monthly summary/matrix, incharge gate, save. |
| `StaffAttendanceController` | `lib/controllers/staff_attendance_controller.dart` | Legacy `staff_rollcall_panel` (unused) | Staff check-in/out/leave, metrics. |
| `ExcelDbController` | `lib/controllers/excel_db_controller.dart` | Tests/legacy only | In-memory workbook CRUD, file load/save/share. Broken by duplicate exam model. |
| `AdminStateController` | `lib/features/admin/presentation/controllers/admin_state_controller.dart` | Admin screens | 14 dataset blueprints, filters, staging, master workbook export/commit, row counts. |

---

## 5. Models (canonical)

All under `core_shared/lib/models/` unless noted.

| File | Classes | Notes |
| :--- | :--- | :--- |
| `student.dart` | `Student`, `AttendanceStatus` import | UI/analytics student. |
| `student_model.dart` | `StudentModel` | Firestore/import student with search keywords. |
| `teacher_model.dart` | `TeacherModel`, `UserRoles` | Firestore teacher/auth role. |
| `staff_model.dart` | `StaffModel`, `StaffTypes`, `AccessLevels` | Universal staff + RBAC. |
| `class_model.dart` | `ClassModel` | Section/class teacher. |
| `subject_model.dart` | `SubjectModel`, `ChapterProgress` | Subject offering + JSON chapters. |
| `syllabus.dart` | `SyllabusTopic` | Topic-level completion. |
| `timetable.dart` | `TimetablePeriod` | Schedule period. |
| `test_record.dart` | `TestRecord`, `ExamCategory` | UI/analytics test + cohort scores. |
| `test_record_model.dart` | `TestRecordModel` | Firestore score record. |
| `exam_schedule_model.dart` | `ExamScheduleModel`, `ExamCategories`, `MarksEntryStatus` | Canonical exam. |
| `class_result_matrix.dart` | `StudentMarkEntry`, `StudentResultRow`, `ClassResultMatrix` | Joined result DTOs. |
| `attendance_models.dart` | `AttendanceStatus`, `SessionType`, `DailyAttendanceRecord`, `MonthlyAttendanceSummary` | Granular daily/monthly. |
| `attendance_record_model.dart` | `AttendanceRecordModel`, `StudentAttendanceItem`, `AttendanceRecordStatus` | Firestore class/day batch. |
| `student_attendance_summary_model.dart` | `StudentAttendanceSummaryModel`, `AttendanceRiskTier`, `AttendanceMasterRecordModel` | Cumulative + master rows. |
| `staff_attendance_model.dart` | `StaffAttendanceRecord`, `StaffAttendanceStatus` | Staff daily. |
| `class_incharge_model.dart` | `ClassInchargeModel` | Attendance permission. |
| `rms_ticket.dart` | `RmsTicket`, `RmsCategory`, `RmsStatus` | Private tickets. |
| `announcement_model.dart` | `AnnouncementModel`, `ImportanceLevels`, `TargetAudiences` | Broadcasts. |
| `excel_cell_parser.dart` | `ExcelCellParser` | Safe cell parsing. |

### 5.1 Excel-specific models

| File | Classes |
| :--- | :--- |
| `models/excel_db/student_master_model.dart` | `StudentMasterModel` |
| `models/excel_db/attendance_master_model.dart` | `AttendanceMasterModel` |
| `models/excel_db/marks_master_model.dart` | `MarksMasterModel` |
| `models/excel_db/timetable_master_model.dart` | `TimetableMasterModel` |
| `models/excel_db/syllabus_master_model.dart` | `SyllabusMasterModel` |
| `models/excel_db/rms_record_model.dart` | `RmsRecordModel` |
| `models/excel_db/exam_schedule_model.dart` | Legacy `ExamScheduleModel` (conflict) |
| `models/excel_db/staff_access_model.dart` | `StaffAccessModel` |

### 5.2 Legacy duplicate models

`lib/models/` mirrors the above (older copies), including its own `ExamScheduleModel`. Tests import these. Delete after migration.

---

## 6. Services

| Service | File | Used by | Notes |
| :--- | :--- | :--- | :--- |
| `MockDatabase` | `core_shared/lib/services/mock_database.dart` | Everything | Global singleton DB/auth/scope/import engine. |
| `AttendanceService` | `core_shared/lib/services/attendance_service.dart` | Teacher attendance, admin summary | Best-effort Firestore + mock fallback. |
| `AssessmentService` | `core_shared/lib/services/assessment_service.dart` | Teacher marks | Exam stream/unlock/batch. |
| `AnnouncementService` | `core_shared/lib/services/announcement_service.dart` | Notices/admin announcements | Streams/mutations/fake push. |
| `AuthService` | `core_shared/lib/services/auth_service.dart` | Admin login | Static RBAC checks. |
| `ExcelMasterService` | `core_shared/lib/services/excel_master_service.dart` | Admin import/export | 14-sheet workbook. |
| `ExcelIngestionService` | `core_shared/lib/services/excel_ingestion_service.dart` | None | Legacy Firestore importer. |
| `AttendanceAggregationService` | `core_shared/lib/services/attendance_aggregation_service.dart` | Export only | Cumulative counters/rows. |
| `DatabaseService` | `core_shared/lib/services/database_service.dart` | None | Firestore queries/joins. |
| `ExcelDbService` | `core_shared/lib/services/excel_db_service.dart` | Tests/legacy controller | In-memory workbook CRUD. |
| `ExcelAttendanceService` | `core_shared/lib/services/excel_attendance_service.dart` | Tests | Daily/monthly workbook logic. |
| `AuthService` (legacy copy) | `lib/core/services/auth_service.dart` | Re-export | Same as canonical. |

---

## 7. Utilities and platform files

| File | Purpose |
| :--- | :--- |
| `core_shared/lib/utils/file_importer.dart` + `_web/_io/_stub` | Pick/read files cross-platform. |
| `core_shared/lib/utils/file_exporter.dart` + `_web/_io/_stub` | Save/download bytes/text. |
| `core_shared/lib/theme/app_colors.dart` | Teacher palette/tokens. |
| `core_shared/lib/theme/app_theme.dart` | Teacher Material theme. |
| `lib/features/admin/presentation/widgets/bento_theme.dart` | Admin palette/painters. |
| `firestore.rules` | Partial Firestore RBAC. |
| `firestore.indexes.json` | Query indexes. |
| `web/index.html`, `web/manifest.json` | Web shell (portrait-primary). |
| `pubspec.yaml` | Flutter deps: Firebase, Excel, file_picker, path_provider, share_plus, rxdart. |
| `core_shared/pubspec.yaml` | Shared package deps. |

---

## 8. Tests

| File | Target | Result |
| :--- | :--- | :--- |
| `test/all_files_smoke_test.dart` | Broad import/compile smoke | ❌ load failure (legacy compile errors) |
| `test/attendance_service_test.dart` | Excel attendance models/service | ✅ |
| `test/database_upgrade_test.dart` | Subject/incharge/staff/attendance/workbook | ✅ except staff controller test |
| `test/database_upgrade_next_test.dart` | Same with `core_shared` imports | ✅ except staff controller test |
| `test/database_upgrade_v2_test.dart` | Wrapper for next | ✅ except staff controller test |
| `test/excel_db_service_test.dart` | Legacy workbook CRUD | ❌ compile failure (exam model) |

---

## 9. Traceability rules for the rewrite

When porting a screen:

1. Find its row above.
2. Open the file and its controller/service.
3. Check the status and the corresponding use case.
4. Implement the **intent**, not the hardcoded demo values.
5. Add tests for the data/calculation, not just the widgets.
6. Mark the old file as migrated/deleted.

When porting a data rule:

1. Locate the formula in `MockDatabase`, `ExcelMasterService`, or a model.
2. Check [06 — Business Rules](06-business-rules.md).
3. Resolve any listed inconsistency before coding.
4. Add a unit test with boundary values.

When porting Excel:

1. Use [07 — Excel & Ingestion](07-excel-and-ingestion.md) as the schema reference.
2. Do not copy the current 8/9-sheet files as master.
3. Implement validation before commit.
