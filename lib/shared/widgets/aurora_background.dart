import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AuroraBackground extends StatelessWidget {
  final Widget child;

  const AuroraBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: Stack(
        children: [
          // Aurora Mesh Pastel Blob 1: Top-Left Soft Mint/Green
          Positioned(
            top: -60,
            left: -60,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.auroraMint.withOpacity(0.9),
                    AppColors.auroraMint.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),

          // Aurora Mesh Pastel Blob 2: Top-Right Soft Pink/Rose
          Positioned(
            top: 40,
            right: -80,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.auroraPink.withOpacity(0.85),
                    AppColors.auroraPink.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),

          // Aurora Mesh Pastel Blob 3: Center-Right Lavender Glow
          Positioned(
            top: 320,
            right: -50,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.auroraLavender.withOpacity(0.75),
                    AppColors.auroraLavender.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),

          // Aurora Mesh Pastel Blob 4: Bottom-Left Soft Peach/Mint
          Positioned(
            bottom: -50,
            left: -50,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.auroraMint.withOpacity(0.7),
                    AppColors.auroraPeach.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),

          // Foreground Content
          child,
        ],
      ),
    );
  }
}
