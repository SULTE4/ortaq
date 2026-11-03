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
        const SizedBox(height: 24),
        text(copy('ui001'), size: 38, weight: FontWeight.w800),
        const SizedBox(height: 28),
        Container(
            height: 190,
            width: double.infinity,
            decoration: BoxDecoration(
                color: navy, borderRadius: BorderRadius.circular(24)),
            child: const Padding(
                padding: EdgeInsets.all(20),
                child: CustomPaint(painter: _BuildingArt()))),
        const SizedBox(height: 26),
        text(copy('ui002'), size: 32, weight: FontWeight.w700),
        const SizedBox(height: 10),
        text(copy('ui003'), color: muted),
        const SizedBox(height: 25),
        guideStep(Icons.pie_chart_outline, copy('ui004'), copy('ui005')),
        guideStep(Icons.task_alt, copy('ui006'), copy('ui007')),
        guideStep(Icons.how_to_vote_outlined, copy('ui008'), copy('ui009')),
        const SizedBox(height: 20),
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
                color: const Color(0xFFE9EFFD),
                borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: blue, size: 21)),
        const SizedBox(width: 14),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(title, weight: FontWeight.w700),
          const SizedBox(height: 4),
          text(body, size: 12, color: muted)
        ]))
      ]));
  Widget feedbackView() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui011'), size: 28, weight: FontWeight.w700),
        const SizedBox(height: 12),
        text(copy('ui012'), color: muted),
        const SizedBox(height: 24),
        button(copy('ui013'), () => sendFeedback(),
            icon: Icons.chat_bubble_outline),
        const SizedBox(height: 22),
        if (!widget.admin)
          TextButton(
              onPressed: () => updateView(() => guide = true),
              child: Text(copy('ui014'))),
        if (widget.admin && me?['role'] == 'chairman')
          FutureBuilder<dynamic>(
              future: api.request('/feedback'),
              builder: (context, snapshot) => Column(children: [
                    if (snapshot.hasError)
                      text(copy('ui015', [snapshot.error]), color: Colors.red),
                    ...((snapshot.data as List?) ?? []).map((f) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: card(Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              text(f['message']),
                              const SizedBox(height: 8),
                              text(f['at'].toString().substring(0, 10),
                                  color: muted, size: 12)
                            ]))))
                  ]))
      ]);
  Future<void> sendFeedback() async {
    final message = TextEditingController();
    String error = '';
    bool saving = false;
    await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui016')),
                    content: SizedBox(
                        width: 430,
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                          field(message, copy('ui017'), lines: 5),
                          if (error.isNotEmpty) text(error, color: Colors.red)
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
                                    if (mounted)
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                              content: Text(copy('ui019'))));
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
    final paint = Paint();
    final w = size.width, h = size.height;
    for (var n = 0; n < 3; n++) {
      final x = w * (.08 + n * .3),
          y = h * (.18 + n * .05),
          bw = w * .25,
          bh = h - y - 12;
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(x, y, bw, bh), const Radius.circular(5)),
          paint
            ..color = [
              const Color(0xFF7391BE),
              const Color(0xFFB6C9E4),
              const Color(0xFF42658F)
            ][n]);
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 3; c++) {
          canvas.drawRRect(
              RRect.fromRectAndRadius(
                  Rect.fromLTWH(x + bw * .14 + c * bw * .26,
                      y + 12 + r * (bh - 20) / 7, bw * .13, (bh - 20) / 12),
                  const Radius.circular(1.5)),
              paint
                ..color = (r + c + n) % 4 == 0
                    ? const Color(0xFFF6C882)
                    : const Color(0xFF163B66));
        }
      }
    }
    canvas.drawLine(
        Offset(0, h - 8),
        Offset(w, h - 8),
        paint
          ..color = const Color(0xFF91ACC9)
          ..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
