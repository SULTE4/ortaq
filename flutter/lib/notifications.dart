part of 'app.dart';

extension NotificationUI on _WorkspaceState {
  Widget notificationBell() {
    final notifications = data['notifications'] as List? ?? [];
    final unread = notifications.where((n) => n['read'] != true).length;
    return Badge(
        isLabelVisible: unread > 0,
        label: Text(copy('ui015', [unread])),
        child: IconButton(
            tooltip: copy('ui149'),
            onPressed: () => showNotifications(),
            icon:
                Icon(Icons.notifications_none, size: 22, color: muted)));
  }

  Future<void> showNotifications() async {
    final notifications = data['notifications'] as List? ?? [];
    await showCalmDialog<void>(
        context: context,
        builder: (c) => Dialog(
            child: ConstrainedBox(
                constraints:
                    const BoxConstraints(maxWidth: 500, maxHeight: 600),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(children: [
                        Expanded(
                            child: text(copy('ui147'),
                                size: 23, weight: FontWeight.w700)),
                        IconButton(
                            tooltip: copy('ui150'),
                            onPressed: () => Navigator.pop(c),
                            icon: Icon(Icons.close))
                      ])),
                  if (notifications.isEmpty)
                    Padding(
                        padding: const EdgeInsets.all(30),
                        child: text(copy('ui148'), color: muted)),
                  Flexible(
                      child: ListView(
                          shrinkWrap: true,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          children: notifications
                              .map((n) => ListTile(
                                  contentPadding:
                                      const EdgeInsets.symmetric(vertical: 8),
                                  leading: Icon(
                                      n['kind'] == 'issue'
                                          ? Icons.task_alt
                                          : Icons.campaign_outlined,
                                      color: blue),
                                  title: text(n['title'],
                                      weight: n['read'] == true
                                          ? FontWeight.normal
                                          : FontWeight.w700),
                                  subtitle: text(
                                      copy('ui066', [
                                        n['body'],
                                        n['at']
                                            .toString()
                                            .substring(0, 16)
                                            .replaceFirst('T', ' ')
                                      ]),
                                      size: 12,
                                      color: muted),
                                  onTap: () {
                                    Navigator.pop(c);
                                    if (n['kind'] == 'issue') {
                                      final issues =
                                          data['issues'] as List? ?? [];
                                      final found = issues.where(
                                          (i) => i['id'] == n['related_id']);
                                      if (found.isNotEmpty)
                                        issueDetails(found.first);
                                    } else {
                                      updateView(() => page = 'announcements');
                                    }
                                  }))
                              .toList()))
                ]))));
    await action(() async {
      await api.request('/notifications/read', method: 'POST', body: {});
      await refresh();
    });
  }
}
