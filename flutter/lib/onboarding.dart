part of 'app.dart';

extension OnboardingUI on _WorkspaceState {
  Future<void> loadPreferences() async {
    try {
      final p = await SharedPreferences.getInstance();
      if (mounted)
        updateView(() {
          guide = !widget.admin && !(p.getBool('ortaq-guide-seen') ?? false);
          prefsReady = true;
        });
    } catch (_) {
      if (mounted) updateView(() => prefsReady = true);
    }
  }

  Widget guideView() => SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(height: 24),
        text(copy('ui001'), size: 38, weight: FontWeight.w800),
        SizedBox(height: 28),
        Container(
            height: 190,
            width: double.infinity,
            decoration: BoxDecoration(color: navy, borderRadius: Radii.card),
            child: const Padding(
                padding: EdgeInsets.all(20),
                child: CustomPaint(painter: _BuildingArt()))),
        SizedBox(height: 26),
        text(copy('ui002'), size: 32, weight: FontWeight.w700),
        SizedBox(height: 10),
        reading(copy('ui003'), size: 17),
        SizedBox(height: 25),
        guideStep(Icons.pie_chart_outline, copy('ui004'), copy('ui005')),
        guideStep(Icons.task_alt, copy('ui006'), copy('ui007')),
        guideStep(Icons.how_to_vote_outlined, copy('ui008'), copy('ui009')),
        SizedBox(height: 20),
        SizedBox(
            width: double.infinity,
            child: button(
                copy('ui010'),
                () => action(() async {
                      final p = await SharedPreferences.getInstance();
                      await p.setBool('ortaq-guide-seen', true);
                      updateView(() => guide = false);
                    }),
                icon: Icons.arrow_forward))
      ]));
  Widget guideStep(IconData icon, String title, String body) => Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: OrtaqColors.surface2, borderRadius: Radii.small),
            child: Icon(icon, color: blue, size: 21)),
        SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(title, weight: FontWeight.w700),
          SizedBox(height: 4),
          text(body, size: 12, color: muted)
        ]))
      ]));
  Widget feedbackView() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui011'), size: 28, weight: FontWeight.w700),
        SizedBox(height: 12),
        text(copy('ui012'), color: muted),
        SizedBox(height: 24),
        button(copy('ui013'), () => sendFeedback(),
            icon: Icons.chat_bubble_outline),
        SizedBox(height: 22),
        if (!widget.admin)
          TextButton(
              onPressed: () => updateView(() => guide = true),
              child: Text(copy('ui014'))),
        if (widget.admin && me?['role'] == 'chairman')
          FutureBuilder<dynamic>(
              future: api.request('/feedback'),
              builder: (context, snapshot) => Column(children: [
                    if (snapshot.hasError)
                      text(copy('ui015', [snapshot.error]),
                          color: OrtaqColors.newIssue),
                    ...((snapshot.data as List?) ?? []).map((f) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: card(Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              text(f['message']),
                              SizedBox(height: 8),
                              text(f['at'].toString().substring(0, 10),
                                  color: muted, size: 12)
                            ]))))
                  ]))
      ]);
  Future<void> sendFeedback() async {
    final message = TextEditingController();
    String error = '';
    bool saving = false;
    await showCalmDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui016')),
                    content: SizedBox(
                        width: 430,
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                          field(message, copy('ui017'), lines: 5),
                          if (error.isNotEmpty)
                            text(error, color: OrtaqColors.newIssue)
                        ])),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialog),
                          child: Text(copy('ui018'))),
                      FilledButton(
                          onPressed: saving
                              ? null
                              : () async {
                                  update(() => saving = true);
                                  try {
                                    await api.request('/feedback',
                                        method: 'POST',
                                        body: {'message': message.text});
                                    if (dialog.mounted) Navigator.pop(dialog);
                                    if (mounted) showMessage(copy('ui019'));
                                  } catch (e) {
                                    if (c.mounted)
                                      update(() => error = e
                                          .toString()
                                          .replaceFirst('Exception: ', ''));
                                  } finally {
                                    if (c.mounted) update(() => saving = false);
                                  }
                                },
                          child: Text(copy('ui013')))
                    ])));
  }
}

class _BuildingArt extends CustomPainter {
  const _BuildingArt();
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint();
    final w = size.width, h = size.height;
    canvas.drawRect(Offset.zero & size, p..color = const Color(0xFFE7EDF3));
    for (var n = 0; n < 3; n++) {
      final x = w * (.06 + n * .29),
          y = h * (.35 + n * .065),
          bw = w * .27,
          bh = h - y;
      canvas.drawRect(
          Rect.fromLTWH(x, y, bw, bh),
          p
            ..color = [
              const Color(0xFF3E7484),
              const Color(0xFFB46550),
              const Color(0xFF2B505C)
            ][n]);
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 4; c++) {
          canvas.drawRect(
              Rect.fromLTWH(x + bw * .12 + c * bw * .22,
                  y + 10 + r * (bh - 15) / 7, bw * .1, bh * .065),
              p
                ..color = (r + c + n) % 4 == 0
                    ? const Color(0xFFBFD6E4)
                    : [
                        OrtaqColors.homeGold,
                        const Color(0xFFD5E1EA),
                        const Color(0xFFE8CCA0)
                      ][(r + c) % 3]);
        }
      }
    }
    final snow = Path()
      ..moveTo(0, h * .83)
      ..quadraticBezierTo(w * .3, h * .78, w * .55, h * .88)
      ..quadraticBezierTo(w * .8, h * .96, w, h * .82)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(snow, p..color = const Color(0xFFF3F6FA));
    canvas.drawRect(Rect.fromLTWH(w * .48, 0, w * .04, h),
        p..color = const Color(0xFF2B505C));
    canvas.drawRect(Rect.fromLTWH(0, h * .49, w, h * .045),
        p..color = const Color(0xFF2B505C));
    canvas.drawRect(Rect.fromLTWH(w * .45, h * .47, w * .1, h * .03),
        p..color = OrtaqColors.homeGold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
