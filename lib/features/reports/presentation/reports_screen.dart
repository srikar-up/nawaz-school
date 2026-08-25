import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/student.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/percent_ring.dart';

class ReportsScreen extends StatefulWidget {
  final MockDatabase db;

  const ReportsScreen({super.key, required this.db});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Student? _selectedStudent;

  @override
  void initState() {
    super.initState();
    if (widget.db.studentsInSelectedClass.isNotEmpty) {
      _selectedStudent = widget.db.studentsInSelectedClass.first;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final students = widget.db.studentsInSelectedClass;
        if (_selectedStudent == null || !students.contains(_selectedStudent)) {
          _selectedStudent = students.isNotEmpty ? students.first : null;
        }

        return AuroraBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
              children: [
                // Header
                const Text(
                  'Student Performance Slip',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
                const Text(
                  'Compiled report card & WhatsApp parent dispatch',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 18),

                // Student Selector Horizontal Strip
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: students.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, idx) {
                      final s = students[idx];
                      final isSelected = _selectedStudent?.id == s.id;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedStudent = s),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primaryPurple : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: isSelected ? AppColors.purpleGlowShadow : AppColors.softCardShadow,
                          ),
                          child: Text(
                            s.name,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 18),

                // Report Card Slip (Matching clean floating white container)
                if (_selectedStudent != null) ...[
                  _buildReportCardSlip(_selectedStudent!),
                  const SizedBox(height: 20),

                  // WhatsApp Share Pill Button (Matches template "Add Project" / "Let's Start" style)
                  ElevatedButton.icon(
                    onPressed: () => _simulateWhatsAppShare(context, _selectedStudent!),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366), // WhatsApp Green
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(22),
                      ),
                      elevation: 6,
                      shadowColor: const Color(0xFF25D366).withOpacity(0.4),
                    ),
                    icon: const Icon(Icons.share_rounded, size: 20),
                    label: const Text(
                      'Dispatch to Parent (WhatsApp)',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildReportCardSlip(Student s) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppColors.softCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.purpleTint,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.school_rounded, color: AppColors.primaryPurple, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'NAWAZ SCHOOL SYSTEM',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryPurpleDark,
                          letterSpacing: 0.3,
                        ),
                      ),
                      Text(
                        'Official Progress Slip • ${s.className}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
              PercentRing(
                percent: s.attendanceRate * 100,
                size: 48,
                strokeWidth: 4.5,
                progressColor: s.attendanceRate >= 0.85 ? AppColors.pastelGreen : AppColors.riskRed,
                backgroundColor: s.attendanceRate >= 0.85 ? AppColors.pastelGreenBg : AppColors.riskRedBg,
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: AppColors.surfaceSubtle),
          const SizedBox(height: 16),

          // Student Details
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Roll: ${s.rollNumber} • Parent: ${s.parentPhone}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: s.isAtRisk ? AppColors.riskRedBg : AppColors.pastelGreenBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  s.isAtRisk ? 'NEEDS REVIEW' : 'PASSING',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: s.isAtRisk ? AppColors.riskRed : AppColors.pastelGreen,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Scores breakdown
          const Text(
            'Recent Assessments',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),

          ...s.recentTestScores.asMap().entries.map((entry) {
            final idx = entry.key + 1;
            final score = entry.value;
            final isLow = score < 35.0;

            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Assessment $idx Score', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  Text(
                    '${score.toStringAsFixed(0)} / 100',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: isLow ? AppColors.riskRed : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 14),

          // Teacher Remarks
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.purpleTint,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.edit_note_rounded, size: 16, color: AppColors.primaryPurple),
                    SizedBox(width: 6),
                    Text(
                      'Teacher Remarks',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primaryPurpleDark,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  s.remarks,
                  style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _simulateWhatsAppShare(BuildContext context, Student s) {
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
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEAFBF1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.send_rounded, color: Color(0xFF25D366), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'WhatsApp Slip Ready',
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                        ),
                        Text(
                          'Target Parent: ${s.parentPhone}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: const Color(0xFF25D366),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          content: Text('Report dispatched to ${s.parentPhone} on WhatsApp!'),
                        ),
                      );
                    },
                    icon: const Icon(Icons.check_circle_rounded),
                    label: const Text('Confirm Dispatch'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
