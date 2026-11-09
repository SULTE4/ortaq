part of 'app.dart';

extension PollUI on _WorkspaceState {
  Widget pollsView() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui097'), size: 28, weight: FontWeight.w700),
        SizedBox(height: 8),
        text(copy('ui098'), color: muted),
        SizedBox(height: 24),
        if (widget.admin && me?['role'] == 'chairman') ...[
          button(copy('ui099'), () => createPoll(),
              icon: Icons.how_to_vote_outlined),
          SizedBox(height: 20)
        ],
        ...revealList(
            'polls',
            (data['polls'] as List? ?? []).map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 20),
                child: card(CalmSwitcher(
                    child: KeyedSubtree(
                        key: ValueKey(jsonEncode([
                          p['closed'],
                          p['my_vote'],
                          p['results'],
                          p['total_votes']
                        ])),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 9, vertical: 5),
                                    decoration: BoxDecoration(
                                        color: OrtaqColors.surface2,
                                        borderRadius: Radii.pill),
                                    child: text(copy('ui100'),
                                        size: 10,
                                        color: blue,
                                        weight: FontWeight.w700)),
                                const Spacer(),
                                text(
                                    p['closed'] ? copy('ui101') : copy('ui102'),
                                    size: 10,
                                    color: p['closed']
                                        ? muted
                                        : OrtaqColors.resolved,
                                    weight: FontWeight.w700)
                              ]),
                              SizedBox(height: 18),
                              text(p['question'],
                                  size: 22, weight: FontWeight.w700),
                              SizedBox(height: 12),
                              text(
                                  copy('ui103', [
                                    p['closes_at'].toString().substring(0, 10),
                                    p['total_votes']
                                  ]),
                                  size: 12,
                                  color: muted),
                              SizedBox(height: 20),
                              if (p['closed'])
                                ...List.generate((p['options'] as List).length,
                                    (i) {
                                  final count = p['results'][i] as num,
                                      total = p['total_votes'] as num;
                                  return Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 16),
                                      child: Column(children: [
                                        Row(children: [
                                          Expanded(
                                              child: text(p['options'][i])),
                                          text(
                                              copy('ui104', [
                                                total == 0
                                                    ? 0
                                                    : (count / total * 100)
                                                        .round(),
                                                count
                                              ]),
                                              weight: FontWeight.w600)
                                        ]),
                                        SizedBox(height: 8),
                                        ClipRRect(
                                            borderRadius: Radii.small,
                                            child: LinearProgressIndicator(
                                                value: total == 0
                                                    ? 0
                                                    : count / total,
                                                minHeight: 8,
                                                color: i == 0
                                                    ? blue
                                                    : OrtaqColors.muted,
                                                backgroundColor: paper))
                                      ]));
                                })
                              else if (!widget.admin && p['my_vote'] == -1)
                                ...List.generate(
                                    (p['options'] as List).length,
                                    (i) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 10),
                                        child: SizedBox(
                                            width: double.infinity,
                                            child: OutlinedButton(
                                                onPressed: busy
                                                    ? null
                                                    : () => action(() async {
                                                          await api.request(
                                                              '/polls/${p['id']}/votes',
                                                              method: 'POST',
                                                              body: {
                                                                'option': i
                                                              });
                                                          await refresh();
                                                        }),
                                                child: Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                            16),
                                                    child: Text(
                                                        p['options'][i]))))))
                              else ...[
                                text(
                                    widget.admin
                                        ? copy('ui105')
                                        : copy('ui106'),
                                    color: blue,
                                    weight: FontWeight.w600),
                                SizedBox(height: 8),
                                text(copy('ui107'), size: 12, color: muted)
                              ],
                              if (widget.admin &&
                                  me?['role'] == 'chairman' &&
                                  !p['closed'])
                                TextButton(
                                    onPressed: () => action(() async {
                                          await api.request(
                                              '/polls/${p['id']}/close',
                                              method: 'POST',
                                              body: {});
                                          await refresh();
                                        }),
                                    child: Text(copy('ui108'))),
                              SizedBox(height: 8),
                              text(copy('ui109'), size: 11, color: muted)
                            ])))))))
      ]);
  Future<void> createPoll() async {
    final question = TextEditingController(),
        options = TextEditingController(text: copy('defaultPollOptions')),
        closes = TextEditingController(
            text: DateTime.now()
                .add(const Duration(days: 7))
                .toIso8601String()
                .substring(0, 10));
    String message = '';
    bool saving = false;
    await showCalmDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui110')),
                    content: SizedBox(
                        width: 440,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              field(question, copy('ui111')),
                              field(options, copy('ui112'), lines: 3),
                              field(closes, copy('ui113')),
                              text(copy('ui114'), color: muted),
                              if (message.isNotEmpty)
                                text(message, color: OrtaqColors.newIssue)
                            ]))),
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
                                    final date = DateTime.tryParse(closes.text);
                                    if (date == null)
                                      throw Exception(copy('ui115'));
                                    await api.request('/polls',
                                        method: 'POST',
                                        body: {
                                          'question': question.text,
                                          'options': options.text.split('\n'),
                                          'closes_at':
                                              date.toUtc().toIso8601String()
                                        });
                                    if (dialog.mounted) Navigator.pop(dialog);
                                    await refresh();
                                  } catch (e) {
                                    if (c.mounted)
                                      update(() => message = e
                                          .toString()
                                          .replaceFirst('Exception: ', ''));
                                  } finally {
                                    if (c.mounted) update(() => saving = false);
                                  }
                                },
                          child: Text(saving ? copy('ui116') : copy('ui117')))
                    ])));
  }
}
