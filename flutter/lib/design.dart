import 'package:flutter/material.dart';

abstract final class OrtaqColors {
  static const bool isDark = false;

  // 60% Calm Architectural Canvas & Porcelain Surfaces
  static const Color night = Color(0xFFF2F4F7);
  static const Color surface = Color(0xFFFBFCFE);
  static const Color surface2 = Color(0xFFEAEFF4);
  static const Color hairline = Color(0x14162234);
  static const Color snow = Color(0xFF16202C);
  static const Color muted = Color(0xFF5B6878);

  // < 5% Civic Primary Accent: Astana Deep Ocean Teal
  static const Color amber = Color(0xFF0E6E7D);
  static const Color linkAccent = Color(0xFF0E6E7D);
  static const Color amberInk = Color(0xFFFFFFFF);
  static const Color actionSoft = Color(0xFFE3F1F3);

  // < 2% Home Identity Accent: Warm Matte Amber
  static const Color homeGold = Color(0xFFE2942A);
  static const Color homeGoldText = Color(0xFF8A510F);
  static const Color homeGoldSoft = Color(0xFFFCF1E2);

  // Navigation Rail Chrome (Soft tonal separation, zero harsh dark sidebar)
  static const bool darkRail = false;
  static const Color railBg = Color(0xFFEBF0F5);
  static const Color railInk = snow;
  static const Color railMuted = muted;
  static const Color railActiveBg = actionSoft;
  static const Color railActiveInk = amber;

  // Domain Status & Material Accents
  static const Color teal = linkAccent;
  static const Color brick = Color(0xFFB46550);
  static const Color newIssue = Color(0xFFC94B4B);
  static const Color inProgress = Color(0xFFC78018);
  static const Color resolved = Color(0xFF1D835C);
}

abstract final class Radii {
  static const card = BorderRadius.all(Radius.circular(18));
  static const field = BorderRadius.all(Radius.circular(12));
  static const pill = BorderRadius.all(Radius.circular(999));
  static const small = BorderRadius.all(Radius.circular(8));
}

abstract final class CalmMotion {
  static const press = Duration(milliseconds: 150);
  static const enter = Duration(milliseconds: 250);
  static const panel = Duration(milliseconds: 400);
  static const counter = Duration(milliseconds: 700);

  static Duration duration(BuildContext context, Duration value) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : value;

  static ChipAnimationStyle chipStyle(BuildContext context) {
    final animation = AnimationStyle(
        duration: duration(context, press),
        reverseDuration: duration(context, press),
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic);
    return ChipAnimationStyle(
        selectAnimation: animation,
        avatarDrawerAnimation: animation,
        deleteDrawerAnimation: animation,
        enableAnimation: animation);
  }

  static Widget buttonFeedback(
          BuildContext context, Set<WidgetState> states, Widget? child) =>
      AnimatedScale(
          scale: MediaQuery.disableAnimationsOf(context)
              ? 1
              : states.contains(WidgetState.pressed)
                  ? .97
                  : 1,
          duration: duration(context, press),
          curve: Curves.easeOutCubic,
          child: child);
}

