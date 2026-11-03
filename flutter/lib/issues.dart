part of 'app.dart';

extension IssuesUI on _WorkspaceState {
  Color statusColor(String status) => status == 'Resolved'
      ? const Color(0xFF1C9A79)
      : status == 'In Progress'
          ? const Color(0xFFD19A2A)
          : const Color(0xFFE56870);
  String location(dynamic l) => l['area'] != ''
      ? l['area']
      : copy('location', [l['entrance'], l['floor']]);
  Widget issueCard(dynamic issue) => Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: InkWell(
          borderRadius: BorderRadius.circular(4),
          onTap: () => issueDetails(issue),
          child: card(
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                      color: statusColor(issue['status']),
                      shape: BoxShape.circle)),
              const SizedBox(width: 8),
              text(issue['status'],
                  color: statusColor(issue['status']),
                  size: 11,
                  weight: FontWeight.w700),
              const Spacer(),
              text(issue['category'], size: 11, color: muted)
            ]),
            const SizedBox(height: 14),
            text(issue['title'], size: 17, weight: FontWeight.w700),
            const SizedBox(height: 8),
            text(location(issue['location']), size: 12, color: muted),
            const SizedBox(height: 12),
            Row(children: [
              const Icon(Icons.people_outline, size: 17, color: muted),
              const SizedBox(width: 6),
              text(copy('ui058', [(issue['supporters'] as List).length]),
                  size: 12, color: muted),
              const Spacer(),
              const Icon(Icons.arrow_forward, size: 17, color: blue)
            ])
          ]))));
  Widget issuesView() {
    final issues = data['issues'] as List? ?? [];
    if (widget.admin) return issueBoard(issues);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(copy('ui059'), size: 28, weight: FontWeight.w700),
      const SizedBox(height: 8),
      text(copy('ui060'), color: muted),
      const SizedBox(height: 20),
      if (!widget.admin) ...[
        button(copy('ui061'), () => reportIssue(), icon: Icons.add),
        const SizedBox(height: 20)
      ],
      ...issues.map(issueCard)
    ]);
  }

  Future<void> issueDetails(dynamic issue) => showDialog<void>(
      context: context,
      builder: (c) => Dialog(
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(children: [
                          Expanded(
                              child: text(issue['title'],
                                  size: 23, weight: FontWeight.w700)),
                          IconButton(
                              tooltip: copy('ui090'),
                              onPressed: () => Navigator.pop(c),
                              icon: const Icon(Icons.close))
                        ]),
                        text(
                            copy('ui062', [
                              location(issue['location']),
                              issue['category']
                            ]),
                            color: muted),
                        const SizedBox(height: 18),
                        ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Image.network(api.media(issue['photo']),
                                headers: {
                                  'Authorization': 'Bearer ${api.token}'
                                },
                                height: 200,
                                width: double.infinity,
                                fit: BoxFit.cover,
                                errorBuilder: (c, e, s) =>
                                    const Icon(Icons.image_not_supported))),
                        const SizedBox(height: 18),
                        text(issue['description']),
                        const SizedBox(height: 16),
                        if (!widget.admin && issue['status'] != 'Resolved')
                          ((issue['supporters'] as List)
                                  .contains(me?['apartment'])
                              ? text(copy('ui063'),
                                  color: blue, weight: FontWeight.w700)
                              : button(
                                  copy('ui064', [
                                    (issue['supporters'] as List).length
                                  ]), () {
                                  Navigator.pop(c);
                                  action(() async {
                                    await api.request(
                                        '/issues/${issue['id']}/support',
                                        method: 'POST',
                                        body: {});
                                    await refresh();
                                  });
                                }, icon: Icons.people_outline)),
                        const SizedBox(height: 20),
                        text(copy('ui065'),
                            size: 11, color: muted, weight: FontWeight.w700),
                        ...((issue['history'] as List).map((h) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.circle,
                                size: 12, color: statusColor(h['status'])),
                            title: text(h['status'], weight: FontWeight.w600),
                            subtitle: text(
                                copy('ui066', [
                                  h['note'],
                                  h['at']
                                      .toString()
                                      .substring(0, 16)
                                      .replaceFirst('T', ' ')
                                ]),
                                size: 12,
                                color: muted)))),
                        if (widget.admin && me?['role'] == 'chairman')
                          Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: button(copy('ui067'), () {
                                Navigator.pop(c);
                                updateIssue(issue);
                              })),
                        if ((issue['result_photo'] ?? '') != '') ...[
                          text(copy('ui068'), weight: FontWeight.w700),
                          Image.network(api.media(issue['result_photo']),
                              headers: {'Authorization': 'Bearer ${api.token}'},
                              height: 180,
                              fit: BoxFit.cover)
                        ]
                      ])))));
  Widget issueBoard(List<dynamic> issues) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui069'), size: 28, weight: FontWeight.w700),
        const SizedBox(height: 8),
        text(copy('ui070'), color: muted),
        const SizedBox(height: 26),
        SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: ['New', 'In Progress', 'Resolved']
                    .map((status) => DragTarget<Map<String, dynamic>>(
                        onWillAcceptWithDetails: (d) =>
                            me?['role'] == 'chairman' &&
                            d.data['status'] != status,
                        onAcceptWithDetails: (d) =>
                            updateIssue(d.data, target: status),
                        builder: (context, candidate, rejected) => Container(
                            width: 300,
                            margin: const EdgeInsets.only(right: 18),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                                color: candidate.isNotEmpty
                                    ? blue.withValues(alpha: .08)
                                    : const Color(0xFFE2E7E0),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(
                                    color: candidate.isNotEmpty
                                        ? blue
                                        : Colors.transparent)),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    Icon(Icons.circle,
                                        size: 9, color: statusColor(status)),
                                    const SizedBox(width: 9),
                                    text(status, weight: FontWeight.w700),
                                    const Spacer(),
                                    text(
                                        copy('ui015', [
                                          issues
                                              .where(
                                                  (i) => i['status'] == status)
                                              .length
                                        ]),
                                        color: muted)
                                  ]),
                                  const SizedBox(height: 20),
                                  ...issues
                                      .where((i) => i['status'] == status)
                                      .map((i) => Draggable<
                                              Map<String, dynamic>>(
                                          data: Map<String, dynamic>.from(i),
                                          maxSimultaneousDrags:
                                              me?['role'] == 'chairman' ? 1 : 0,
                                          feedback: Material(
                                              color: Colors.transparent,
                                              child: SizedBox(
                                                  width: 270,
                                                  child: issueCard(i))),
                                          childWhenDragging: Opacity(
                                              opacity: .3, child: issueCard(i)),
                                          child: issueCard(i)))
                                ]))))
                    .toList()))
      ]);
  Future<void> updateIssue(dynamic issue, {String? target}) async {
    final contractor = TextEditingController(text: issue['contractor']),
        note = TextEditingController();
    String status = target ??
            (issue['status'] == 'New'
                ? 'In Progress'
                : issue['status'] == 'In Progress'
                    ? 'Resolved'
                    : 'In Progress'),
        photo = '',
        message = '';
    bool saving = false;
    await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui071')),
                    content: SizedBox(
                        width: 430,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              text(issue['title'], weight: FontWeight.w700),
                              const SizedBox(height: 20),
                              DropdownButtonFormField<String>(
                                  initialValue: status,
                                  items: ['New', 'In Progress', 'Resolved']
                                      .map((v) => DropdownMenuItem(
                                          value: v, child: Text(v)))
                                      .toList(),
                                  onChanged: (v) => update(() => status = v!)),
                              const SizedBox(height: 14),
                              field(contractor, copy('ui072')),
                              field(note, copy('ui073'), lines: 2),
                              if (status == 'Resolved')
                                OutlinedButton.icon(
                                    onPressed: saving
                                        ? null
                                        : () async {
                                            update(() => saving = true);
                                            try {
                                              final p = await pickPhoto();
                                              if (p != null)
                                                update(() => photo = p);
                                            } catch (e) {
                                              update(() => message = '$e');
                                            } finally {
                                              if (c.mounted)
                                                update(() => saving = false);
                                            }
                                          },
                                    icon: Icon(photo.isEmpty
                                        ? Icons.add_a_photo
                                        : Icons.check_circle),
                                    label: Text(photo.isEmpty
                                        ? copy('ui074')
                                        : copy('ui075'))),
                              if (status == 'Resolved')
                                TextButton(
                                    onPressed: () => update(
                                        () => photo = '/media/seed/result.png'),
                                    child: Text(copy('ui076'))),
                              if (message.isNotEmpty)
                                text(message, color: Colors.red)
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
                                    await api.request('/issues/${issue['id']}',
                                        method: 'PATCH',
                                        body: {
                                          'status': status,
                                          'contractor': contractor.text,
                                          'result_photo': photo,
                                          'note': note.text
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
                          child: Text(saving ? copy('ui077') : copy('ui078')))
                    ])));
  }

  List<Widget> similarIssueWidgets(String category, String area, int entrance,
      int floor, BuildContext dialog) {
    final matches = (data['issues'] as List? ?? [])
        .where((i) =>
            i['status'] != 'Resolved' &&
            i['category'] == category &&
            i['location']['area'] == area &&
            (area.isNotEmpty ||
                (i['location']['entrance'] == entrance &&
                    i['location']['floor'] == floor)))
        .toList();
    if (matches.isEmpty) return [];
    return [
      text(copy('ui079'), size: 13, weight: FontWeight.w700, color: blue),
      const SizedBox(height: 8),
      ...matches.map((i) => Card(
          color: const Color(0xFFE5ECE5),
          child: ListTile(
              title: text(i['title'], size: 13, weight: FontWeight.w600),
              subtitle:
                  text(copy('ui080', [i['status']]), size: 11, color: muted),
              trailing: TextButton(
                  onPressed: () {
                    Navigator.pop(dialog);
                    issueDetails(i);
                  },
                  child: Text(copy('ui081')))))),
      const SizedBox(height: 16)
    ];
  }

  Future<void> reportIssue() async {
    final title = TextEditingController(text: copy('defaultIssueTitle')),
        description = TextEditingController(text: copy('defaultIssueBody'));
    String category = 'Heating', area = '', photo = '', message = '';
    int entrance = math.min(2, building?['entrances'] as int? ?? 3),
        floor = math.min(5, building?['floors'] as int? ?? 9);
    bool saving = false;
    await showDialog<void>(
        context: context,
        builder: (dialog) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: Text(copy('ui061')),
                    content: SizedBox(
                        width: 480,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              field(title, copy('ui082')),
                              field(description, copy('ui083'), lines: 3),
                              DropdownButtonFormField<String>(
                                  initialValue: category,
                                  decoration:
                                      InputDecoration(labelText: copy('ui091')),
                                  items: [
                                    'Heating',
                                    'Plumbing',
                                    'Elevator',
                                    'Cleaning',
                                    'Lighting',
                                    'Safety',
                                    'Other'
                                  ]
                                      .map((v) => DropdownMenuItem(
                                          value: v, child: Text(v)))
                                      .toList(),
                                  onChanged: (v) =>
                                      update(() => category = v!)),
                              const SizedBox(height: 14),
                              DropdownButtonFormField<String>(
                                  initialValue: area,
                                  decoration:
                                      InputDecoration(labelText: copy('ui092')),
                                  items: [
                                    '',
                                    'Courtyard',
                                    'Playground',
                                    'Parking',
                                    'Gate'
                                  ]
                                      .map((v) => DropdownMenuItem(
                                          value: v,
                                          child: Text(
                                              v.isEmpty ? copy('ui084') : v)))
                                      .toList(),
                                  onChanged: (v) => update(() => area = v!)),
                              if (area.isEmpty) ...[
                                const SizedBox(height: 14),
                                Row(children: [
                                  Expanded(
                                      child: DropdownButtonFormField<int>(
                                          initialValue: entrance,
                                          decoration: InputDecoration(
                                              labelText: copy('ui093')),
                                          items: List.generate(
                                              building?['entrances'] ?? 3,
                                              (i) => DropdownMenuItem(
                                                  value: i + 1,
                                                  child: Text(
                                                      copy('ui015', [i + 1])))),
                                          onChanged: (v) =>
                                              update(() => entrance = v!))),
                                  const SizedBox(width: 12),
                                  Expanded(
                                      child: DropdownButtonFormField<int>(
                                          initialValue: floor,
                                          decoration: InputDecoration(
                                              labelText: copy('ui094')),
                                          items: List.generate(
                                              building?['floors'] ?? 9,
                                              (i) => DropdownMenuItem(
                                                  value: i + 1,
                                                  child: Text(
                                                      copy('ui015', [i + 1])))),
                                          onChanged: (v) =>
                                              update(() => floor = v!)))
                                ])
                              ],
                              const SizedBox(height: 20),
                              ...similarIssueWidgets(
                                  category, area, entrance, floor, dialog),
                              OutlinedButton.icon(
                                  onPressed: saving
                                      ? null
                                      : () async {
                                          update(() => saving = true);
                                          try {
                                            final p = await pickPhoto();
                                            if (p != null)
                                              update(() => photo = p);
                                          } catch (e) {
                                            update(() => message = '$e');
                                          } finally {
                                            if (c.mounted)
                                              update(() => saving = false);
                                          }
                                        },
                                  icon: Icon(photo.isEmpty
                                      ? Icons.add_a_photo
                                      : Icons.check_circle),
                                  label: Text(photo.isEmpty
                                      ? copy('ui085')
                                      : copy('ui086'))),
                              TextButton(
                                  onPressed: () => update(
                                      () => photo = '/media/seed/issue.png'),
                                  child: Text(copy('ui087'))),
                              if (message.isNotEmpty)
                                text(message, color: Colors.red)
                            ]))),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialog),
                          child: Text(copy('ui018'))),
                      FilledButton(
                          onPressed: saving || photo.isEmpty
                              ? null
                              : () async {
                                  update(() => saving = true);
                                  try {
                                    await api.request('/issues',
                                        method: 'POST',
                                        body: {
                                          'title': title.text,
                                          'description': description.text,
                                          'category': category,
                                          'location': {
                                            'entrance':
                                                area.isEmpty ? entrance : 0,
                                            'floor': area.isEmpty ? floor : 0,
                                            'area': area
                                          },
                                          'photo': photo
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
                          child: Text(saving ? copy('ui088') : copy('ui089')))
                    ])));
  }
}
