import 'package:flutter/material.dart';
import '../../../core/data/mock_database.dart';
import '../../../core/models/timetable.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/aurora_background.dart';

class TimetableScreen extends StatefulWidget {
  final MockDatabase db;

  const TimetableScreen({super.key, required this.db});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  int _selectedDayIndex = 0;
  String _activeFilter = 'All'; // All, Active, Upcoming, Completed

  final List<Map<String, String>> _dates = [
    {'day': 'Mon', 'date': '24', 'name': 'Monday'},
    {'day': 'Tue', 'date': '25', 'name': 'Tuesday'},
    {'day': 'Wed', 'date': '26', 'name': 'Wednesday'},
    {'day': 'Thu', 'date': '27', 'name': 'Thursday'},
    {'day': 'Fri', 'date': '28', 'name': 'Friday'},
  ];

  @override
  Widget build(BuildContext context) {
    final selectedDayName = _dates[_selectedDayIndex]['name']!;
    final periods = widget.db.timetable.where((p) => p.dayOfWeek == selectedDayName).toList();

    return AuroraBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
          children: [
            // Screen Title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Today's Schedule",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.4,
                      ),
                    ),
                    Text(
                      'Faculty Timetable Matrix',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.purpleTint,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text(
                    'Term 1',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primaryPurple,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Horizontal Date Calendar Strip (Exact match to template date capsules)
            SizedBox(
              height: 78,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: _dates.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final d = entry.value;
                  final isSelected = _selectedDayIndex == idx;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedDayIndex = idx),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 58,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primaryPurple : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: isSelected
                            ? AppColors.purpleGlowShadow
                            : AppColors.softCardShadow,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            d['day']!,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.white70 : AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            d['date']!,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),

            // Pill Filter Tabs (Exact match to "All, To do, In Progress, Completed" in template)
            Row(
              children: [
                _buildFilterPill('All'),
                const SizedBox(width: 8),
                _buildFilterPill('Active'),
                const SizedBox(width: 8),
                _buildFilterPill('Upcoming'),
                const SizedBox(width: 8),
                _buildFilterPill('Lab Only'),
              ],
            ),
            const SizedBox(height: 20),

            // Schedule Cards List (Exact match to template task card design)
            if (periods.isEmpty)
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: AppColors.softCardShadow,
                ),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.event_available_rounded, size: 48, color: AppColors.textTertiary),
                      SizedBox(height: 8),
                      Text(
                        'No periods scheduled for this day',
                        style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...periods.map((period) {
                final isCurrent = period.periodNumber == 2 && selectedDayName == 'Monday';
                final isPast = period.periodNumber < 2 && selectedDayName == 'Monday';

                if (_activeFilter == 'Active' && !isCurrent) return const SizedBox.shrink();
                if (_activeFilter == 'Upcoming' && (isPast || isCurrent)) return const SizedBox.shrink();
                if (_activeFilter == 'Lab Only' && !period.isLab) return const SizedBox.shrink();

                // Dynamic pastel colors for each period
                Color tagColor = AppColors.pastelPink;
                Color tagBg = AppColors.pastelPinkBg;
                if (period.isLab) {
                  tagColor = AppColors.pastelBlue;
                  tagBg = AppColors.pastelBlueBg;
                } else if (period.periodNumber == 1) {
                  tagColor = AppColors.pastelOrange;
                  tagBg = AppColors.pastelOrangeBg;
                } else if (period.periodNumber >= 4) {
                  tagColor = AppColors.pastelGreen;
                  tagBg = AppColors.pastelGreenBg;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: AppColors.softCardShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top Row: Category tag + pastel trash/menu icon
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${period.className} • ${period.room}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: tagBg,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              period.isLab ? Icons.science_outlined : Icons.menu_book_outlined,
                              size: 14,
                              color: tagColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Period Subject Title
                      Text(
                        period.subject,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 4),

                      Text(
                        'Topic: ${period.topicPreview}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Bottom Row: Time pill with clock icon + Status Pill (Done / In Progress / To-do)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.access_time_rounded,
                                size: 14,
                                color: AppColors.primaryPurple,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '${period.startTime} - ${period.endTime}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primaryPurple,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: isCurrent
                                  ? AppColors.purpleTint
                                  : (isPast ? AppColors.pastelGreenBg : AppColors.surfaceSubtle),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              isCurrent ? 'In Progress' : (isPast ? 'Completed' : 'Upcoming'),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: isCurrent
                                    ? AppColors.primaryPurple
                                    : (isPast ? AppColors.pastelGreen : AppColors.textSecondary),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterPill(String label) {
    final isSelected = _activeFilter == label;
    return GestureDetector(
      onTap: () => setState(() => _activeFilter = label),
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