ThemeData ortaqTheme() {
  final panel = RoundedRectangleBorder(
      borderRadius: Radii.card, side: BorderSide(color: OrtaqColors.hairline));
  const pill = RoundedRectangleBorder(borderRadius: Radii.pill);
  final field = OutlineInputBorder(
      borderRadius: Radii.field,
      borderSide: BorderSide(color: OrtaqColors.hairline));
  final interaction = ButtonStyle(
      shape: const WidgetStatePropertyAll(pill),
      animationDuration: CalmMotion.press,
      foregroundBuilder: CalmMotion.buttonFeedback,
      side: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.focused)
              ? BorderSide(color: OrtaqColors.linkAccent, width: 2)
              : null),
      overlayColor: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.hovered) ||
                  states.contains(WidgetState.pressed)
              ? OrtaqColors.linkAccent.withValues(alpha: .08)
              : Colors.transparent));
  final scheme = OrtaqColors.isDark
      ? ColorScheme.dark(
          primary: OrtaqColors.amber,
          onPrimary: OrtaqColors.amberInk,
          primaryContainer: OrtaqColors.actionSoft,
          onPrimaryContainer: OrtaqColors.snow,
          secondary: OrtaqColors.homeGold,
          onSecondary: const Color(0xFF1C150B),
          secondaryContainer: OrtaqColors.homeGoldSoft,
          onSecondaryContainer: OrtaqColors.snow,
          tertiary: OrtaqColors.brick,
          onTertiary: OrtaqColors.amberInk,
          surface: OrtaqColors.surface,
          surfaceContainerLowest: OrtaqColors.night,
          surfaceContainerLow: OrtaqColors.surface,
          surfaceContainer: OrtaqColors.surface,
          surfaceContainerHigh: OrtaqColors.surface2,
          surfaceContainerHighest: OrtaqColors.surface2,
          onSurface: OrtaqColors.snow,
          onSurfaceVariant: OrtaqColors.muted,
          outline: OrtaqColors.muted,
          outlineVariant: OrtaqColors.hairline,
          error: OrtaqColors.newIssue,
          onError: OrtaqColors.amberInk,
          errorContainer: const Color(0xFF3A2624),
          onErrorContainer: OrtaqColors.snow,
          surfaceTint: Colors.transparent)
      : ColorScheme.light(
          primary: OrtaqColors.amber,
          onPrimary: OrtaqColors.amberInk,
          primaryContainer: OrtaqColors.actionSoft,
          onPrimaryContainer: OrtaqColors.snow,
          secondary: OrtaqColors.homeGold,
          onSecondary: const Color(0xFF241B0E),
          secondaryContainer: OrtaqColors.homeGoldSoft,
          onSecondaryContainer: OrtaqColors.snow,
          tertiary: OrtaqColors.brick,
          onTertiary: OrtaqColors.amberInk,
          surface: OrtaqColors.surface,
          surfaceContainerLowest: OrtaqColors.night,
          surfaceContainerLow: OrtaqColors.surface,
          surfaceContainer: OrtaqColors.surface,
          surfaceContainerHigh: OrtaqColors.surface2,
          surfaceContainerHighest: OrtaqColors.surface2,
          onSurface: OrtaqColors.snow,
          onSurfaceVariant: OrtaqColors.muted,
          outline: OrtaqColors.muted,
          outlineVariant: OrtaqColors.hairline,
          error: OrtaqColors.newIssue,
          onError: OrtaqColors.amberInk,
          errorContainer: const Color(0xFFF3E4E1),
          onErrorContainer: OrtaqColors.snow,
          surfaceTint: Colors.transparent);
  return ThemeData(
      useMaterial3: true,
      brightness: OrtaqColors.isDark ? Brightness.dark : Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: OrtaqColors.night,
      canvasColor: OrtaqColors.surface,
      dividerColor: OrtaqColors.hairline,
      focusColor: OrtaqColors.linkAccent.withValues(alpha: .16),
      fontFamily: 'LibreFranklin',
      fontFamilyFallback: const ['OrtaqSans'],
      textTheme: TextTheme(
          headlineLarge: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              color: OrtaqColors.snow),
          headlineMedium: TextStyle(
              fontSize: 25,
              fontWeight: FontWeight.w700,
              color: OrtaqColors.snow),
          titleLarge: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: OrtaqColors.snow),
          bodyMedium:
              TextStyle(fontSize: 14, height: 1.5, color: OrtaqColors.snow)),
      cardTheme: CardThemeData(
          color: OrtaqColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shape: panel,
          clipBehavior: Clip.antiAlias),
      inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: OrtaqColors.surface2,
          labelStyle: TextStyle(color: OrtaqColors.muted),
          border: field,
          enabledBorder: field,
          focusedBorder: OutlineInputBorder(
              borderRadius: Radii.field,
              borderSide: BorderSide(color: OrtaqColors.linkAccent, width: 2)),
          errorBorder: OutlineInputBorder(
              borderRadius: Radii.field,
              borderSide: BorderSide(color: OrtaqColors.newIssue)),
          focusedErrorBorder: OutlineInputBorder(
              borderRadius: Radii.field,
              borderSide: BorderSide(color: OrtaqColors.newIssue, width: 2))),
      filledButtonTheme: FilledButtonThemeData(
          style: interaction.merge(FilledButton.styleFrom(
              backgroundColor: OrtaqColors.amber,
              foregroundColor: OrtaqColors.amberInk,
              textStyle:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              padding:
                  const EdgeInsets.symmetric(horizontal: 22, vertical: 18)))),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: interaction.copyWith(
              foregroundColor:
                  WidgetStatePropertyAll(OrtaqColors.linkAccent),
              side: WidgetStateProperty.resolveWith((states) => BorderSide(
                  color: states.contains(WidgetState.focused)
                      ? OrtaqColors.linkAccent
                      : OrtaqColors.hairline,
                  width: states.contains(WidgetState.focused) ? 2 : 1)))),
      textButtonTheme: TextButtonThemeData(
          style: interaction.copyWith(
              textStyle: const WidgetStatePropertyAll(
                  TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
              foregroundColor:
                  WidgetStatePropertyAll(OrtaqColors.linkAccent))),
      iconButtonTheme: IconButtonThemeData(
          style: interaction.copyWith(
              foregroundColor: WidgetStatePropertyAll(OrtaqColors.muted))),
      chipTheme: ChipThemeData(
          shape: pill,
          backgroundColor: OrtaqColors.surface2,
          selectedColor: OrtaqColors.actionSoft,
          labelStyle:
              TextStyle(color: OrtaqColors.snow, fontWeight: FontWeight.w500),
          checkmarkColor: OrtaqColors.linkAccent,
          side: WidgetStateBorderSide.resolveWith((states) => BorderSide(
              color: states.contains(WidgetState.selected) ||
                      states.contains(WidgetState.focused)
                  ? OrtaqColors.linkAccent
                  : OrtaqColors.hairline,
              width: states.contains(WidgetState.focused) ? 2 : 1))),
      segmentedButtonTheme: SegmentedButtonThemeData(style: interaction),
      dialogTheme: DialogThemeData(
          backgroundColor: OrtaqColors.surface,
          surfaceTintColor: Colors.transparent,
          shape: panel),
      bottomSheetTheme: BottomSheetThemeData(
          backgroundColor: OrtaqColors.surface,
          surfaceTintColor: Colors.transparent,
          shape: panel,
          clipBehavior: Clip.antiAlias),
      snackBarTheme: SnackBarThemeData(
          backgroundColor: OrtaqColors.snow,
          contentTextStyle: TextStyle(color: OrtaqColors.surface),
          actionTextColor: OrtaqColors.homeGold,
          behavior: SnackBarBehavior.floating,
          shape: const RoundedRectangleBorder(borderRadius: Radii.field)),
      listTileTheme: ListTileThemeData(
          shape: const RoundedRectangleBorder(borderRadius: Radii.field),
          textColor: OrtaqColors.snow,
          iconColor: OrtaqColors.muted,
          selectedColor: OrtaqColors.linkAccent,
          selectedTileColor: OrtaqColors.actionSoft),
      badgeTheme: BadgeThemeData(
          backgroundColor: OrtaqColors.amber, textColor: OrtaqColors.amberInk),
      progressIndicatorTheme: ProgressIndicatorThemeData(
          color: OrtaqColors.linkAccent,
          linearTrackColor: OrtaqColors.surface2,
          borderRadius: Radii.small),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: CalmPageTransitions(),
        TargetPlatform.iOS: CalmPageTransitions(),
        TargetPlatform.macOS: CalmPageTransitions(),
        TargetPlatform.windows: CalmPageTransitions(),
        TargetPlatform.linux: CalmPageTransitions(),
        TargetPlatform.fuchsia: CalmPageTransitions(),
      }));
}

