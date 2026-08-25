import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/rms_ticket.dart';
import '../../../core/models/student.dart';
import '../../../core/models/timetable.dart';
import '../../../core/models/syllabus.dart';
import '../../../core/models/test_record.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/file_exporter.dart';
import '../../../core/utils/file_importer.dart';
import '../../dashboard/presentation/dashboard_screen.dart';
import '../../attendance/presentation/attendance_screen.dart';
import '../../timetable/presentation/timetable_screen.dart';
import '../../marks/presentation/marks_screen.dart';
import '../../syllabus/presentation/syllabus_screen.dart';
import '../../reports/presentation/reports_screen.dart';
import '../../rms/presentation/rms_screen.dart';
import '../../../shared/widgets/aurora_background.dart';
import 'widgets/bento_theme.dart';

class AdminScreen extends StatefulWidget {
  final MockDatabase db;

  const AdminScreen({super.key, required this.db});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  // Navigation Index
  // 0: Dashboard Overview, 1: Multi-Excel Center, 2: Analytical Trends, 3: Leave Desk, 4: Maintenance Logs, 5: Secure Vault, 6: In-App Spreadsheet Editor, 7: Teacher Audit Viewer, 8: Executive PDF
  int _activeNavIndex = 0;
  String _impersonatedTeacher = 'Prof. Sarah Nawaz';
  int _simulatedScreenIndex = 0;

  // In-App Spreadsheet Grid Active Sheet (0: Students, 1: Marks, 2: Timetable, 3: Syllabus)
  int _gridActiveSheet = 0;

  // Inline edit state for Data Grid
  String? _editingRowId;
  final TextEditingController _editField1 = TextEditingController();
  final TextEditingController _editField2 = TextEditingController();
  final TextEditingController _editField3 = TextEditingController();
  final TextEditingController _editField4 = TextEditingController();

  // Excel Center Active Tab (0: Students, 1: Marks, 2: Timetable, 3: Syllabus, 4: RMS Archive)
  int _excelActiveTab = 0;

  // Vault Unlock State
  bool _isVaultUnlocked = false;
  final TextEditingController _vaultPinCtrl = TextEditingController();

