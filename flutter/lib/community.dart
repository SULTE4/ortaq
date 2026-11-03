part of 'app.dart';

extension CommunityUI on _WorkspaceState {
  Widget announcementsView() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui166'), size: 28, weight: FontWeight.w700),
        const SizedBox(height: 8),
        text(copy('ui167'), color: muted),
        const SizedBox(height: 24),
        if (widget.admin && me?['role'] == 'chairman') ...[
          button(copy('ui168'), () => newAnnouncement(),
              icon: Icons.campaign_outlined),
          const SizedBox(height: 20)
        ],
        ...(data['announcements'] as List? ?? []).map((a) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: card(
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.campaign_outlined, color: blue, size: 22),
                const SizedBox(width: 10),
                text(copy('ui169'),
                    size: 10, color: blue, weight: FontWeight.w700),
                const Spacer(),
                text(a['at'].toString().substring(0, 10),
                    size: 11, color: muted)
              ]),
              const SizedBox(height: 18),
              text(a['title'], size: 21, weight: FontWeight.w700),
              const SizedBox(height: 12),
              text(a['body'], color: muted)
            ]))))
      ]);
  Future<void> newAnnouncement() async {
    final title = TextEditingController(text: copy('defaultAnnouncementTitle')),
        body = TextEditingController(text: copy('defaultAnnouncementBody'));
    String message = '';
    bool saving = false;
    await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui170')),
                    content: SizedBox(
                        width: 460,
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                          field(title, copy('ui171')),
                          field(body, copy('ui172'), lines: 5),
                          text(copy('ui173'), color: muted),
                          if (message.isNotEmpty)
                            text(message, color: Colors.red)
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
                                    await api.request('/announcements',
                                        method: 'POST',
                                        body: {
                                          'title': title.text,
                                          'body': body.text
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
                          child: Text(saving ? copy('ui136') : copy('ui174')))
                    ])));
  }
}
