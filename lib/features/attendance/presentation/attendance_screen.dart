import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/student.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/percent_ring.dart';

class AttendanceScreen extends StatefulWidget {
  final MockDatabase db;

  const AttendanceScreen({super.key, required this.db});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  String _searchQuery = '';
  String _filter = 'All'; // All, Present, Absent

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final students = widget.db.studentsInSelectedClass;
        final filteredStudents = students.where((s) {
          final matchesSearch = s.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              s.rollNumber.toLowerCase().contains(_searchQuery.toLowerCase());
          if (!matchesSearch) return false;
          if (_filter == 'Present') return s.attendanceStatus == AttendanceStatus.present;
          if (_filter == 'Absent') return s.attendanceStatus == AttendanceStatus.absent;
          return true;
        }).toList();

        final presentCount = students.where((s) => s.attendanceStatus == AttendanceStatus.present).length;
        final absentCount = students.where((s) => s.attendanceStatus == AttendanceStatus.absent).length;
        final attendanceRate = students.isEmpty ? 0.0 : (presentCount / students.length) * 100.0;

        return AuroraBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                // Top Summary Card with Circular Ring
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(26),
                    boxShadow: AppColors.softCardShadow,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${widget.db.selectedClass} Roll Call',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Zero-friction registry • $presentCount Present, $absentCount Absent',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 12),
                            GestureDetector(
                              onTap: () {
                                widget.db.markAllPresent(widget.db.selectedClass);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('All students in ${widget.db.selectedClass} marked Present'),
                                    behavior: SnackBarBehavior.floating,
                                    backgroundColor: AppColors.primaryPurpleDark,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                decoration: BoxDecoration(
                                  color: AppColors.purpleTint,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.done_all_rounded, size: 14, color: AppColors.primaryPurple),
                                    SizedBox(width: 6),
                                    Text(
                                      'Reset All Present',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.primaryPurple,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      PercentRing(
                        percent: attendanceRate,
                        size: 64,
                        strokeWidth: 5.5,
                        progressColor: AppColors.primaryPurple,
                        backgroundColor: AppColors.purpleTint,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Search Bar & Filter Pills
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: AppColors.softCardShadow,
                  ),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: const InputDecoration(
                      hintText: 'Search student or roll number...',
                      prefixIcon: Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Filter Pills
                Row(
                  children: [
                    _buildFilterPill('All'),
                    const SizedBox(width: 8),
                    _buildFilterPill('Present'),
                    const SizedBox(width: 8),
                    _buildFilterPill('Absent'),
                  ],
                ),
                const SizedBox(height: 16),

                // Students List
                if (filteredStudents.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: const Center(
                      child: Text(
                        'No matching students found',
                        style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                      ),
                    ),
                  )
                else
                  ...filteredStudents.map((student) {
                    final isPresent = student.attendanceStatus == AttendanceStatus.present;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: AppColors.softCardShadow,
                      ),
                      child: Row(
                        children: [
                          // Avatar Pastel Badge
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: isPresent ? AppColors.purpleTint : AppColors.riskRedBg,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                student.rollNumber.split('-').last,
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13,
                                  color: isPresent ? AppColors.primaryPurple : AppColors.riskRed,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),

                          // Name & Info
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  student.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                    color: AppColors.textPrimary,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${student.rollNumber} • History: ${(student.attendanceRate * 100).toStringAsFixed(0)}%',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: student.attendanceRate < 0.75
                                        ? AppColors.riskRed
                                        : AppColors.textSecondary,
                                    fontWeight: student.attendanceRate < 0.75
                                        ? FontWeight.w700
                                        : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Interactive Toggle Pill Button
                          GestureDetector(
                            onTap: () => widget.db.toggleAttendance(student.id),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              decoration: BoxDecoration(
                                color: isPresent ? AppColors.primaryPurple : AppColors.riskRedBg,
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: isPresent ? AppColors.purpleGlowShadow : null,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isPresent ? Icons.check_rounded : Icons.close_rounded,
                                    size: 14,
                                    color: isPresent ? Colors.white : AppColors.riskRed,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isPresent ? 'Present' : 'Absent',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                      color: isPresent ? Colors.white : AppColors.riskRed,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),

            // Floating Purple Action Button (Matches template "Add Project" / "Let's Start" style)
            floatingActionButton: Container(
              margin: const EdgeInsets.only(bottom: 12),
              child: ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: AppColors.primaryPurpleDark,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      content: Row(
                        children: [
                          const Icon(Icons.cloud_done_rounded, color: AppColors.brandLime, size: 22),
                          const SizedBox(width: 10),
                          Text(
                            '${widget.db.selectedClass} Attendance Synced to Cloud',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryPurple,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(22),
                  ),
                  elevation: 8,
                  shadowColor: AppColors.primaryPurple.withOpacity(0.4),
                ),
                icon: const Icon(Icons.cloud_upload_rounded, size: 20),
                label: const Text(
                  'Save & Sync Registry',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
            floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
          ),
        );
      },
    );
  }

  Widget _buildFilterPill(String label) {
    final isSelected = _filter == label;
    return GestureDetector(
      onTap: () => setState(() => _filter = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryPurple : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isSelected ? AppColors.purpleGlowShadow : AppColors.softCardShadow,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
