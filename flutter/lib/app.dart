import 'building_plans.dart';
import 'dart:async';
import 'dart:math' as math;
import 'dart:convert';
import 'dart:js_interop';
import 'package:web/web.dart' as web;
import 'package:flutter/material.dart';
import 'api.dart';
import 'design.dart';
import 'package:file_picker/file_picker.dart';
import 'strings_resident.dart';
import 'strings_admin.dart';
import 'package:shared_preferences/shared_preferences.dart';
part 'building.dart';
part 'plan_images.dart';
part 'reports.dart';
part 'issues.dart';
part 'notifications.dart';
part 'community.dart';
part 'polls.dart';
part 'balances.dart';
part 'onboarding.dart';
part 'dashboard.dart';
part 'embed.dart';

Color get navy => OrtaqColors.surface;
Color get blue => OrtaqColors.linkAccent;
Color get paper => OrtaqColors.night;
Color get snow => OrtaqColors.snow;
Color get muted => OrtaqColors.muted;
bool adminCopy = false;
String copy(String key, [List<Object?> values = const []]) {
  var value = (adminCopy ? adminStrings : residentStrings)[key] ?? key;
  for (var i = 0; i < values.length; i++) {
    value = value.replaceAll('{$i}', '${values[i]}');
  }
  return value;
}

class OrtaqApp extends StatelessWidget {
  final bool admin;
  const OrtaqApp({super.key, required this.admin});
  @override
  Widget build(BuildContext context) => MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Ortaq',
      theme: ortaqTheme(),
      builder: (context, child) => _MotionPreference(child: child!),
      home: Workspace(admin: admin));
}

// Flutter web does not expose the browser motion preference on every SDK.
class _MotionPreference extends StatefulWidget {
  final Widget child;
  const _MotionPreference({required this.child});
  @override
  State<_MotionPreference> createState() => _MotionPreferenceState();
}

class _MotionPreferenceState extends State<_MotionPreference> {
  final preference = web.window.matchMedia('(prefers-reduced-motion: reduce)');
  late final JSFunction listener;
  @override
  void initState() {
    super.initState();
    listener = ((web.Event event) {
      if (mounted) setState(() {});
    }).toJS;
    preference.addEventListener('change', listener);
  }

  @override
  void dispose() {
    preference.removeEventListener('change', listener);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return MediaQuery(
        data: media.copyWith(
            disableAnimations: media.disableAnimations || preference.matches),
        child: widget.child);
  }
}

class Workspace extends StatefulWidget {
  final bool admin;
  const Workspace({super.key, required this.admin});
  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  final api = Api(copy);
  final phone = TextEditingController(text: '+77000000012'),
      code = TextEditingController(text: '1234'),
      invite = TextEditingController(text: 'ORTAQ-045'),
      name = TextEditingController();
  Map<String, dynamic> data = {};
  Map<String, dynamic>? me, building;
  String page = 'home', error = '';
  bool busy = false,
      requested = false,
      guide = false,
      prefsReady = false,
      newResident = false;
  Timer? timer;
  Map<String, String> get s => widget.admin ? adminStrings : residentStrings;
  @override
  void initState() {
    super.initState();
    if (widget.admin) phone.text = '+77000000001';
    loadPreferences();
  }

  @override
  void dispose() {
    timer?.cancel();
    phone.dispose();
    code.dispose();
    invite.dispose();
    name.dispose();
    super.dispose();
  }

  void updateView(VoidCallback change) {
    if (mounted) setState(change);
  }