  Future<void> _pickAndUploadSpreadsheet({String? specificType}) async {
    final picked = await FileImporter.pickAndReadFile();
    if (picked != null && picked.content.isNotEmpty) {
      final res = widget.db.parseAndIngestCsv(specificType ?? 'auto', picked.content);
      if (mounted) {
        _showIngestionResultDialog(context, res);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final students = widget.db.students;
        final faculty = widget.db.facultyList;
        final atRisk = widget.db.schoolWideAtRiskStudents;
        final rmsTickets = widget.db.rmsTickets;
        final leaveTickets = rmsTickets.where((t) => t.category == RmsCategory.staffLeave || t.category == RmsCategory.leaveRequest).toList();
        final maintenanceTickets = rmsTickets.where((t) => t.category == RmsCategory.maintenance || t.category == RmsCategory.facilityGearMalfunction).toList();
        final confidentialTickets = rmsTickets.where((t) => t.category == RmsCategory.confidential).toList();
        final pendingAlerts = rmsTickets.where((t) => t.status == RmsStatus.pending).length;

        return Container(
          color: BentoTheme.background,
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. LEFT SAAS SIDEBAR
                _buildSaaSSidebar(pendingAlerts, leaveTickets.length, maintenanceTickets.length, confidentialTickets.length),

                // 2. MAIN CONTENT AREA
                Expanded(
                  child: Column(
                    children: [
                      // TOP NAV BAR & SEARCH
                      _buildTopNavBar(pendingAlerts),

                      // TOP DATA ACTION RIOT (Persistent Quick Template & Upload Bar)
                      _buildTopDataActionRiot(),

                      // MAIN VIEW CANVAS
                      Expanded(
                        child: _buildActiveView(
                          students,
                          faculty,
                          atRisk,
                          rmsTickets,
                          leaveTickets,
                          maintenanceTickets,
                          confidentialTickets,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // 1. LEFT NAVIGATION DRAWER
  // ---------------------------------------------------------------------------
  Widget _buildSaaSSidebar(int alertCount, int leaveCount, int maintenanceCount, int vaultCount) {
    return Container(
      width: 235,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Logo & Brand Header
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: BentoTheme.forestGreen,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: Icon(Icons.school_rounded, color: BentoTheme.mintAccent, size: 22),
                ),
              ),
              const SizedBox(width: 10),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Nawaz SMS',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: BentoTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'Windows Command Node',
                    style: TextStyle(fontSize: 10, color: BentoTheme.textSecondary, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Menu List
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                // CORE SECTION
                const Text(
                  'CORE MODULES',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: BentoTheme.textTertiary, letterSpacing: 0.8),
                ),
                const SizedBox(height: 6),
                _buildSidebarItem(0, Icons.grid_view_rounded, 'Dashboard Overview'),
                _buildSidebarItem(1, Icons.folder_zip_rounded, 'Multi-Excel Center', badge: '4-XLSX'),
                _buildSidebarItem(2, Icons.analytics_rounded, 'Analytical Trends'),
                const SizedBox(height: 14),

                // RMS FEED HUB
                const Text(
                  'RMS FEED HUB',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: BentoTheme.textTertiary, letterSpacing: 0.8),
                ),
                const SizedBox(height: 6),
                _buildSidebarItem(3, Icons.event_busy_rounded, 'Leave Desk', alertBadge: leaveCount),
                _buildSidebarItem(4, Icons.build_rounded, 'Maintenance Logs', alertBadge: maintenanceCount),
                _buildSidebarItem(5, Icons.lock_rounded, 'Principal Vault', alertBadge: vaultCount),
                const SizedBox(height: 14),

                // UTILITIES SECTION
                const Text(
                  'IN-APP EDITORS & AUDIT',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: BentoTheme.textTertiary, letterSpacing: 0.8),
                ),
                const SizedBox(height: 6),
                _buildSidebarItem(6, Icons.edit_calendar_rounded, 'In-App Spreadsheet Grid', badge: 'LIVE'),
                _buildSidebarItem(7, Icons.phone_android_rounded, 'Teacher Audit Viewer'),
                _buildSidebarItem(8, Icons.picture_as_pdf_outlined, 'Executive PDF'),
                _buildSidebarActionItem(
                  icon: Icons.logout_rounded,
                  label: 'Teacher Mobile App',
                  onTap: () => widget.db.setRole(UserRole.teacher),
                ),
              ],
            ),
          ),

          // Bottom Mobile Sync Launcher
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F3A24), Color(0xFF082215)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.phone_iphone_rounded, color: BentoTheme.mintAccent, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Teacher Mobile App',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Scope-Locked RLS Node',
                  style: TextStyle(color: Colors.white60, fontSize: 10),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => widget.db.setRole(UserRole.teacher),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BentoTheme.forestGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Launch Teacher View', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(int index, IconData icon, String label, {String? badge, int? alertBadge}) {
    final isSelected = _activeNavIndex == index;
    return Container(
      margin: const EdgeInsets.only(bottom: 3),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => setState(() => _activeNavIndex = index),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected ? BentoTheme.mintLight : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 17,
                  color: isSelected ? BentoTheme.forestGreen : BentoTheme.textSecondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected ? BentoTheme.forestGreen : BentoTheme.textPrimary,
                    ),
                  ),
                ),
                if (badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F3A24),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ),
                if (alertBadge != null && alertBadge > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: BentoTheme.alertRed,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '$alertBadge',
                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSidebarActionItem({required IconData icon, required String label, required VoidCallback onTap}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 3),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Icon(icon, size: 17, color: BentoTheme.textSecondary),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: BentoTheme.textPrimary),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 2. TOP SAAS NAVBAR (Search, Notifications, Profile)
  // ---------------------------------------------------------------------------
  Widget _buildTopNavBar(int alertCount) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Search Pill
          Container(
            width: 320,
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: BentoTheme.surfaceSubtle,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: BentoTheme.borderSubtle),
            ),
            child: const Row(
              children: [
                Icon(Icons.search_rounded, size: 16, color: BentoTheme.textSecondary),
                SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search student, marks, period, syllabus...',
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    style: TextStyle(fontSize: 11),
                  ),
                ),
                Text('⌘F', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: BentoTheme.textTertiary)),
              ],
            ),
          ),

          // Right Icons & Profile
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: BentoTheme.surfaceSubtle,
                  shape: BoxShape.circle,
                  border: Border.all(color: BentoTheme.borderSubtle),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Icon(Icons.notifications_none_rounded, size: 17, color: BentoTheme.textSecondary),
                    if (alertCount > 0)
                      Positioned(
                        top: 7,
                        right: 7,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: BentoTheme.alertRed,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 14),

              // Profile Avatar
              Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFFD29D),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text('TN', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF7A4A12), fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.db.adminName,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: BentoTheme.textPrimary),
                      ),
                      Text(
                        widget.db.adminEmail,
                        style: const TextStyle(fontSize: 10, color: BentoTheme.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 3. TOP DATA ACTION RIOT (Fast Direct File Download Triggers)
  // ---------------------------------------------------------------------------
  Widget _buildTopDataActionRiot() {
    return Container(
      color: const Color(0xFFFAFBFD),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Row(
        children: [
          const Text(
            'DIRECT DOWNLOADS:',
            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: BentoTheme.textSecondary, letterSpacing: 0.5),
          ),
          const SizedBox(width: 10),
          _buildQuickTemplateChip('students_master.csv', () => _handleFileDownload('students_master.csv', widget.db.exportStudentsMaster())),
          const SizedBox(width: 6),
          _buildQuickTemplateChip('marks_master.csv', () => _handleFileDownload('marks_master.csv', widget.db.exportMarksMaster())),
          const SizedBox(width: 6),
          _buildQuickTemplateChip('timetable_master.csv', () => _handleFileDownload('timetable_master.csv', widget.db.exportTimetableMaster())),
          const SizedBox(width: 6),
          _buildQuickTemplateChip('syllabus_master.csv', () => _handleFileDownload('syllabus_master.csv', widget.db.exportSyllabusMaster())),
          const SizedBox(width: 6),
          _buildQuickTemplateChip('rms_records.csv', () => _handleFileDownload('rms_records.csv', widget.db.exportRmsRecords())),
          const Spacer(),

          // In-App Grid Edit Shortcut
          ElevatedButton.icon(
            onPressed: () => setState(() => _activeNavIndex = 6), // In-App Grid
            style: ElevatedButton.styleFrom(
              backgroundColor: BentoTheme.mintAccent,
              foregroundColor: BentoTheme.forestGreenDark,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.edit_note_rounded, size: 15),
            label: const Text('Edit In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 8),

          // Upload Master Trigger
          ElevatedButton.icon(
            onPressed: () => _pickAndUploadSpreadsheet(),
            style: ElevatedButton.styleFrom(
              backgroundColor: BentoTheme.forestGreen,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.upload_file_rounded, size: 13),
            label: const Text('Upload & Parse File', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickTemplateChip(String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: BentoTheme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.download_rounded, size: 12, color: BentoTheme.forestGreen),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: BentoTheme.textPrimary)),
          ],
        ),
      ),
    );
  }

  void _handleFileDownload(String fileName, String content) {
    // Triggers actual file download in browser or writes to C:\SchoolManagement\Exports\Spreadsheets on Desktop
    FileExporter.saveAndDownload(fileName, content);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: BentoTheme.forestGreen,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('📁 Downloaded: $fileName', style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            const Text(
              '• Web (Chrome): Saved to your browser "Downloads" folder.\n• Windows Desktop: Saved to C:\\SchoolManagement\\Exports\\Spreadsheets\\',
              style: TextStyle(fontSize: 11, height: 1.3),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'Preview Raw',
          textColor: BentoTheme.mintAccent,
          onPressed: () => _showRawDataPreviewDialog(context, fileName, content),
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  void _showRawDataPreviewDialog(BuildContext context, String fileName, String content) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Raw Content: $fileName', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close_rounded)),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('File Schema Structure (CSV / Excel format):', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                height: 200,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: BentoTheme.surfaceSubtle,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: BentoTheme.border),
                ),
                child: SingleChildScrollView(
                  child: Text(content, style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 4. ACTIVE VIEW ROUTER
  // ---------------------------------------------------------------------------
  Widget _buildActiveView(
    List<Student> students,
    List<TeacherAccount> faculty,
    List<Student> atRisk,
    List<RmsTicket> rmsTickets,
    List<RmsTicket> leaveTickets,
    List<RmsTicket> maintenanceTickets,
    List<RmsTicket> confidentialTickets,
  ) {
    switch (_activeNavIndex) {
      case 0:
        return _buildBentoDashboard(students, faculty, atRisk, rmsTickets);
      case 1:
        return _buildMultiExcelCenter();
      case 2:
        return _buildAnalyticalTrendsView();
      case 3:
        return _buildLeaveManagementDesk(leaveTickets);
      case 4:
        return _buildMaintenanceOperationsTracker(maintenanceTickets);
      case 5:
        return _buildPrincipalSecureVault(confidentialTickets);
      case 6:
        return _buildInAppSpreadsheetGridEditor(students);
      case 7:
        return _buildTeacherSystemImpersonationAuditTool();
      case 8:
        return _buildExecutiveProgressReportCompiler(students, atRisk);
      default:
        return _buildBentoDashboard(students, faculty, atRisk, rmsTickets);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. TAB 0: BENTO DASHBOARD OVERVIEW
  // ---------------------------------------------------------------------------
  Widget _buildBentoDashboard(
    List<Student> students,
    List<TeacherAccount> faculty,
    List<Student> atRisk,
    List<RmsTicket> rmsTickets,
  ) {
    final schoolAttendance = widget.db.schoolWideAttendanceRate;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dashboard Overview',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: BentoTheme.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Institutional command metrics, curriculum progress balance, and live risk radar.',
                    style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary),
                  ),
                ],
              ),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () => setState(() => _activeNavIndex = 6), // In-App Grid
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BentoTheme.mintAccent,
                      foregroundColor: BentoTheme.forestGreenDark,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.edit_calendar_rounded, size: 15),
                    label: const Text('Edit Spreadsheets In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    onPressed: () => setState(() => _activeNavIndex = 1),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BentoTheme.forestGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.folder_zip_rounded, size: 15),
                    label: const Text('Open 4-Excel Center', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),

          // 4 Bento Top Metric Cards
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: BentoTheme.forestGreen,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: BentoTheme.cardShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Students', style: TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Text('${students.length}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                        child: const Text('students_master.csv synced', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: _buildBentoStatCard('Active Faculty', '${faculty.length} Educators', '100% Assigned', BentoTheme.mintAccent, BentoTheme.mintLight),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: _buildBentoStatCard('Institution Attendance', '${schoolAttendance.toStringAsFixed(0)}%', 'Live Roll Call', BentoTheme.forestGreen, BentoTheme.mintLight),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: _buildBentoStatCard('At-Risk Students', '${atRisk.length} Flags', atRisk.isEmpty ? 'Optimal' : '<35% Score Alert', BentoTheme.alertRed, BentoTheme.alertRedBg),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Middle Grid
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Syllabus Completion Half Donut
              Expanded(
                flex: 3,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Syllabus Delivery Balance', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: BentoTheme.textPrimary)),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 110,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            CustomPaint(
                              size: const Size(180, 100),
                              painter: HalfDonutGaugePainter(completedPercent: 0.67, inProgressPercent: 0.20),
                            ),
                            const Positioned(
                              bottom: 6,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('67%', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary)),
                                  Text('Curriculum Covered', style: TextStyle(fontSize: 9, color: BentoTheme.textSecondary, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildLegendDot(BentoTheme.mintAccent, 'Completed'),
                          const SizedBox(width: 10),
                          _buildLegendDot(BentoTheme.forestGreen, 'In Progress'),
                          const SizedBox(width: 10),
                          _buildLegendDot(const Color(0xFFD1D5DB), 'Pending'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),

              // Academic Alerts Box
              Expanded(
                flex: 4,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.crisis_alert_rounded, color: BentoTheme.alertRed, size: 18),
                          SizedBox(width: 8),
                          Text('Academic Risk Alerts', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: BentoTheme.alertRed)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: BentoTheme.alertRedBg, borderRadius: BorderRadius.circular(14)),
                        child: const Row(
                          children: [
                            Text('🚨 ', style: TextStyle(fontSize: 16)),
                            Expanded(
                              child: Text(
                                'Grade 10-A Physics Average: 44% (Critical Baseline Failure <50%)',
                                style: TextStyle(fontWeight: FontWeight.w800, color: BentoTheme.alertRed, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${atRisk.length} individual students marked for remedial intervention via marks_master.csv calculations.',
                        style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBentoStatCard(String title, String val, String badge, Color badgeColor, Color badgeBg) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: BentoTheme.textSecondary, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(val, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(8)),
            child: Text(badge, style: TextStyle(color: badgeColor, fontSize: 9, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 6. TAB 1: MULTI-EXCEL CENTER (Download & Upload Master Terminal)
  // ---------------------------------------------------------------------------
  Widget _buildMultiExcelCenter() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          'Multi-Excel Ingestion & Extraction Terminal',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5),
        ),
        const SizedBox(height: 2),
        const Text(
          'Download templates, inspect live data, upload modified spreadsheets, or edit directly in-app.',
          style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary),
        ),
        const SizedBox(height: 14),

        // Location Information Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: BentoTheme.mintLight,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: BentoTheme.mintAccent.withOpacity(0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.folder_outlined, color: BentoTheme.forestGreen, size: 24),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Where are downloaded files saved?', style: TextStyle(fontWeight: FontWeight.w900, color: BentoTheme.forestGreen, fontSize: 13)),
                    SizedBox(height: 2),
                    Text(
                      '• On Web (Chrome): Saved to your browser "Downloads" folder.\n• On Windows Desktop: Saved to C:\\SchoolManagement\\Exports\\Spreadsheets\\\n• Upload below to update the cloud database and refresh teacher smartphone dashboards!',
                      style: TextStyle(fontSize: 11, color: BentoTheme.textPrimary, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Interactive Drag & Drop / File Browser Upload Box
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: BentoTheme.forestGreen.withOpacity(0.35), width: 1.5),
            boxShadow: BentoTheme.cardShadow,
          ),
          child: Column(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(
                  color: BentoTheme.mintLight,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.cloud_upload_rounded, color: BentoTheme.forestGreen, size: 28),
              ),
              const SizedBox(height: 12),
              const Text(
                'Upload Edited Spreadsheet File (.csv / .xlsx / .txt)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary),
              ),
              const SizedBox(height: 4),
              const Text(
                'Click "Choose File" to select any downloaded & edited file from your Downloads folder.\nAuto-detects students_master, marks_master, timetable_master, or syllabus_master.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary, height: 1.35),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _pickAndUploadSpreadsheet(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: BentoTheme.forestGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 2,
                    ),
                    icon: const Icon(Icons.file_open_rounded, size: 16),
                    label: const Text('Choose File from PC (Downloads)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton.icon(
                    onPressed: () => _showPasteCsvImportDialog(context, 'auto', 'student_id,name,phone_number,class,class_id_section\nSTU-10A-11,Bilal Khan,+92 300 1122334,Grade 10,10-A'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.paste_rounded, size: 16),
                    label: const Text('Or Paste Raw Text (CSV)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Spreadsheet Selector Tabs
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: BentoTheme.cardShadow,
          ),
          child: Row(
            children: [
              _buildExcelTabBtn(0, '1. students_master'),
              _buildExcelTabBtn(1, '2. marks_master'),
              _buildExcelTabBtn(2, '3. timetable_master'),
              _buildExcelTabBtn(3, '4. syllabus_master'),
              _buildExcelTabBtn(4, '5. rms_records'),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Active Spreadsheet Detail Card
        _buildExcelTabContent(),
      ],
    );
  }

  Widget _buildExcelTabBtn(int idx, String title) {
    final isSelected = _excelActiveTab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _excelActiveTab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? BentoTheme.forestGreen : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : BentoTheme.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExcelTabContent() {
    switch (_excelActiveTab) {
      case 0:
        return _buildStudentsMasterTab();
      case 1:
        return _buildMarksMasterTab();
      case 2:
        return _buildTimetableMasterTab();
      case 3:
        return _buildSyllabusMasterTab();
      case 4:
        return _buildRmsArchiveTab();
      default:
        return _buildStudentsMasterTab();
    }
  }

  Widget _buildStudentsMasterTab() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spreadsheet 1: Student Roster Infrastructure', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text('Fixed Layout: student_id | name | phone_number | class | class_id_section', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontFamily: 'monospace')),
                ],
              ),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _activeNavIndex = 6;
                        _gridActiveSheet = 0;
                      });
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.mintAccent, foregroundColor: BentoTheme.forestGreenDark),
                    icon: const Icon(Icons.edit_note_rounded, size: 15),
                    label: const Text('Edit Table In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _handleFileDownload('students_master.csv', widget.db.exportStudentsMaster()),
                    icon: const Icon(Icons.download_rounded, size: 14),
                    label: const Text('Download CSV', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Execution & Conflict Rules:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          const Text('• Row-by-row parse skipping index 0. If student_id exists -> UPDATE, else INSERT unique ID.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const Text('• Duplicate Guard: If student_id or name+class_id_section duplicates within a room block -> Abort transaction.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const SizedBox(height: 16),

          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadSpreadsheet(specificType: 'students_master'),
                style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                icon: const Icon(Icons.file_open_rounded, size: 15),
                label: const Text('Upload Edited File (.csv / .xlsx)'),
              ),
              OutlinedButton.icon(
                onPressed: () => _showPasteCsvImportDialog(context, 'students_master', 'student_id,name,phone_number,class,class_id_section\nSTU-10A-11,Bilal Khan,+92 300 1122334,Grade 10,10-A'),
                icon: const Icon(Icons.paste_rounded, size: 15),
                label: const Text('Paste Raw Text (CSV)'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  final res = widget.db.ingestStudentsMaster([
                    {'student_id': 'STU-10A-01', 'name': 'Zainab Ahmed', 'phone_number': '+92 300 1234567', 'class': 'Grade 10', 'class_id_section': '10-A'},
                    {'student_id': 'STU-10A-99', 'name': 'Zainab Ahmed', 'phone_number': '+92 300 1234567', 'class': 'Grade 10', 'class_id_section': '10-A'},
                  ]);
                  _showIngestionResultDialog(context, res);
                },
                style: OutlinedButton.styleFrom(foregroundColor: BentoTheme.alertRed),
                icon: const Icon(Icons.warning_amber_rounded, size: 15),
                label: const Text('Test Duplicate Guard Abort'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMarksMasterTab() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spreadsheet 2: Subject-Wise Test Marks Ledger', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text('Fixed Layout: test_id | marks_obtained | student_name | class_id_section | subject | max_marks', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontFamily: 'monospace')),
                ],
              ),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _activeNavIndex = 6;
                        _gridActiveSheet = 1;
                      });
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.mintAccent, foregroundColor: BentoTheme.forestGreenDark),
                    icon: const Icon(Icons.edit_note_rounded, size: 15),
                    label: const Text('Edit Table In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _handleFileDownload('marks_master.csv', widget.db.exportMarksMaster()),
                    icon: const Icon(Icons.download_rounded, size: 14),
                    label: const Text('Download CSV', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Execution & Analytical Recalculation:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          const Text('• Ingesting scores immediately recalculates subject-wise class mean (μ), grade distributions, and <35% risk flags.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const SizedBox(height: 16),

          Row(
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadSpreadsheet(specificType: 'marks_master'),
                style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                icon: const Icon(Icons.file_open_rounded, size: 15),
                label: const Text('Upload Edited Marks File (.csv / .xlsx)'),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: () => _showPasteCsvImportDialog(context, 'marks_master', 'test_id,marks_obtained,student_name,class_id_section,subject,max_marks\nTST-10A-01,48.0,Zainab Ahmed,10-A,Mathematics,50.0'),
                icon: const Icon(Icons.paste_rounded, size: 15),
                label: const Text('Paste Raw Text (CSV)'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimetableMasterTab() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spreadsheet 3: Master Schedule Timetable', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text('Fixed Layout: class_id_section | subject | teacher_id | day_of_week | start_time | end_time', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontFamily: 'monospace')),
                ],
              ),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _activeNavIndex = 6;
                        _gridActiveSheet = 2;
                      });
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.mintAccent, foregroundColor: BentoTheme.forestGreenDark),
                    icon: const Icon(Icons.edit_note_rounded, size: 15),
                    label: const Text('Edit Table In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _handleFileDownload('timetable_master.csv', widget.db.exportTimetableMaster()),
                    icon: const Icon(Icons.download_rounded, size: 14),
                    label: const Text('Download CSV', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Time Collision Guard:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          const Text('• Day of week: 1=Mon to 5=Fri. Timestamps in 24h format (HH:MM:SS).', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const Text('• Checks both teacher_id and class_id_section overlaps. Any collision instantly rejects upload.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const SizedBox(height: 16),

          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadSpreadsheet(specificType: 'timetable_master'),
                style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                icon: const Icon(Icons.file_open_rounded, size: 15),
                label: const Text('Upload Edited Timetable File (.csv / .xlsx)'),
              ),
              OutlinedButton.icon(
                onPressed: () => _showPasteCsvImportDialog(context, 'timetable_master', 'class_id_section,subject,teacher_id,day_of_week,start_time,end_time\n10-A,Mathematics,tch_sarah_01,1,08:30:00,09:15:00'),
                icon: const Icon(Icons.paste_rounded, size: 15),
                label: const Text('Paste Raw Text (CSV)'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  final res = widget.db.ingestTimetableMaster([
                    {'class_id_section': '10-A', 'subject': 'Mathematics', 'teacher_id': 'tch_sarah_01', 'day_of_week': '1', 'start_time': '08:30:00', 'end_time': '09:15:00'},
                    {'class_id_section': '9-A', 'subject': 'Biology', 'teacher_id': 'tch_sarah_01', 'day_of_week': '1', 'start_time': '08:30:00', 'end_time': '09:15:00'},
                  ]);
                  _showIngestionResultDialog(context, res);
                },
                style: OutlinedButton.styleFrom(foregroundColor: BentoTheme.alertRed),
                icon: const Icon(Icons.warning_amber_rounded, size: 15),
                label: const Text('Test Collision Guard Abort'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSyllabusMasterTab() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spreadsheet 4: Institutional Syllabus Tracker', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text('Fixed Layout: syllabus_item_id | class_id_section | subject | chapter_number | topic_title | completion_status', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontFamily: 'monospace')),
                ],
              ),
              Row(
                children: [
                  ElevatedButton.icon(
                    onPressed: () {
                      setState(() {
                        _activeNavIndex = 6;
                        _gridActiveSheet = 3;
                      });
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.mintAccent, foregroundColor: BentoTheme.forestGreenDark),
                    icon: const Icon(Icons.edit_note_rounded, size: 15),
                    label: const Text('Edit Table In-App', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _handleFileDownload('syllabus_master.csv', widget.db.exportSyllabusMaster()),
                    icon: const Icon(Icons.download_rounded, size: 14),
                    label: const Text('Download CSV', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Live Mobile Pacing Sync:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          const Text('• Populates master roadmap. When teachers toggle topics on mobile, completion_status updates to TRUE.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
          const SizedBox(height: 16),

          Row(
            children: [
              ElevatedButton.icon(
                onPressed: () => _pickAndUploadSpreadsheet(specificType: 'syllabus_master'),
                style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                icon: const Icon(Icons.file_open_rounded, size: 15),
                label: const Text('Upload Edited Syllabus File (.csv / .xlsx)'),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: () => _showPasteCsvImportDialog(context, 'syllabus_master', 'syllabus_item_id,class_id_section,subject,chapter_number,topic_title,completion_status\nSYL-10A-M05,10-A,Mathematics,3,Linear Inequalities,FALSE'),
                icon: const Icon(Icons.paste_rounded, size: 15),
                label: const Text('Paste Raw Text (CSV)'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRmsArchiveTab() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Spreadsheet 5: RMS Archival Export Log', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  Text('Fixed Layout: note_id | timestamp | teacher_name | classification_tag | message_body | admin_resolution_status', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontFamily: 'monospace')),
                ],
              ),
              OutlinedButton.icon(
                onPressed: () => _handleFileDownload('rms_records.csv', widget.db.exportRmsRecords()),
                icon: const Icon(Icons.download_rounded, size: 14),
                label: const Text('Download RMS Log CSV', style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
          const Divider(height: 24),
          const Text('Accountability & Compliance Archive:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          const Text('• Maintains an unalterable audit trail of staff requests, maintenance tickets, and principal resolution statuses.', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
        ],
      ),
    );
  }

  void _showPasteCsvImportDialog(BuildContext context, String spreadsheetType, String sampleTemplate) {
    final csvCtrl = TextEditingController(text: sampleTemplate);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text('Paste & Ingest: $spreadsheetType', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Paste raw comma-separated values (CSV) directly from Excel or Google Sheets:', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
              const SizedBox(height: 10),
              TextField(
                controller: csvCtrl,
                maxLines: 8,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: BentoTheme.surfaceSubtle,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: BentoTheme.border)),
                  hintText: 'Paste CSV rows here...',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              final res = widget.db.parseAndIngestCsv(spreadsheetType, csvCtrl.text);
              _showIngestionResultDialog(context, res);
            },
            style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
            icon: const Icon(Icons.check_circle_rounded, size: 16),
            label: const Text('Parse & Ingest to Cloud'),
          ),
        ],
      ),
    );
  }

  void _showIngestionResultDialog(BuildContext context, IngestionResult res) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Row(
          children: [
            Icon(
              res.isSuccess ? Icons.check_circle_rounded : Icons.error_outline_rounded,
              color: res.isSuccess ? BentoTheme.mintAccent : BentoTheme.alertRed,
            ),
            const SizedBox(width: 8),
            Text(res.isSuccess ? 'Transaction Committed' : 'Upload Aborted', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
        content: Text(res.message, style: const TextStyle(fontSize: 13, height: 1.4)),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: res.isSuccess ? BentoTheme.forestGreen : BentoTheme.alertRed),
            child: const Text('Dismiss'),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 7. TAB 2: ANALYTICAL TRENDS & FORMAL EXAMINATION MANAGEMENT
  // ---------------------------------------------------------------------------
  Widget _buildAnalyticalTrendsView() {
    final atRisk = widget.db.schoolWideAtRiskStudents;
    final principalExams = widget.db.principalMandatedExams;

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Subject Analytics & Formal Examination Management', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
                SizedBox(height: 2),
                Text('Principal Portal: Setup Mid-Term / End-Term Exams & inspect automated class averages (μ).', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
              ],
            ),
            ElevatedButton.icon(
              onPressed: () => _showSetupInstitutionalExamDialog(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: BentoTheme.forestGreen,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.add_task_rounded, size: 16),
              label: const Text('+ Setup Formal Exam (Mid / End Term)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Active Institutional Exams List
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('FORMAL INSTITUTIONAL EXAMINATIONS (PRINCIPAL MANDATED)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: BentoTheme.forestGreen)),
                  Text('Dispatched to Assigned Subject Teachers', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                ],
              ),
              const Divider(height: 20),
              if (principalExams.isEmpty)
                const Text('No formal exams scheduled yet.')
              else
                ...principalExams.map((exam) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: BentoTheme.surfaceSubtle,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: BentoTheme.border),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: const BoxDecoration(color: BentoTheme.mintLight, shape: BoxShape.circle),
                          child: const Icon(Icons.school_rounded, color: BentoTheme.forestGreen, size: 20),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(exam.title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: BentoTheme.textPrimary)),
                              const SizedBox(height: 2),
                              Text('${exam.subject} • ${exam.className} • Weightage: ${exam.weightagePercent.toInt()}% • Max: ${exam.maxMarks.toInt()} Marks', style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Class Mean: ${exam.classAveragePercentage.toStringAsFixed(0)}%', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: BentoTheme.forestGreen)),
                            Text('${exam.passCount} Passed • ${exam.failCount} Failing', style: const TextStyle(fontSize: 10, color: BentoTheme.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
        const SizedBox(height: 20),

        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('ANALYTICS: CLASS 10-A MATHEMATICS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                  Text('Updated via marks_master.csv', style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                ],
              ),
              const SizedBox(height: 14),
              const Text('Class Mean (μ): 74% / Passing Benchmark', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: BentoTheme.forestGreen)),
              const SizedBox(height: 16),

              const Text('Grade Cohort Distribution:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 10),
              _buildGradeSpreadRow('A Grade (>85%)', '8 Students', BentoTheme.forestGreen),
              const SizedBox(height: 6),
              _buildGradeSpreadRow('B Grade (50-84%)', '22 Students', BentoTheme.mintAccent),
              const SizedBox(height: 6),
              _buildGradeSpreadRow('Failing (<35%)', '${atRisk.length} Students (Critical Alert)', BentoTheme.alertRed),
              const SizedBox(height: 20),

              const Text('Historical Assessment Timeline:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: BentoTheme.surfaceSubtle, borderRadius: BorderRadius.circular(16)),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Text('Quiz 1: 62%', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                    Icon(Icons.arrow_forward_rounded, size: 14, color: BentoTheme.textTertiary),
                    Text('Quiz 2: 78%', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                    Icon(Icons.arrow_forward_rounded, size: 14, color: BentoTheme.textTertiary),
                    Text('Mid-Term: 74%', style: TextStyle(fontWeight: FontWeight.w800, color: BentoTheme.forestGreen, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showSetupInstitutionalExamDialog(BuildContext context) {
    final titleCtrl = TextEditingController(text: 'Mid-Term Examination 2026');
    final marksCtrl = TextEditingController(text: '100');
    final weightCtrl = TextEditingController(text: '30');
    ExamCategory selectedCategory = ExamCategory.midTerm;
    String selectedClass = 'Class 10-A';
    String selectedSubject = 'Mathematics';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: const Row(
                children: [
                  Icon(Icons.account_balance_rounded, color: BentoTheme.forestGreen, size: 22),
                  SizedBox(width: 8),
                  Text('Setup Formal Institutional Exam', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                ],
              ),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Principal Authority: Schedules school-wide Mid-Term and Final exams.',
                      style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary),
                    ),
                    const SizedBox(height: 14),

                    DropdownButtonFormField<ExamCategory>(
                      value: selectedCategory,
                      decoration: const InputDecoration(labelText: 'Examination Session'),
                      items: const [
                        DropdownMenuItem(value: ExamCategory.midTerm, child: Text('Mid-Term Formal Examination')),
                        DropdownMenuItem(value: ExamCategory.endTerm, child: Text('Annual Final / End-Term Examination')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            selectedCategory = val;
                            titleCtrl.text = val == ExamCategory.midTerm
                                ? 'Mid-Term Examination 2026'
                                : 'Annual Final Examination 2026';
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 10),

                    DropdownButtonFormField<String>(
                      value: selectedClass,
                      decoration: const InputDecoration(labelText: 'Target Class Cohort'),
                      items: const [
                        DropdownMenuItem(value: 'Class 10-A', child: Text('Class 10-A')),
                        DropdownMenuItem(value: 'Class 9-A', child: Text('Class 9-A')),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedClass = val);
                      },
                    ),
                    const SizedBox(height: 10),

                    DropdownButtonFormField<String>(
                      value: selectedSubject,
                      decoration: const InputDecoration(labelText: 'Subject'),
                      items: const [
                        DropdownMenuItem(value: 'Mathematics', child: Text('Mathematics')),
                        DropdownMenuItem(value: 'Physics', child: Text('Physics')),
                        DropdownMenuItem(value: 'General Science', child: Text('General Science')),
                      ],
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedSubject = val);
                      },
                    ),
                    const SizedBox(height: 10),

                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(labelText: 'Official Examination Title'),
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: marksCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Total Marks (e.g. 100)'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: weightCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Weightage % (e.g. 30%)'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton.icon(
                  onPressed: () {
                    if (titleCtrl.text.isNotEmpty) {
                      final max = double.tryParse(marksCtrl.text) ?? 100.0;
                      final weight = double.tryParse(weightCtrl.text) ?? 30.0;
                      widget.db.createPrincipalExamination(
                        title: titleCtrl.text,
                        targetClass: selectedClass,
                        subject: selectedSubject,
                        maxMarks: max,
                        examCategory: selectedCategory,
                        date: DateTime.now().add(const Duration(days: 14)),
                        weightage: weight,
                      );
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: BentoTheme.forestGreen,
                          content: Text('Published ${titleCtrl.text} institution-wide! Dispatched to assigned teachers.'),
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                  icon: const Icon(Icons.send_rounded, size: 16),
                  label: const Text('Publish Institutional Exam'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildGradeSpreadRow(String label, String count, Color color) {
    return Row(
      children: [
        SizedBox(width: 140, child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600))),
        Expanded(
          child: Container(
            height: 16,
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
          ),
        ),
        const SizedBox(width: 12),
        Text(count, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // 8. TAB 3: STAFF LEAVE MANAGEMENT
  // ---------------------------------------------------------------------------
  Widget _buildLeaveManagementDesk(List<RmsTicket> leaveTickets) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Staff Leave Operations Desk', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
        const SizedBox(height: 2),
        const Text('Automated keyword routing engine parsed incoming requests: "leave", "sick", "absent", "medical".', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
        const SizedBox(height: 20),

        if (leaveTickets.isEmpty)
          const Text('No pending leave requests.')
        else
          ...leaveTickets.map((t) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(t.noteId, style: const TextStyle(fontWeight: FontWeight.w900, color: BentoTheme.forestGreen, fontSize: 12, fontFamily: 'monospace')),
                      Text('From: ${t.teacherName} (${t.teacherEmail})', style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(t.subject, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  Text(t.messageBody, style: const TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: () => widget.db.updateRmsTicketStatus(t.id, RmsStatus.approved, 'Approved by Principal.'),
                        style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                        child: const Text('Approve Leave', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => widget.db.updateRmsTicketStatus(t.id, RmsStatus.rejected, 'Declined due to exams schedule.'),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                        child: const Text('Reject', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // 9. TAB 4: FACILITY MAINTENANCE LOGS
  // ---------------------------------------------------------------------------
  Widget _buildMaintenanceOperationsTracker(List<RmsTicket> maintenanceTickets) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text('Facility Maintenance & Repair Logs', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
        const SizedBox(height: 2),
        const Text('Keywords: "broken", "projector", "repair", "AC", "light". Automatically bound to teacher active room.', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
        const SizedBox(height: 20),

        if (maintenanceTickets.isEmpty)
          const Text('No maintenance issues logged.')
        else
          ...maintenanceTickets.map((t) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: BentoTheme.alertOrangeBg, borderRadius: BorderRadius.circular(8)),
                        child: Text(t.roomNumber != null ? '[${t.roomNumber}: Gear Malfunction]' : '[Maintenance]', style: const TextStyle(fontWeight: FontWeight.w900, color: BentoTheme.alertOrange, fontSize: 11)),
                      ),
                      Text('Reported by: ${t.teacherName}', style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(t.subject, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  Text(t.messageBody, style: const TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: () => widget.db.updateRmsTicketStatus(t.id, RmsStatus.resolved, 'Repairs verified by Admin.'),
                        style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                        child: const Text('Mark Resolved', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => widget.db.updateRmsTicketStatus(t.id, RmsStatus.underReview, 'Assigned to Facility Engineer.'),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                        child: const Text('Assign Work Order', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // 10. TAB 5: PRINCIPAL SECURE VAULT
  // ---------------------------------------------------------------------------
  Widget _buildPrincipalSecureVault(List<RmsTicket> confidentialTickets) {
    if (!_isVaultUnlocked) {
      return Center(
        child: Container(
          width: 380,
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: BentoTheme.cardShadow),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(color: BentoTheme.mintLight, shape: BoxShape.circle),
                child: const Icon(Icons.lock_rounded, color: BentoTheme.forestGreen, size: 36),
              ),
              const SizedBox(height: 16),
              const Text('Principal Secure Vault', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              const Text('High-security channel for confidential and sensitive staff communications.', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
              const SizedBox(height: 20),
              TextField(
                controller: _vaultPinCtrl,
                obscureText: true,
                decoration: InputDecoration(
                  hintText: 'Enter Principal PIN (e.g. 1234)',
                  filled: true,
                  fillColor: BentoTheme.surfaceSubtle,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: BentoTheme.border)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => setState(() => _isVaultUnlocked = true),
                  style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                  child: const Text('Unlock Secure Vault', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Principal Secure Vault (Unlocked)', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
                Text('Confidential entries bypassing shared office boards.', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
              ],
            ),
            OutlinedButton.icon(
              onPressed: () => setState(() => _isVaultUnlocked = false),
              icon: const Icon(Icons.lock_outline_rounded, size: 14),
              label: const Text('Lock Vault'),
            ),
          ],
        ),
        const SizedBox(height: 20),

        if (confidentialTickets.isEmpty)
          const Text('No confidential records logged.')
        else
          ...confidentialTickets.map((t) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('[CONFIDENTIAL STAFF NOTE]', style: TextStyle(fontWeight: FontWeight.w900, color: BentoTheme.alertRed, fontSize: 11)),
                      Text('From: ${t.teacherName}', style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(t.subject, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  Text(t.messageBody, style: const TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
                ],
              ),
            );
          }),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // 11. TAB 6: IN-APP SPREADSHEET GRID EDITOR (Direct Edit for All 4 Excels)
  // ---------------------------------------------------------------------------
  Widget _buildInAppSpreadsheetGridEditor(List<Student> students) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('In-App Live Spreadsheet Grid Editor', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
                SizedBox(height: 2),
                Text('Edit, add, or delete records directly in the app. Updates sync automatically to teacher smartphones.', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
              ],
            ),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: () => _showAddRecordDialog(context),
                  style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text('+ Add Row'),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Sheet Selector Capsules
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: BentoTheme.cardShadow),
          child: Row(
            children: [
              _buildGridSheetBtn(0, '1. Students Roster (${students.length})'),
              _buildGridSheetBtn(1, '2. Marks Ledger (${widget.db.testRecords.length})'),
              _buildGridSheetBtn(2, '3. Master Timetable (${widget.db.timetable.length})'),
              _buildGridSheetBtn(3, '4. Syllabus Topics (${widget.db.syllabus.length})'),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Active Sheet Editor
        _buildActiveGridSheet(students),
      ],
    );
  }

  Widget _buildGridSheetBtn(int idx, String title) {
    final isSelected = _gridActiveSheet == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _gridActiveSheet = idx;
          _editingRowId = null;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSelected ? BentoTheme.forestGreen : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              title,
              style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600, color: isSelected ? Colors.white : BentoTheme.textSecondary),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActiveGridSheet(List<Student> students) {
    switch (_gridActiveSheet) {
      case 0:
        return _buildStudentsGrid(students);
      case 1:
        return _buildMarksGrid(widget.db.testRecords);
      case 2:
        return _buildTimetableGrid(widget.db.timetable);
      case 3:
        return _buildSyllabusGrid(widget.db.syllabus);
      default:
        return _buildStudentsGrid(students);
    }
  }

  Widget _buildStudentsGrid(List<Student> students) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(BentoTheme.surfaceSubtle),
          columns: const [
            DataColumn(label: Text('Student ID', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Roll No', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Name', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Class Section', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Parent Phone', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Action', style: TextStyle(fontWeight: FontWeight.w800))),
          ],
          rows: students.map((s) {
            final isEditing = _editingRowId == s.id;
            return DataRow(
              cells: [
                DataCell(Text(s.studentId, style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace'))),
                DataCell(Text(s.rollNumber)),
                DataCell(
                  isEditing
                      ? TextField(controller: _editField1, decoration: const InputDecoration(isDense: true))
                      : Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                DataCell(
                  isEditing
                      ? TextField(controller: _editField2, decoration: const InputDecoration(isDense: true))
                      : Text(s.classIdSection),
                ),
                DataCell(
                  isEditing
                      ? TextField(controller: _editField3, decoration: const InputDecoration(isDense: true))
                      : Text(s.parentPhone),
                ),
                DataCell(
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isEditing) ...[
                        ElevatedButton(
                          onPressed: () {
                            setState(() => _editingRowId = null);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(backgroundColor: BentoTheme.forestGreen, content: Text('Saved student changes! Synced to Cloud.')),
                            );
                          },
                          style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.mintAccent, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                          child: const Text('Save', style: TextStyle(fontSize: 10, color: BentoTheme.forestGreenDark, fontWeight: FontWeight.w900)),
                        ),
                      ] else ...[
                        OutlinedButton(
                          onPressed: () {
                            setState(() {
                              _editingRowId = s.id;
                              _editField1.text = s.name;
                              _editField2.text = s.classIdSection;
                              _editField3.text = s.parentPhone;
                            });
                          },
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                          child: const Text('Edit', style: TextStyle(fontSize: 10)),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, size: 16, color: BentoTheme.alertRed),
                          onPressed: () => widget.db.deleteStudent(s.id),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildMarksGrid(List<TestRecord> tests) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(BentoTheme.surfaceSubtle),
          columns: const [
            DataColumn(label: Text('Test ID', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Student Name', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Class Section', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Subject', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Marks Obtained', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Max Marks', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Action', style: TextStyle(fontWeight: FontWeight.w800))),
          ],
          rows: tests.map((t) {
            return DataRow(
              cells: [
                DataCell(Text(t.testId, style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace'))),
                DataCell(Text(t.studentName)),
                DataCell(Text(t.classIdSection)),
                DataCell(Text(t.subject)),
                DataCell(Text('${t.marksObtained}')),
                DataCell(Text('${t.maxMarks}')),
                DataCell(
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, size: 16, color: BentoTheme.alertRed),
                    onPressed: () => widget.db.deleteTestRecord(t.id),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTimetableGrid(List<TimetablePeriod> periods) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(BentoTheme.surfaceSubtle),
          columns: const [
            DataColumn(label: Text('Class Section', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Subject', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Teacher ID', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Day (1-5)', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Start Time', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('End Time', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Room', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Action', style: TextStyle(fontWeight: FontWeight.w800))),
          ],
          rows: periods.map((p) {
            return DataRow(
              cells: [
                DataCell(Text(p.classIdSection, style: const TextStyle(fontWeight: FontWeight.w700))),
                DataCell(Text(p.subject)),
                DataCell(Text(p.teacherId)),
                DataCell(Text('${p.dayOfWeekInt} (${p.dayOfWeek})')),
                DataCell(Text(p.startTime24)),
                DataCell(Text(p.endTime24)),
                DataCell(Text(p.room)),
                DataCell(
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, size: 16, color: BentoTheme.alertRed),
                    onPressed: () => widget.db.deleteTimetablePeriod(p.id),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSyllabusGrid(List<SyllabusTopic> topics) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(BentoTheme.surfaceSubtle),
          columns: const [
            DataColumn(label: Text('Syllabus ID', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Class Section', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Subject', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Chapter No', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Topic Title', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Completed?', style: TextStyle(fontWeight: FontWeight.w800))),
            DataColumn(label: Text('Action', style: TextStyle(fontWeight: FontWeight.w800))),
          ],
          rows: topics.map((t) {
            return DataRow(
              cells: [
                DataCell(Text(t.syllabusItemId, style: const TextStyle(fontWeight: FontWeight.w700, fontFamily: 'monospace'))),
                DataCell(Text(t.classIdSection)),
                DataCell(Text(t.subject)),
                DataCell(Text('${t.chapterNumber}')),
                DataCell(Text(t.topicTitle, style: const TextStyle(fontWeight: FontWeight.w700))),
                DataCell(
                  Switch(
                    value: t.completionStatus,
                    activeColor: BentoTheme.mintAccent,
                    onChanged: (_) => widget.db.toggleSyllabusTopic(t.id),
                  ),
                ),
                DataCell(
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, size: 16, color: BentoTheme.alertRed),
                    onPressed: () => widget.db.deleteSyllabusTopic(t.id),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showAddRecordDialog(BuildContext context) {
    final nameCtrl = TextEditingController();
    final classCtrl = TextEditingController(text: '10-A');
    final phoneCtrl = TextEditingController(text: '+92 300 ');
    final subjectCtrl = TextEditingController(text: 'Mathematics');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text('Add New Entry to ${_gridActiveSheet == 0 ? "Student Roster" : _gridActiveSheet == 1 ? "Marks Ledger" : _gridActiveSheet == 2 ? "Timetable" : "Syllabus"}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: InputDecoration(labelText: _gridActiveSheet == 0 ? 'Student Name' : _gridActiveSheet == 1 ? 'Student Name' : _gridActiveSheet == 2 ? 'Subject' : 'Topic Title')),
            const SizedBox(height: 10),
            TextField(controller: classCtrl, decoration: const InputDecoration(labelText: 'Class Section (e.g. 10-A)')),
            const SizedBox(height: 10),
            if (_gridActiveSheet == 0)
              TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Parent Phone')),
            if (_gridActiveSheet == 1 || _gridActiveSheet == 2 || _gridActiveSheet == 3)
              TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (_gridActiveSheet == 0 && nameCtrl.text.isNotEmpty) {
                widget.db.addNewStudent(name: nameCtrl.text, classIdSection: classCtrl.text, phone: phoneCtrl.text);
              } else if (_gridActiveSheet == 1 && nameCtrl.text.isNotEmpty) {
                widget.db.addNewTestRecord(studentName: nameCtrl.text, classIdSection: classCtrl.text, subject: subjectCtrl.text, marksObtained: 40.0);
              } else if (_gridActiveSheet == 2 && nameCtrl.text.isNotEmpty) {
                widget.db.addNewTimetablePeriod(classIdSection: classCtrl.text, subject: nameCtrl.text, teacherId: 'tch_sarah_01', dayOfWeekInt: 1, startTime24: '11:30:00', endTime24: '12:15:00', room: 'Room 205');
              } else if (_gridActiveSheet == 3 && nameCtrl.text.isNotEmpty) {
                widget.db.addNewSyllabusTopic(classIdSection: classCtrl.text, subject: subjectCtrl.text, chapterNumber: 3, topicTitle: nameCtrl.text);
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen),
            child: const Text('Commit Row'),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 12. TAB 7: TEACHER AUDIT WIREFRAME VIEWER
  // ---------------------------------------------------------------------------
  Widget _buildTeacherSystemImpersonationAuditTool() {
    final faculty = widget.db.facultyList;
    final selectedFaculty = faculty.firstWhere(
      (f) => f.name == _impersonatedTeacher,
      orElse: () => faculty.first,
    );

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Teacher System Impersonation (Audit Tool)', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
                SizedBox(height: 2),
                Text('Interactive smartphone wireframe simulator rendering exact live mobile state for remote troubleshooting.', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: BentoTheme.mintLight, borderRadius: BorderRadius.circular(16), border: Border.all(color: BentoTheme.mintAccent.withOpacity(0.4))),
              child: const Row(
                children: [
                  Icon(Icons.sensors_rounded, color: BentoTheme.forestGreen, size: 16),
                  SizedBox(width: 6),
                  Text('Live Audit Tunnel Active', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: BentoTheme.forestGreen)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Console
            Expanded(
              flex: 5,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Select Target Educator to Impersonate', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          value: faculty.any((f) => f.name == _impersonatedTeacher) ? _impersonatedTeacher : faculty.first.name,
                          decoration: InputDecoration(
                            isDense: true,
                            filled: true,
                            fillColor: BentoTheme.surfaceSubtle,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: BentoTheme.border)),
                          ),
                          items: faculty.map((f) => DropdownMenuItem(value: f.name, child: Text('${f.name} (${f.department})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _impersonatedTeacher = val);
                          },
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: BentoTheme.forestGreen, content: Text('Synchronized viewport for $_impersonatedTeacher')));
                            },
                            style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                            icon: const Icon(Icons.sync_rounded, size: 16),
                            label: const Text('Audit Profile View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Telemetry Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Session Telemetry & Metadata', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        const Divider(height: 18),
                        _buildTelemetryRow('Teacher UUID', 'usr_${selectedFaculty.name.hashCode.abs().toRadixString(16).padLeft(8, '0')}'),
                        _buildTelemetryRow('Assigned Classes', selectedFaculty.assignedClasses.join(', ')),
                        _buildTelemetryRow('Client Device', 'Google Pixel 8 Pro • Android 14'),
                        _buildTelemetryRow('Realtime Latency', '18ms (WebSocket Channel)'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Screen Switcher
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: BentoTheme.cardShadow),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Remote Screen Selector', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildSimScreenChip(0, 'Dashboard / Home', Icons.dashboard_rounded),
                            _buildSimScreenChip(1, 'Roll Call', Icons.checklist_rtl_rounded),
                            _buildSimScreenChip(2, 'Timetable', Icons.calendar_month_rounded),
                            _buildSimScreenChip(3, 'Marks', Icons.analytics_rounded),
                            _buildSimScreenChip(4, 'Syllabus', Icons.description_rounded),
                            _buildSimScreenChip(6, 'RMS Desk', Icons.shield_rounded),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 24),

            // Right Phone Chassis
            Expanded(
              flex: 6,
              child: Center(
                child: Container(
                  width: 350,
                  height: 660,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B0F19),
                    borderRadius: BorderRadius.circular(46),
                    border: Border.all(color: const Color(0xFF2E384D), width: 7),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.22), blurRadius: 32, offset: const Offset(0, 14))],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(38),
                    child: Container(
                      color: AppColors.background,
                      child: AuroraBackground(
                        child: SafeArea(
                          child: Column(
                            children: [
                              // Status Bar
                              Container(
                                height: 38,
                                padding: const EdgeInsets.symmetric(horizontal: 20),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('09:41', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
                                    Container(width: 82, height: 18, decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(12))),
                                    const Row(children: [Icon(Icons.wifi_rounded, size: 12), SizedBox(width: 4), Icon(Icons.battery_full_rounded, size: 14)]),
                                  ],
                                ),
                              ),

                              // Screen View
                              Expanded(
                                child: IndexedStack(
                                  index: _simulatedScreenIndex,
                                  children: [
                                    DashboardScreen(db: widget.db, onNavigateTab: (idx) => setState(() => _simulatedScreenIndex = idx)),
                                    AttendanceScreen(db: widget.db),
                                    TimetableScreen(db: widget.db),
                                    MarksScreen(db: widget.db),
                                    SyllabusScreen(db: widget.db),
                                    ReportsScreen(db: widget.db),
                                    RmsScreen(db: widget.db),
                                  ],
                                ),
                              ),

                              // Bottom Bar
                              Container(
                                height: 54,
                                margin: const EdgeInsets.fromLTRB(10, 0, 10, 4),
                                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    _buildSimPhoneTabIcon(0, Icons.home_rounded),
                                    _buildSimPhoneTabIcon(1, Icons.checklist_rtl_rounded),
                                    _buildSimPhoneTabIcon(2, Icons.calendar_month_rounded),
                                    _buildSimPhoneTabIcon(3, Icons.analytics_rounded),
                                    _buildSimPhoneTabIcon(4, Icons.description_rounded),
                                    _buildSimPhoneTabIcon(6, Icons.shield_rounded),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTelemetryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: BentoTheme.textSecondary, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: BentoTheme.textPrimary)),
        ],
      ),
    );
  }

  Widget _buildSimScreenChip(int index, String label, IconData icon) {
    final isSelected = _simulatedScreenIndex == index;
    return InkWell(
      onTap: () => setState(() => _simulatedScreenIndex = index),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? BentoTheme.forestGreen : BentoTheme.surfaceSubtle,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? BentoTheme.forestGreen : BentoTheme.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: isSelected ? BentoTheme.mintAccent : BentoTheme.textSecondary),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: isSelected ? Colors.white : BentoTheme.textPrimary)),
          ],
        ),
      ),
    );
  }

  Widget _buildSimPhoneTabIcon(int index, IconData icon) {
    final isSelected = _simulatedScreenIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _simulatedScreenIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Icon(icon, size: 18, color: isSelected ? AppColors.primaryPurple : AppColors.textTertiary),
    );
  }

  // ---------------------------------------------------------------------------
  // 13. TAB 8: EXECUTIVE PDF COMPILER
  // ---------------------------------------------------------------------------
  Widget _buildExecutiveProgressReportCompiler(List<Student> students, List<Student> atRisk) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Executive Progress Report PDF Compiler', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: BentoTheme.textPrimary, letterSpacing: -0.5)),
                Text('Compiles multi-table database profiles into an unalterable, structured board review document.', style: TextStyle(fontSize: 12, color: BentoTheme.textSecondary)),
              ],
            ),
            ElevatedButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    backgroundColor: BentoTheme.forestGreen,
                    content: Text('Compiled & Exported to C:\\SchoolManagement\\Exports\\Audits\\executive_audit_report.pdf'),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: BentoTheme.forestGreen, foregroundColor: Colors.white),
              icon: const Icon(Icons.download_rounded, size: 16),
              label: const Text('Compile Executive PDF Audit'),
            ),
          ],
        ),
        const SizedBox(height: 20),

        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: BentoTheme.cardShadow),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('NAWAZ SCHOOL SYSTEM • EXECUTIVE BOARD AUDIT REPORT', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
              Divider(height: 24),
              Text('1. Institutional Attendance Sync Compliance: 96% data entry consistency across working terms.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
              SizedBox(height: 8),
              Text('2. Academic Grade Risk Grid: 🚨 CRITICAL ACADEMIC RISK flagged on Grade 10-A Physics (<50% class baseline).', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: BentoTheme.alertRed)),
              SizedBox(height: 8),
              Text('3. Curriculum Delivery Roadmap: 67% of syllabus topics completed across active STEM subjects.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLegendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: BentoTheme.textSecondary)),
      ],
    );
  }
}
