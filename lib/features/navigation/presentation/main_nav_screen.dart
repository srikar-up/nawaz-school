import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_header.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/skeleton_loader.dart';
import '../../dashboard/presentation/dashboard_screen.dart';
import '../../attendance/presentation/attendance_screen.dart';
import '../../timetable/presentation/timetable_screen.dart';
import '../../marks/presentation/marks_screen.dart';
import '../../syllabus/presentation/syllabus_screen.dart';
import '../../reports/presentation/reports_screen.dart';
import '../../rms/presentation/rms_screen.dart';
import '../../admin/presentation/admin_screen.dart';
import '../../admin/presentation/widgets/bento_theme.dart';

class MainNavScreen extends StatefulWidget {
  final bool startWithSkeleton;

  const MainNavScreen({super.key, this.startWithSkeleton = false});

  @override
  State<MainNavScreen> createState() => _MainNavScreenState();
}

class _MainNavScreenState extends State<MainNavScreen> {
  final MockDatabase _db = MockDatabase();
  int _currentIndex = 0;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.startWithSkeleton) {
      _isLoading = true;
      Timer(const Duration(milliseconds: 900), () {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _db,
      builder: (context, _) {
        final isAdmin = _db.isAdmin;

        // Dedicated Modern SaaS Bento Desktop Admin Console
        if (isAdmin) {
          return Scaffold(
            backgroundColor: BentoTheme.background,
            body: SafeArea(
              child: AdminScreen(db: _db),
            ),
          );
        }

        // Mobile Teacher Workspace (Pastel Aurora Mesh UI)
        return Scaffold(
          backgroundColor: AppColors.background,
          body: AuroraBackground(
            child: SafeArea(
              child: Column(
                children: [
                  // Teacher Header
                  TeacherAppHeader(db: _db),

                  // Page View or Skeleton Loading
                  Expanded(
                    child: _isLoading
                        ? const DashboardSkeleton()
                        : IndexedStack(
                            index: _currentIndex,
                            children: [
                              DashboardScreen(
                                db: _db,
                                onNavigateTab: (index) => setState(() => _currentIndex = index),
                              ),
                              AttendanceScreen(db: _db),
                              TimetableScreen(db: _db),
                              MarksScreen(db: _db),
                              SyllabusScreen(db: _db),
                              ReportsScreen(db: _db),
                              RmsScreen(db: _db),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),

          // Teacher Bottom Navigation Bar
          bottomNavigationBar: Container(
            height: 76,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF5E43F3).withOpacity(0.08),
                  blurRadius: 28,
                  offset: const Offset(0, -6),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                // 1. Home
                _buildNavItem(icon: Icons.home_rounded, index: 0, label: 'Home'),

                // 2. Timetable / Calendar
                _buildNavItem(icon: Icons.calendar_month_rounded, index: 2, label: 'Timetable'),

                // 3. Center Elevated Floating Purple Button with '+'
                GestureDetector(
                  onTap: () => _showQuickActionSheet(context),
                  child: Container(
                    width: 52,
                    height: 52,
                    margin: const EdgeInsets.only(bottom: 6),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF5E43F3), Color(0xFF7A62F9)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: AppColors.purpleGlowShadow,
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                ),

                // 4. Syllabus / Documents
                _buildNavItem(icon: Icons.description_rounded, index: 4, label: 'Syllabus'),

                // 5. RMS / Profile
                _buildNavItem(icon: Icons.shield_rounded, index: 6, label: 'RMS Desk'),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required int index,
    required String label,
  }) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 24,
              color: isSelected ? AppColors.primaryPurple : AppColors.textTertiary,
            ),
            const SizedBox(height: 4),
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? AppColors.primaryPurple : Colors.transparent,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQuickActionSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Quick Workspace Operations',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 16),

                _buildQuickActionTile(
                  icon: Icons.checklist_rtl_rounded,
                  color: AppColors.pastelPink,
                  bg: AppColors.pastelPinkBg,
                  title: 'Take Roll Call Attendance',
                  subtitle: 'Fast 1-tap registry for ${_db.selectedClass}',
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _currentIndex = 1);
                  },
                ),
                const SizedBox(height: 10),

                _buildQuickActionTile(
                  icon: Icons.analytics_rounded,
                  color: AppColors.primaryPurple,
                  bg: AppColors.purpleTint,
                  title: 'Log Assessment Marks',
                  subtitle: 'Enter test scores & check <35% risk flags',
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _currentIndex = 3);
                  },
                ),
                const SizedBox(height: 10),

                _buildQuickActionTile(
                  icon: Icons.share_rounded,
                  color: const Color(0xFF25D366),
                  bg: const Color(0xFFEAFBF1),
                  title: 'Dispatch WhatsApp Report Card',
                  subtitle: 'Share formatted academic performance slip',
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _currentIndex = 5);
                  },
                ),
                const SizedBox(height: 10),

                // Switch to Admin Console Tile
                _buildQuickActionTile(
                  icon: Icons.admin_panel_settings_rounded,
                  color: BentoTheme.forestGreen,
                  bg: BentoTheme.mintLight,
                  title: 'Switch to SaaS Admin Console (Principal)',
                  subtitle: 'Access Bento Box Dashboard, Bulk Ingestion & RMS',
                  onTap: () {
                    Navigator.pop(ctx);
                    _db.setRole(UserRole.admin);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuickActionTile({
    required IconData icon,
    required Color color,
    required Color bg,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      tileColor: AppColors.surfaceSubtle,
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textTertiary),
    );
  }
}
