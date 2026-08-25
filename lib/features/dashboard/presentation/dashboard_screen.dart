import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/student.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/percent_ring.dart';

class DashboardScreen extends StatelessWidget {
  final MockDatabase db;
  final Function(int) onNavigateTab;

  const DashboardScreen({
    super.key,
    required this.db,
    required this.onNavigateTab,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: db,
      builder: (context, _) {
        final students = db.studentsInSelectedClass;
        final presentCount = students.where((s) => s.attendanceStatus == AttendanceStatus.present).length;
        final attendancePercent = students.isEmpty ? 0.0 : (presentCount / students.length) * 100.0;
        final atRiskStudents = db.getAtRiskStudents(db.selectedClass);
        final mathProgress = db.getSyllabusProgress(db.selectedClass, 'Mathematics');
        final physicsProgress = db.getSyllabusProgress(db.selectedClass, 'Physics');

        return AuroraBackground(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
            children: [
              // 1. Hero Purple Card (Exact match to "Your today's task almost done!" card in template)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF5E43F3), Color(0xFF7A62F9)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: AppColors.purpleGlowShadow,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Today's classes\nalmost complete!",
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              height: 1.25,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 16),
                          // White pill button (Matches "View Task" in template)
                          ElevatedButton(
                            onPressed: () => onNavigateTab(1), // Go to Attendance
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.primaryPurple,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Text(
                              'Take Attendance',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Circular Percentage Ring (Matches 85% white ring in template)
                    PercentRing(
                      percent: attendancePercent > 0 ? attendancePercent : 85.0,
                      size: 76,
                      strokeWidth: 6.5,
                      progressColor: Colors.white,
                      backgroundColor: Colors.white.withOpacity(0.25),
                      textStyle: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 2. In Progress Section Header (Matches "In Progress 6" in template)
              Row(
                children: [
                  const Text(
                    'In Progress',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      color: AppColors.purpleTint,
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text(
                        '3',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryPurple,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // In Progress Horizontal Cards
              SizedBox(
                height: 140,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  children: [
                    _buildInProgressCard(
                      tag: 'Period 2 • Active',
                      tagColor: AppColors.pastelPink,
                      tagBg: AppColors.pastelPinkBg,
                      icon: Icons.science_outlined,
                      title: 'Physics (Theory)',
                      subtitle: 'Class 10-A • Room 204',
                      progress: 0.65,
                      onTap: () => onNavigateTab(2), // Timetable
                    ),
                    const SizedBox(width: 14),
                    _buildInProgressCard(
                      tag: 'Next Period 3',
                      tagColor: AppColors.pastelBlue,
                      tagBg: AppColors.pastelBlueBg,
                      icon: Icons.biotech_outlined,
                      title: 'Physics Lab Session',
                      subtitle: 'Class 10-B • Lab Alpha',
                      progress: 0.20,
                      onTap: () => onNavigateTab(2),
                    ),
                    const SizedBox(width: 14),
                    _buildInProgressCard(
                      tag: 'Curriculum',
                      tagColor: AppColors.pastelOrange,
                      tagBg: AppColors.pastelOrangeBg,
                      icon: Icons.calculate_outlined,
                      title: 'Math: Quadratic Eq.',
                      subtitle: 'Syllabus Milestone',
                      progress: mathProgress / 100.0,
                      onTap: () => onNavigateTab(4), // Syllabus
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 3. Automated Risk Profiling Alert (If at-risk students found)
              if (atRiskStudents.isNotEmpty) ...[
                GestureDetector(
                  onTap: () => onNavigateTab(3), // Marks & Risk
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.riskRedBg,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(
                            Icons.error_outline_rounded,
                            color: AppColors.riskRed,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${atRiskStudents.length} Students At-Risk (<35%)',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.riskRed,
                                ),
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'Tap to open analytical score ledger',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 14,
                          color: AppColors.riskRed,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // 4. Task Groups / Classrooms (Matches "Task Groups 4" in template)
              Row(
                children: [
                  const Text(
                    'Workspace Modules',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      color: AppColors.purpleTint,
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text(
                        '4',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryPurple,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Module Card 1: Attendance (Pink Icon, 94% Ring)
              _buildModuleGroupCard(
                icon: Icons.how_to_reg_rounded,
                iconColor: AppColors.pastelPink,
                iconBg: AppColors.pastelPinkBg,
                title: 'Class Attendance Registry',
                subtitle: '$presentCount of ${students.length} Students Present',
                percent: attendancePercent > 0 ? attendancePercent : 94.0,
                ringColor: AppColors.pastelPink,
                ringBg: AppColors.pastelPinkBg,
                onTap: () => onNavigateTab(1),
              ),
              const SizedBox(height: 12),

              // Module Card 2: Math Syllabus (Purple Icon, Math% Ring)
              _buildModuleGroupCard(
                icon: Icons.functions_rounded,
                iconColor: AppColors.primaryPurple,
                iconBg: AppColors.purpleTint,
                title: 'Mathematics Curriculum',
                subtitle: 'Chapter 2: Nature of Roots',
                percent: mathProgress,
                ringColor: AppColors.primaryPurple,
                ringBg: AppColors.purpleTint,
                onTap: () => onNavigateTab(4),
              ),
              const SizedBox(height: 12),

              // Module Card 3: Physics Syllabus (Orange Icon, Physics% Ring)
              _buildModuleGroupCard(
                icon: Icons.science_rounded,
                iconColor: AppColors.pastelOrange,
                iconBg: AppColors.pastelOrangeBg,
                title: 'Physics Curriculum',
                subtitle: 'Unit 10: Simple Harmonic Motion',
                percent: physicsProgress,
                ringColor: AppColors.pastelOrange,
                ringBg: AppColors.pastelOrangeBg,
                onTap: () => onNavigateTab(4),
              ),
              const SizedBox(height: 12),

              // Module Card 4: Performance Slips & WhatsApp (Green Icon, 88% Ring)
              _buildModuleGroupCard(
                icon: Icons.description_outlined,
                iconColor: AppColors.pastelGreen,
                iconBg: AppColors.pastelGreenBg,
                title: 'Parent WhatsApp Dispatch',
                subtitle: 'Compiled Student Academic Slips',
                percent: 88.0,
                ringColor: AppColors.pastelGreen,
                ringBg: AppColors.pastelGreenBg,
                onTap: () => onNavigateTab(5),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInProgressCard({
    required String tag,
    required Color tagColor,
    required Color tagBg,
    required IconData icon,
    required String title,
    required String subtitle,
    required double progress,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: AppColors.softCardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: tagBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: tagColor,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: tagBg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 14, color: tagColor),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                backgroundColor: AppColors.surfaceSubtle,
                valueColor: AlwaysStoppedAnimation<Color>(tagColor),
                minHeight: 5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModuleGroupCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String title,
    required String subtitle,
    required double percent,
    required Color ringColor,
    required Color ringBg,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: AppColors.softCardShadow,
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              PercentRing(
                percent: percent,
                size: 46,
                strokeWidth: 4.5,
                progressColor: ringColor,
                backgroundColor: ringBg,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
