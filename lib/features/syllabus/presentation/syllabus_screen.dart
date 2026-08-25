import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';
import '../../../shared/widgets/percent_ring.dart';

class SyllabusScreen extends StatefulWidget {
  final MockDatabase db;

  const SyllabusScreen({super.key, required this.db});

  @override
  State<SyllabusScreen> createState() => _SyllabusScreenState();
}

class _SyllabusScreenState extends State<SyllabusScreen> {
  String _selectedSubject = 'Mathematics';

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.db,
      builder: (context, _) {
        final mathProgress = widget.db.getSyllabusProgress(widget.db.selectedClass, 'Mathematics');
        final physicsProgress = widget.db.getSyllabusProgress(widget.db.selectedClass, 'Physics');

        final activeProgress = _selectedSubject == 'Mathematics' ? mathProgress : physicsProgress;
        final topics = widget.db.syllabus
            .where((t) => t.className == widget.db.selectedClass && t.subject == _selectedSubject)
            .toList();

        final completedCount = topics.where((t) => t.isCompleted).length;

        final Map<String, List<dynamic>> chapterMap = {};
        for (var t in topics) {
          chapterMap.putIfAbsent(t.chapter, () => []).add(t);
        }

        return AuroraBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
              children: [
                // Header
                const Text(
                  'Syllabus Tracker',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
                Text(
                  'Curriculum progress for ${widget.db.selectedClass}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 18),

                // Subject Selector Cards
                Row(
                  children: [
                    _buildSubjectCard('Mathematics', mathProgress, AppColors.primaryPurple, AppColors.purpleTint),
                    const SizedBox(width: 12),
                    _buildSubjectCard('Physics', physicsProgress, AppColors.pastelOrange, AppColors.pastelOrangeBg),
                  ],
                ),
                const SizedBox(height: 18),

                // Summary Progress Card
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
                              '$_selectedSubject Status',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '$completedCount of ${topics.length} Units Completed',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: activeProgress >= 50.0 ? AppColors.pastelGreenBg : AppColors.pastelOrangeBg,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                activeProgress >= 50.0 ? '⚡ On Schedule' : '⚠️ Velocity Behind',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: activeProgress >= 50.0 ? AppColors.pastelGreen : AppColors.pastelOrange,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      PercentRing(
                        percent: activeProgress,
                        size: 68,
                        strokeWidth: 6,
                        progressColor: _selectedSubject == 'Mathematics' ? AppColors.primaryPurple : AppColors.pastelOrange,
                        backgroundColor: _selectedSubject == 'Mathematics' ? AppColors.purpleTint : AppColors.pastelOrangeBg,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),

                // Chapter Checklists
                const Text(
                  'Curriculum Units',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 12),

                ...chapterMap.entries.map((entry) {
                  final chapterTitle = entry.key;
                  final chapterTopics = entry.value;
                  final chapterCompleted = chapterTopics.where((t) => t.isCompleted).length;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        initiallyExpanded: true,
                        tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                        title: Text(
                          chapterTitle,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        subtitle: Text(
                          '$chapterCompleted / ${chapterTopics.length} Units Finished',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                        children: [
                          ...chapterTopics.map((topic) {
                            return CheckboxListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 0),
                              activeColor: AppColors.primaryPurple,
                              checkColor: Colors.white,
                              value: topic.isCompleted,
                              onChanged: (_) => widget.db.toggleSyllabusTopic(topic.id),
                              title: Text(
                                topic.title,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: topic.isCompleted ? FontWeight.w700 : FontWeight.w500,
                                  color: topic.isCompleted ? AppColors.textPrimary : AppColors.textSecondary,
                                  decoration: topic.isCompleted ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            );
                          }),
                          const SizedBox(height: 6),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSubjectCard(String title, double progress, Color color, Color bg) {
    final isSelected = _selectedSubject == title;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedSubject = title),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primaryPurple : Colors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: isSelected ? AppColors.purpleGlowShadow : AppColors.softCardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${progress.toStringAsFixed(0)}% Done',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? Colors.white70 : color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
