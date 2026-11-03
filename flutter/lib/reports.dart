part of 'app.dart';

extension ReportsUI on _WorkspaceState {
  List<dynamic> currentExpenses(dynamic r) =>
      ((r['corrections'] as List?)?.isNotEmpty ?? false)
          ? r['corrections'].last['expenses']
          : r['expenses'];
  String kzt(num n) =>
      '₸ ${n.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ')}';
  Future<String?> pickPhoto() async {
    final f = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        withData: true);
    if (f == null) return null;
    final file = f.files.single;
    if (file.bytes == null) throw Exception(copy('ui118'));
    return api.upload(file.bytes!, file.name);
  }

  Widget reportsView() {
    final reports = data['reports'] as List? ?? [];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(copy('ui119'), size: 28, weight: FontWeight.w700),
      const SizedBox(height: 8),
      text(copy('ui120'), color: muted),
      const SizedBox(height: 24),
      if (widget.admin) ...[
        button(copy('ui121'), () => editReport()),
        const SizedBox(height: 20)
      ],
      ...reports.map((r) {
        final items = currentExpenses(r);
        final total =
            items.fold<num>(0, (sum, e) => sum + (e['amount'] as num));
        return Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: card(
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                    child: text(r['month'], size: 21, weight: FontWeight.w700)),
                text(copy('ui122'),
                    size: 10,
                    color: const Color(0xFF1A9474),
                    weight: FontWeight.w700)
              ]),
              const SizedBox(height: 12),
              text(kzt(total), size: 30, weight: FontWeight.w700),
              text(copy('ui123', [items.length]), color: muted),
              const SizedBox(height: 20),
              categoryChart(items),
              const SizedBox(height: 20),
              ...items.map((e) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                          color: paper,
                          borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.receipt_long,
                          color: blue, size: 20)),
                  title: text(
                      e['description']?.isEmpty ?? true
                          ? e['category']
                          : e['description'],
                      weight: FontWeight.w600),
                  subtitle: text(e['date'], color: muted, size: 12),
                  trailing: text(kzt(e['amount']), weight: FontWeight.w700),
                  onTap: () => receipt(e))),
              const SizedBox(height: 20),
              ...((r['corrections'] as List? ?? []).map((c) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: text(copy('ui124', [c['note']]),
                      color: const Color(0xFFB27910))))),
              if (widget.admin)
                TextButton(
                    onPressed: () => editReport(existing: r),
                    child: Text(copy('ui125')))
            ])));
      })
    ]);
  }

  Widget categoryChart(List<dynamic> items) {
    final groups = <String, num>{};
    for (final e in items) {
      groups[e['category']] =
          (groups[e['category']] ?? 0) + (e['amount'] as num);
    }
    final total = groups.values.fold<num>(0, (a, b) => a + b);
    return Column(children: [
      SizedBox(
          height: 150,
          width: 150,
          child: CustomPaint(
              painter: _Donut(groups.values.map((v) => v / total).toList()),
              child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                text(copy('ui126'), size: 24, weight: FontWeight.w700),
                text(copy('ui127'), size: 10, color: muted)
              ])))),
      const SizedBox(height: 18),
      ...groups.entries.toList().asMap().entries.map((row) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(children: [
            Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                    color: _Donut.colors[row.key % 6], shape: BoxShape.circle)),
            const SizedBox(width: 10),
            Expanded(child: text(row.value.key, size: 12)),
            text(kzt(row.value.value), size: 12, weight: FontWeight.w600)
          ])))
    ]);
  }

  Future<void> receipt(dynamic expense) => showDialog<void>(
      context: context,
      builder: (c) => Dialog(
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 660),
              child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Row(children: [
                      Expanded(
                          child: text(
                              copy('ui062', [
                                expense['category'],
                                kzt(expense['amount'])
                              ]),
                              size: 20,
                              weight: FontWeight.w700)),
                      IconButton(
                          tooltip: copy('ui145'),
                          onPressed: () => Navigator.pop(c),
                          icon: const Icon(Icons.close))
                    ]),
                    text(copy('ui128', [expense['date']]), color: muted),
                    const SizedBox(height: 18),
                    Image.network(api.media(expense['receipt']),
                        headers: {'Authorization': 'Bearer ${api.token}'},
                        errorBuilder: (c, e, s) =>
                            text(copy('ui129'), color: Colors.red))
                  ])))));
  Future<void> editReport({dynamic existing}) async {
    final month = TextEditingController(
        text: existing?['month'] ??
            DateTime.now().toIso8601String().substring(0, 7));
    final note = TextEditingController();
    final items = <Map<String, dynamic>>[
      if (existing != null)
        ...currentExpenses(existing).map((e) => Map<String, dynamic>.from(e))
    ];
    String message = '';
    bool uploading = false;
    await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title:
                        Text(existing == null ? copy('ui121') : copy('ui130')),
                    content: SizedBox(
                        width: 620,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              field(month, copy('ui131')),
                              if (existing != null)
                                field(note, copy('ui132'), lines: 2),
                              ...items.asMap().entries.map((e) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(copy('ui062', [
                                    e.value['category'],
                                    kzt(e.value['amount'])
                                  ])),
                                  subtitle:
                                      Text(copy('ui133', [e.value['date']])),
                                  trailing: IconButton(
                                      tooltip: copy('ui146'),
                                      onPressed: () =>
                                          update(() => items.removeAt(e.key)),
                                      icon: const Icon(Icons.close)))),
                              const SizedBox(height: 10),
                              OutlinedButton.icon(
                                  onPressed: uploading
                                      ? null
                                      : () async {
                                          final item =
                                              await expenseForm(month.text);
                                          if (item != null)
                                            update(() => items.add(item));
                                        },
                                  icon: const Icon(Icons.add),
                                  label: Text(copy('ui134'))),
                              const SizedBox(height: 14),
                              text(copy('ui135'), color: muted),
                              if (message.isNotEmpty)
                                text(message, color: Colors.red)
                            ]))),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialog),
                          child: Text(copy('ui018'))),
                      FilledButton(
                          onPressed: uploading
                              ? null
                              : () async {
                                  update(() => uploading = true);
                                  try {
                                    await api.request(
                                        existing == null
                                            ? '/reports'
                                            : '/reports/${existing['id']}/corrections',
                                        method: 'POST',
                                        body: existing == null
                                            ? {
                                                'month': month.text,
                                                'expenses': items
                                              }
                                            : {
                                                'note': note.text,
                                                'expenses': items
                                              });
                                    if (dialog.mounted) Navigator.pop(dialog);
                                    await refresh();
                                  } catch (e) {
                                    update(() => message = e
                                        .toString()
                                        .replaceFirst('Exception: ', ''));
                                  } finally {
                                    if (c.mounted)
                                      update(() => uploading = false);
                                  }
                                },
                          child:
                              Text(uploading ? copy('ui136') : copy('ui137')))
                    ])));
  }

  Future<Map<String, dynamic>?> expenseForm(String month) async {
    final amount = TextEditingController(),
        date = TextEditingController(text: '$month-05'),
        description = TextEditingController();
    String cat = 'Cleaning', photo = '', message = '';
    bool uploading = false;
    return showDialog<Map<String, dynamic>>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui138')),
                    content: SizedBox(
                        width: 420,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              DropdownButtonFormField<String>(
                                  initialValue: cat,
                                  items: [
                                    'Cleaning',
                                    'Elevator',
                                    'Security',
                                    'Utilities',
                                    'Repairs',
                                    'Salary'
                                  ]
                                      .map((v) => DropdownMenuItem(
                                          value: v, child: Text(v)))
                                      .toList(),
                                  onChanged: (v) => cat = v!),
                              const SizedBox(height: 16),
                              field(amount, copy('ui139')),
                              field(date, copy('ui140')),
                              field(description, copy('ui083')),
                              OutlinedButton.icon(
                                  onPressed: uploading
                                      ? null
                                      : () async {
                                          update(() => uploading = true);
                                          try {
                                            final p = await pickPhoto();
                                            if (p != null)
                                              update(() => photo = p);
                                          } catch (e) {
                                            update(() => message = '$e');
                                          } finally {
                                            update(() => uploading = false);
                                          }
                                        },
                                  icon: Icon(photo.isEmpty
                                      ? Icons.add_photo_alternate
                                      : Icons.check_circle),
                                  label: Text(photo.isEmpty
                                      ? copy('ui141')
                                      : copy('ui142'))),
                              TextButton(
                                  onPressed: () => update(
                                      () => photo = '/media/seed/receipt.png'),
                                  child: Text(copy('ui143'))),
                              if (message.isNotEmpty)
                                text(message, color: Colors.red)
                            ]))),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialog),
                          child: Text(copy('ui018'))),
                      FilledButton(
                          onPressed: photo.isEmpty || uploading
                              ? null
                              : () => Navigator.pop(dialog, {
                                    'id': '',
                                    'category': cat,
                                    'amount': int.tryParse(amount.text) ?? 0,
                                    'date': date.text,
                                    'receipt': photo,
                                    'description': description.text
                                  }),
                          child: Text(copy('ui144')))
                    ])));
  }
}

class _Donut extends CustomPainter {
  final List<double> values;
  _Donut(this.values);
  static const colors = [
    Color(0xFF315E6E),
    Color(0xFF70A79A),
    Color(0xFFD4B476),
    Color(0xFF8FA7B0),
    Color(0xFFC39C89),
    Color(0xFFADBAA9)
  ];
  @override
  void paint(Canvas canvas, Size size) {
    var start = -math.pi / 2;
    for (var i = 0; i < values.length; i++) {
      final sweep = values[i] * math.pi * 2;
      canvas.drawArc(
          Rect.fromLTWH(12, 12, size.width - 24, size.height - 24),
          start,
          sweep - .025,
          false,
          Paint()
            ..color = colors[i % 6]
            ..style = PaintingStyle.stroke
            ..strokeWidth = 20
            ..strokeCap = StrokeCap.butt);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _Donut old) =>
      old.values.toString() != values.toString();
}