class CalmPageTransitions extends PageTransitionsBuilder {
  const CalmPageTransitions();
  @override
  Duration get transitionDuration => CalmMotion.enter;
  @override
  Widget buildTransitions<T>(
      PageRoute<T> route,
      BuildContext context,
      Animation<double> animation,
      Animation<double> secondaryAnimation,
      Widget child) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return AnimatedBuilder(
        animation: animation,
        child: child,
        builder: (context, child) {
          final value = animation.status == AnimationStatus.reverse
              ? Curves.easeInCubic.transform(animation.value)
              : Curves.easeOutCubic.transform(animation.value);
          return Opacity(
              opacity: value,
              child: Transform.translate(
                  offset: Offset(0, 10 * (1 - value)), child: child));
        });
  }
}

class CalmSwitcher extends StatelessWidget {
  final Widget child;
  final Duration duration;
  final bool rise;
  const CalmSwitcher(
      {super.key,
      required this.child,
      this.duration = CalmMotion.enter,
      this.rise = false});
  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced) return child;
    return AnimatedSwitcher(
        duration: duration,
        reverseDuration: CalmMotion.enter,
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        layoutBuilder: (current, previous) => LayoutBuilder(
            builder: (context, constraints) =>
                Stack(alignment: Alignment.topCenter, children: [
                  ...previous.map((child) => Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: constraints.hasBoundedHeight ? 0 : null,
                      child: ExcludeFocus(
                          child: ExcludeSemantics(
                              child: IgnorePointer(child: child))))),
                  if (current != null) current
                ])),
        transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: rise
                ? AnimatedBuilder(
                    animation: animation,
                    child: child,
                    builder: (context, child) => Transform.translate(
                        offset: Offset(0, 10 * (1 - animation.value)),
                        child: child))
                : child),
        child: child);
  }
}

