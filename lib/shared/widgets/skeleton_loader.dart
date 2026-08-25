import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class ShimmerEffect extends StatefulWidget {
  final Widget child;

  const ShimmerEffect({super.key, required this.child});

  @override
  State<ShimmerEffect> createState() => _ShimmerEffectState();
}

class _ShimmerEffectState extends State<ShimmerEffect> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              stops: [
                (_animation.value - 0.3).clamp(0.0, 1.0),
                _animation.value.clamp(0.0, 1.0),
                (_animation.value + 0.3).clamp(0.0, 1.0),
              ],
              colors: [
                const Color(0xFFE8EAF2),
                const Color(0xFFF6F7FC),
                const Color(0xFFE8EAF2),
              ],
            ).createShader(bounds);
          },
          child: widget.child,
        );
      },
    );
  }
}

class SkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const SkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFE8EAF2),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerEffect(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 90),
        physics: const NeverScrollableScrollPhysics(),
        children: [
          // Hero Card Skeleton
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: AppColors.softCardShadow,
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBox(width: 140, height: 16, borderRadius: 8),
                      SizedBox(height: 8),
                      SkeletonBox(width: 110, height: 16, borderRadius: 8),
                      SizedBox(height: 18),
                      SkeletonBox(width: 120, height: 36, borderRadius: 16),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Container(
                  width: 76,
                  height: 76,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE8EAF2),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // In Progress Header Skeleton
          const Row(
            children: [
              SkeletonBox(width: 110, height: 18, borderRadius: 8),
              SizedBox(width: 8),
              SkeletonBox(width: 24, height: 24, borderRadius: 12),
            ],
          ),
          const SizedBox(height: 12),

          // In Progress Horizontal Cards Skeleton
          SizedBox(
            height: 140,
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            SkeletonBox(width: 80, height: 16, borderRadius: 8),
                            SkeletonBox(width: 24, height: 24, borderRadius: 12),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonBox(width: 120, height: 14, borderRadius: 6),
                            SizedBox(height: 6),
                            SkeletonBox(width: 90, height: 10, borderRadius: 6),
                          ],
                        ),
                        SkeletonBox(height: 6, borderRadius: 4),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: AppColors.softCardShadow,
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            SkeletonBox(width: 80, height: 16, borderRadius: 8),
                            SkeletonBox(width: 24, height: 24, borderRadius: 12),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonBox(width: 120, height: 14, borderRadius: 6),
                            SizedBox(height: 6),
                            SkeletonBox(width: 90, height: 10, borderRadius: 6),
                          ],
                        ),
                        SkeletonBox(height: 6, borderRadius: 4),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Workspace Modules Header Skeleton
          const Row(
            children: [
              SkeletonBox(width: 150, height: 18, borderRadius: 8),
            ],
          ),
          const SizedBox(height: 14),

          // Module Cards Skeleton
          ...List.generate(3, (index) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: AppColors.softCardShadow,
              ),
              child: const Row(
                children: [
                  SkeletonBox(width: 48, height: 48, borderRadius: 16),
                  SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(width: 140, height: 14, borderRadius: 6),
                        SizedBox(height: 6),
                        SkeletonBox(width: 90, height: 10, borderRadius: 6),
                      ],
                    ),
                  ),
                  SkeletonBox(width: 46, height: 46, borderRadius: 23),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