  Future<void> action(Future<void> Function() f) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await f();
    } catch (e) {
      if (mounted)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> login() async {
    final v = await api.request('/auth/verify', method: 'POST', body: {
      'phone': phone.text,
      'code': code.text,
      if (!widget.admin && newResident) 'invite': invite.text,
      if (!widget.admin && newResident) 'name': name.text
    });
    final u = Map<String, dynamic>.from(v['user']);
    if (widget.admin && u['role'] == 'resident') throw Exception(copy('ui175'));
    if (!widget.admin && u['role'] != 'resident')
      throw Exception(copy('ui176'));
    api.token = v['token'];
    final b = await api.request('/building');
    setState(() {
      me = u;
      building = Map<String, dynamic>.from(b);
    });
    await refresh();
    timer?.cancel();
    timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (me != null && !busy) refresh();
    });
  }

  Widget text(String value,
          {double size = 14,
          Color? color,
          FontWeight weight = FontWeight.normal}) =>
      Text(value,
          style: TextStyle(
              fontSize: size,
              color: color ?? snow,
              fontWeight: weight,
              height: 1.38,
              letterSpacing: size >= 28 ? -size * .04 : -.15));
  Widget reading(String value, {double size = 17, Color? color}) =>
      Text(value,
          style: TextStyle(
              fontFamily: 'SourceSerif',
              fontFamilyFallback: const ['OrtaqSans'],
              fontSize: size,
              height: 1.5,
              color: color ?? muted));
  final revealed = <String>{};
  final counted = <String>{};
  Widget reveal(String id, Widget child, {int index = 0}) => CalmEnter(
      key: ValueKey(id), animate: revealed.add(id), index: index, child: child);
  Widget count(String id, num value, Widget Function(num) builder,
          {String? semanticLabel}) =>
      CalmCount(
          key: ValueKey(id),
          value: value,
          animate: counted.add(id),
          semanticLabel: semanticLabel,
          builder: builder);
  Iterable<Widget> revealList(String group, Iterable<Widget> children) =>
      children.indexed.map(
          (entry) => reveal('$group-${entry.$1}', entry.$2, index: entry.$1));
  Widget card(Widget child, {Color? color}) => AnimatedContainer(
      duration: CalmMotion.duration(context, CalmMotion.enter),
      curve: Curves.easeOutCubic,
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: color ?? navy,
          borderRadius: Radii.card,
          border: Border.all(color: OrtaqColors.hairline),
          boxShadow: [
            BoxShadow(
                color: const Color(0xFF121C2A).withValues(alpha: .045),
                blurRadius: 18,
                offset: const Offset(0, 4))
          ]),
      child: child);
  void showMessage(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)),
          snackBarAnimationStyle: MediaQuery.disableAnimationsOf(context)
              ? AnimationStyle.noAnimation
              : const AnimationStyle(
                  duration: CalmMotion.enter,
                  reverseDuration: CalmMotion.enter));
  Widget field(TextEditingController c, String label,
          {int lines = 1, VoidCallback? onSubmitted}) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextField(
              controller: c,
              maxLines: lines,
              textInputAction:
                  onSubmitted == null ? null : TextInputAction.done,
              onSubmitted: onSubmitted == null ? null : (_) => onSubmitted(),
              decoration: InputDecoration(labelText: label)));
  Widget button(String label, VoidCallback onPressed, {IconData? icon}) =>
      FilledButton(
          onPressed: busy ? null : onPressed,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[
              Icon(icon, size: 18),
              SizedBox(width: 8)
            ],
            Text(label)
          ]));
  Widget loginView() => Center(
      child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: SizedBox(
              width: 390,
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      windowMark(size: 24),
                      SizedBox(width: 12),
                      text(copy('ui001'), size: 36, weight: FontWeight.w500)
                    ]),
                    SizedBox(height: 10),
                    text(widget.admin ? copy('ui177') : copy('ui178'),
                        size: 10, color: blue, weight: FontWeight.w700),
                    SizedBox(height: 44),
                    text(s['login']!, size: 32, weight: FontWeight.w700),
                    SizedBox(height: 12),
                    text(s['subtitle']!, color: muted),
                    SizedBox(height: 30),
                    if (!widget.admin) ...[
                      Wrap(spacing: 10, runSpacing: 8, children: [
                        ChoiceChip(
                            chipAnimationStyle: CalmMotion.chipStyle(context),
                            label: Text(copy('returningResident')),
                            selected: !newResident,
                            onSelected: busy
                                ? null
                                : (_) => updateView(() {
                                      newResident = false;
                                      error = '';
                                    })),
                        ChoiceChip(
                            chipAnimationStyle: CalmMotion.chipStyle(context),
                            label: Text(copy('newResident')),
                            selected: newResident,
                            onSelected: busy
                                ? null
                                : (_) => updateView(() {
                                      newResident = true;
                                      error = '';
                                    }))
                      ]),
                      SizedBox(height: 20)
                    ],
                    field(phone, copy('ui179')),
                    if (!widget.admin && newResident) ...[
                      field(invite, copy('ui181')),
                      field(name, copy('ui182'))
                    ],
                    if (requested)
                      field(code, copy('ui180'),
                          onSubmitted: () => action(login)),
                    button(
                        requested ? copy('ui183') : copy('ui184'),
                        () => action(() async {
                              if (requested) {
                                await login();
                              } else {
                                try {
                                  await api.request('/auth/otp',
                                      method: 'POST',
                                      body: {'phone': phone.text});
                                } on ApiError catch (e) {
                                  if (e.status != 429) rethrow;
                                }
                                setState(() => requested = true);
                              }
                            }),
                        icon: Icons.arrow_forward),
                    SizedBox(height: 26),
                    text(widget.admin ? copy('ui185') : copy('ui186'),
                        size: 12, color: muted),
                    if (error.isNotEmpty)
                      Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: text(error, color: OrtaqColors.newIssue))
                  ]))));
  Future<void> refresh() async {
    try {
      final v = await api.request('/snapshot');
      if (mounted && me != null)
        setState(() {
          data = Map<String, dynamic>.from(v);
          building = Map<String, dynamic>.from(v['building']);
        });
    } catch (e) {
      if (mounted) setState(() => error = copy('connection'));
    }
  }

  List<String> get pages => [
        'home',
        'reports',
        'issues',
        'announcements',
        'polls',
        'balance',
        'feedback',
        if (widget.admin) '3d',
        if (widget.admin && me?['role'] == 'chairman') 'building'
      ];
  Widget content() => page == '3d'
      ? threeDView()
      : page == 'building'
          ? buildingView()
          : page == 'reports'
              ? reportsView()
              : page == 'issues'
                  ? issuesView()
                  : page == 'announcements'
                      ? announcementsView()
                      : page == 'polls'
                          ? pollsView()
                          : page == 'balance'
                              ? balancesView()
                              : page == 'feedback'
                                  ? feedbackView()
                                  : dashboard();
  IconData pageIcon(String p) =>
      {
        'home': Icons.grid_view_rounded,
        'reports': Icons.pie_chart_outline,
        'issues': Icons.handyman_outlined,
        'announcements': Icons.campaign_outlined,
        'polls': Icons.how_to_vote_outlined,
        'balance': Icons.account_balance_wallet_outlined,
        'building': Icons.apartment_outlined,
        'feedback': Icons.chat_bubble_outline,
        '3d': Icons.view_in_ar_outlined
      }[p] ??
      Icons.circle_outlined;
  Widget windowMark({double size = 20, Color? color}) {
    final c = color ?? OrtaqColors.homeGold;
    return SizedBox(
        width: size,
        height: size * 1.25,
        child: Column(children: [
          Expanded(
              child: Row(children: [
            Expanded(
                child: DecoratedBox(
                    decoration: BoxDecoration(
                        color: c, borderRadius: BorderRadius.circular(3)),
                    child: SizedBox.expand())),
            SizedBox(width: size * .14),
            Expanded(
                child: DecoratedBox(
                    decoration: BoxDecoration(
                        color: c.withValues(alpha: .38),
                        borderRadius: BorderRadius.circular(3)),
                    child: SizedBox.expand()))
          ])),
          SizedBox(height: size * .14),
          Expanded(
              child: Row(children: [
            Expanded(
                child: DecoratedBox(
                    decoration: BoxDecoration(
                        color: c.withValues(alpha: .65),
                        borderRadius: BorderRadius.circular(3)),
                    child: SizedBox.expand())),
            SizedBox(width: size * .14),
            Expanded(
                child: DecoratedBox(
                    decoration: BoxDecoration(
                        color: c, borderRadius: BorderRadius.circular(3)),
                    child: SizedBox.expand()))
          ]))
        ]));
  }
  Widget sidebar() => Container(
      width: 240,
      decoration: BoxDecoration(
          color: OrtaqColors.railBg,
          border: Border(right: BorderSide(color: OrtaqColors.hairline))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(26, 26, 20, 30),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                windowMark(size: 21, color: OrtaqColors.homeGold),
                SizedBox(width: 11),
                text(copy('ui001'),
                    size: 30,
                    color: OrtaqColors.railInk,
                    weight: FontWeight.w600)
              ]),
              SizedBox(height: 6),
              text(copy('ui187'),
                  size: 12,
                  color: OrtaqColors.railMuted,
                  weight: FontWeight.w600)
            ])),
        Expanded(
            child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                children: pages
                    .map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 5),
                        child: ListTile(
                            dense: true,
                            shape: RoundedRectangleBorder(
                                borderRadius: Radii.field),
                            selected: page == p,
                            selectedTileColor: OrtaqColors.railActiveBg,
                            leading: Icon(pageIcon(p),
                                color: page == p
                                    ? OrtaqColors.railActiveInk
                                    : OrtaqColors.railMuted,
                                size: 20),
                            title: text(s[p] ?? p,
                                color: page == p
                                    ? (OrtaqColors.darkRail
                                        ? OrtaqColors.railInk
                                        : OrtaqColors.railActiveInk)
                                    : OrtaqColors.railMuted,
                                size: 13.5,
                                weight: page == p
                                    ? FontWeight.w700
                                    : FontWeight.w500),
                            onTap: () => setState(() => page = p))))
                    .toList())),
        Padding(
            padding: const EdgeInsets.all(24),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              text(copy('ui188'), size: 11, color: OrtaqColors.railMuted),
              SizedBox(height: 8),
              text(copy('ui189'),
                  size: 12,
                  color: OrtaqColors.railMuted,
                  weight: FontWeight.w600)
            ]))
      ]));
  Widget topbar() => Container(
      height: 70,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
          color: navy,
          border: Border(bottom: BorderSide(color: OrtaqColors.hairline))),
      child: Row(children: [
        if (!widget.admin)
          Row(children: [
            windowMark(size: 17),
            SizedBox(width: 10),
            text(copy('ui001'), size: 26, weight: FontWeight.w600)
          ])
        else
          Expanded(
              child: Row(children: [
            Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                    color: OrtaqColors.actionSoft, borderRadius: Radii.pill),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                          color: OrtaqColors.resolved, shape: BoxShape.circle)),
                  SizedBox(width: 7),
                  text('Live workspace',
                      size: 11.5, color: blue, weight: FontWeight.w700)
                ])),
            SizedBox(width: 12),
            text(building?['address'] ?? building?['name'] ?? copy('ui190'),
                size: 14.5, weight: FontWeight.w700),
          ])),
        if (!widget.admin) const Spacer(),
        if (!widget.admin)
          Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                  color: OrtaqColors.homeGoldSoft,
                  borderRadius: Radii.pill,
                  border: Border.all(
                      color: OrtaqColors.homeGold.withValues(alpha: .45))),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                        color: OrtaqColors.homeGold, shape: BoxShape.circle)),
                SizedBox(width: 6),
                text(copy('ui191', [me?['apartment']]),
                    size: 11.5,
                    color: OrtaqColors.homeGoldText,
                    weight: FontWeight.w700)
              ])),
        SizedBox(width: 6),
        notificationBell(),
        SizedBox(width: 4),
        if (widget.admin)
          CircleAvatar(
              backgroundColor: OrtaqColors.actionSoft,
              radius: 17,
              child: text(me?['name']?.substring(0, 1) ?? copy('ui192'),
                  color: blue, weight: FontWeight.w700)),
        IconButton(
            tooltip: copy('ui195'),
            onPressed: () {
              setState(() {
                me = null;
                data = {};
                api.token = '';
                requested = false;
                revealed.clear();
                counted.clear();
                page = 'home';
                timer?.cancel();
              });
            },
            icon: Icon(Icons.logout, size: 18, color: muted))
      ]));
  Widget residentNav() => Container(
      decoration: BoxDecoration(
          color: navy,
          border: Border(top: BorderSide(color: OrtaqColors.hairline))),
      padding: const EdgeInsets.only(top: 7, bottom: 9),
      child: Row(
          children: ['home', 'reports', 'issues', 'announcements']
              .map((p) => Expanded(
                  child: InkWell(
                      onTap: () => setState(() => page = p),
                      child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 4),
                                decoration: BoxDecoration(
                                    color: page == p
                                        ? OrtaqColors.actionSoft
                                        : Colors.transparent,
                                    borderRadius: Radii.pill),
                                child: Icon(pageIcon(p),
                                    color: page == p ? blue : muted, size: 21)),
                            SizedBox(height: 3),
                            text(s[p] ?? p,
                                size: 11,
                                color: page == p ? blue : muted,
                                weight: page == p
                                    ? FontWeight.w700
                                    : FontWeight.w500)
                          ])))))
              .toList()));
  @override
  Widget build(BuildContext context) {
    Widget inner;
    if (!prefsReady) {
      inner = const CalmLoading();
    } else if (guide) {
      inner = guideView();
    } else if (me == null) {
      inner = widget.admin
          ? Row(children: [
              Expanded(
                  child: Container(
                      color: navy,
                      child: Center(
                          child: Padding(
                              padding: const EdgeInsets.all(60),
                              child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    text(copy('ui193'),
                                        size: 48,
                                        color: snow,
                                        weight: FontWeight.w700),
                                    SizedBox(height: 28),
                                    text(copy('ui194'),
                                        size: 16, color: OrtaqColors.muted),
                                    SizedBox(height: 44),
                                    SizedBox(
                                        height: 230,
                                        width: 400,
                                        child: CustomPaint(
                                            painter: _BuildingArt()))
                                  ]))))),
              Expanded(child: loginView())
            ])
          : loginView();
    } else {
      final main = Column(children: [
        topbar(),
        CalmSwitcher(
            child: busy
                ? const CalmLoading(key: ValueKey('busy'), linear: true)
                : SizedBox(key: ValueKey('idle'))),
        Expanded(
            child: SingleChildScrollView(
                padding: EdgeInsets.all(widget.admin ? 32 : 22),
                child: Align(
                    alignment: Alignment.topCenter,
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1400),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (error.isNotEmpty)
                                Padding(
                                    padding: const EdgeInsets.only(bottom: 16),
                                    child: card(Row(children: [
                                      Icon(Icons.info_outline,
                                          color: OrtaqColors.newIssue),
                                      SizedBox(width: 10),
                                      Expanded(
                                          child: text(error,
                                              color: OrtaqColors.newIssue)),
                                      IconButton(
                                          tooltip: copy('ui196'),
                                          onPressed: () =>
                                              setState(() => error = ''),
                                          icon: Icon(Icons.close))
                                    ]))),
                              CalmSwitcher(
                                  rise: true,
                                  child: KeyedSubtree(
                                      key: ValueKey(
                                          data.isEmpty ? 'loading' : page),
                                      child: data.isEmpty
                                          ? const CalmLoading()
                                          : content()))
                            ]))))),
        if (!widget.admin) residentNav()
      ]);
      inner = widget.admin
          ? Row(children: [sidebar(), Expanded(child: main)])
          : main;
    }
    inner = CalmSwitcher(
        duration: CalmMotion.panel,
        child: KeyedSubtree(
            key: ValueKey(!prefsReady
                ? 'loading'
                : guide
                    ? 'guide'
                    : me == null
                        ? 'login'
                        : 'workspace'),
            child: inner));
    return Scaffold(
        body: widget.admin
            ? inner
            : Center(
                child: Container(
                    width: 430,
                    margin: MediaQuery.sizeOf(context).width > 500
                        ? const EdgeInsets.symmetric(vertical: 14)
                        : EdgeInsets.zero,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                        color: paper,
                        borderRadius: Radii.card,
                        border:
                            Border.all(color: OrtaqColors.hairline, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                              color: const Color(0xFF09212A)
                                  .withValues(alpha: .10),
                              blurRadius: 48,
                              offset: const Offset(0, 16))
                        ]),
                    child: inner)));
  }
}