class CalmEnter extends StatelessWidget {
  final Widget child;
  final bool animate;
  final int index;
  const CalmEnter(
      {super.key, required this.child, required this.animate, this.index = 0});
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context) || !animate) return child;
    final delay = index.clamp(0, 6) * 50;
    return TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Duration(milliseconds: 250 + delay),
        child: child,
        builder: (context, value, child) => Opacity(
            opacity: Curves.easeOutCubic
                .transform(((value * (250 + delay) - delay) / 250).clamp(0, 1)),
            child: child));
  }
}

class CalmCount extends StatelessWidget {
  final num value;
  final bool animate;
  final Widget Function(num) builder;
  final String? semanticLabel;
  const CalmCount(
      {super.key,
      required this.value,
      required this.animate,
      this.semanticLabel,
      required this.builder});
  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context) || !animate)
      return builder(value);
    return TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: CalmMotion.counter,
        curve: Curves.easeOutCubic,
        builder: (context, progress, _) => Semantics(
            label: semanticLabel ?? '$value',
            excludeSemantics: true,
            child: builder(value * progress)));
  }
}

class CalmLoading extends StatelessWidget {
  final bool linear;
  const CalmLoading({super.key, this.linear = false});
  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return Semantics(
        label: 'Loading',
        liveRegion: true,
        child: linear
            ? LinearProgressIndicator(value: reduced ? 1 : null, minHeight: 2)
            : Center(
                child: reduced
                    ? Icon(Icons.hourglass_empty, color: OrtaqColors.muted)
                    : const CircularProgressIndicator()));
  }
}

Future<T?> showCalmDialog<T>(
        {required BuildContext context,
        required WidgetBuilder builder,
        bool barrierDismissible = true}) =>
    showDialog<T>(
        context: context,
        builder: builder,
        barrierDismissible: barrierDismissible,
        animationStyle: MediaQuery.disableAnimationsOf(context)
            ? AnimationStyle.noAnimation
            : const AnimationStyle(
                duration: CalmMotion.panel,
                reverseDuration: CalmMotion.enter,
                curve: Curves.easeOutCubic,
                reverseCurve: Curves.easeInCubic));

class CalmSelect<T> extends StatelessWidget {
  final T? initialValue;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?>? onChanged;
  final InputDecoration? decoration;
  const CalmSelect(
      {super.key,
      this.initialValue,
      required this.items,
      required this.onChanged,
      this.decoration});
  @override
  Widget build(BuildContext context) {
    if (!MediaQuery.disableAnimationsOf(context)) {
      return DropdownButtonFormField<T>(
          initialValue: initialValue,
          items: items,
          onChanged: onChanged,
          decoration: decoration,
          borderRadius: Radii.field,
          dropdownColor: OrtaqColors.surface2);
    }
    final selected =
        items.where((item) => item.value == initialValue).firstOrNull;
    return InputDecorator(
        decoration: decoration ?? const InputDecoration(),
        child: PopupMenuButton<T>(
            initialValue: initialValue,
            onSelected: onChanged,
            enabled: onChanged != null,
            padding: EdgeInsets.zero,
            position: PopupMenuPosition.under,
            popUpAnimationStyle: AnimationStyle.noAnimation,
            color: OrtaqColors.surface2,
            shape: const RoundedRectangleBorder(borderRadius: Radii.field),
            itemBuilder: (context) => items
                .map((item) => PopupMenuItem<T>(
                    value: item.value,
                    enabled: item.enabled,
                    child: item.child))
                .toList(),
            child: Row(children: [
              Expanded(child: selected?.child ?? const SizedBox()),
              Icon(Icons.arrow_drop_down, color: OrtaqColors.muted)
            ])));
  }
}
