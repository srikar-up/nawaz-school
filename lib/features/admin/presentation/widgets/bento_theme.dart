import 'dart:math' as math;
import 'package:flutter/material.dart';

class BentoTheme {
  BentoTheme._();

  // Background & Surfaces
  static const Color background = Color(0xFFF3F4F6); // Soft clean off-white
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceSubtle = Color(0xFFF9FAFB);
  static const Color border = Color(0xFFE5E7EB);
  static const Color borderSubtle = Color(0xFFF3F4F6);

  // Hero Forest Green Palette (from template image)
  static const Color forestGreen = Color(0xFF164E33); // Deep rich forest green
  static const Color forestGreenLight = Color(0xFF1E6743);
  static const Color forestGreenDark = Color(0xFF0E3824);
  static const Color mintAccent = Color(0xFF34D399); // Vibrant mint
  static const Color mintSoft = Color(0xFFD1FAE5);
  static const Color mintLight = Color(0xFFECFDF5);

  // Text Colors
  static const Color textPrimary = Color(0xFF111827); // Deep slate charcoal
  static const Color textSecondary = Color(0xFF6B7280); // Medium muted gray
  static const Color textTertiary = Color(0xFF9CA3AF); // Light gray

  // Status & Risk Badges
  static const Color alertRed = Color(0xFFEF4444);
  static const Color alertRedBg = Color(0xFFFEE2E2);
  static const Color alertOrange = Color(0xFFF59E0B);
  static const Color alertOrangeBg = Color(0xFFFEF3C7);
  static const Color blueAccent = Color(0xFF3B82F6);
  static const Color blueAccentBg = Color(0xFFEFF6FF);

  // Bento Card BoxShadow
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: Colors.black.withOpacity(0.02),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ];
}

// Custom Painter for Ultra-Thick Rounded Half-Donut Gauge (Matches "Project Progress" in template)
class HalfDonutGaugePainter extends CustomPainter {
  final double completedPercent; // e.g. 0.41 (41%)
  final double inProgressPercent; // e.g. 0.25 (25%)
  final Color completedColor;
  final Color inProgressColor;
  final Color pendingColor;

  HalfDonutGaugePainter({
    required this.completedPercent,
    required this.inProgressPercent,
    this.completedColor = BentoTheme.mintAccent,
    this.inProgressColor = BentoTheme.forestGreen,
    this.pendingColor = const Color(0xFFE5E7EB),
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.85);
    final radius = size.width * 0.42;
    const strokeWidth = 24.0;

    final baseRect = Rect.fromCircle(center: center, radius: radius);

    // 1. Background Track (Pending / Striped Gray)
    final bgPaint = Paint()
      ..color = pendingColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(baseRect, math.pi, math.pi, false, bgPaint);

    // 2. In-Progress Arc (Dark Forest Green)
    final totalActive = (completedPercent + inProgressPercent).clamp(0.0, 1.0);
    if (totalActive > 0) {
      final activePaint = Paint()
        ..color = inProgressColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(baseRect, math.pi, math.pi * totalActive, false, activePaint);
    }

    // 3. Completed Arc (Vibrant Mint)
    if (completedPercent > 0) {
      final compPaint = Paint()
        ..color = completedColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(baseRect, math.pi, math.pi * completedPercent.clamp(0.0, 1.0), false, compPaint);
    }
  }

  @override
  bool shouldRepaint(covariant HalfDonutGaugePainter oldDelegate) {
    return oldDelegate.completedPercent != completedPercent ||
        oldDelegate.inProgressPercent != inProgressPercent;
  }
}

// Custom Painter for Stylized Thick Pill Bars (Striped & Solid Bars)
class StylizedBarPainter extends CustomPainter {
  final bool isStriped;
  final Color color;

  StylizedBarPainter({required this.isStriped, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(size.width / 2),
    );

    if (!isStriped) {
      final paint = Paint()..color = color;
      canvas.drawRRect(rect, paint);
      return;
    }

    // Striped Pattern
    final bgPaint = Paint()..color = const Color(0xFFF3F4F6);
    canvas.drawRRect(rect, bgPaint);

    canvas.save();
    canvas.clipRRect(rect);

    final stripePaint = Paint()
      ..color = const Color(0xFFD1D5DB)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;

    const spacing = 7.0;
    for (double i = -size.height; i < size.width + size.height; i += spacing) {
      canvas.drawLine(
        Offset(i, size.height),
        Offset(i + size.height, 0),
        stripePaint,
      );
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant StylizedBarPainter oldDelegate) {
    return oldDelegate.isStriped != isStriped || oldDelegate.color != color;
  }
}
