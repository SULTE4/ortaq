part of 'app.dart';

extension DashboardUI on _WorkspaceState {
  Widget dashboard() {
    final reports = data['reports'] as List? ?? [],
        issues = data['issues'] as List? ?? [],
        news = data['announcements'] as List? ?? [];
    final total = reports.isEmpty
        ? 0
        : currentExpenses(reports.first)
            .fold<num>(0, (sum, e) => sum + (e['amount'] as num));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(
          widget.admin
              ? copy('ui020')
              : copy('ui021', [me?['name']?.split(' ').first ?? 'neighbour']),
          size: widget.admin ? 34 : 28,
          weight: FontWeight.w700),
      const SizedBox(height: 8),
      text(widget.admin ? copy('ui022') : copy('ui023', [building?['name']]),
          color: muted),
      const SizedBox(height: 26),
      Container(
          width: double.infinity,
          padding: const EdgeInsets.all(25),
          decoration: BoxDecoration(
              color: navy, borderRadius: BorderRadius.circular(24)),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            text(copy('ui024'),
                size: 10,
                color: const Color(0xFF9FBCE1),
                weight: FontWeight.w700),
            const SizedBox(height: 12),
            text(widget.admin ? copy('ui025') : copy('ui026'),
                size: 30, color: Colors.white, weight: FontWeight.w700),
            const SizedBox(height: 18),
            const SizedBox(
                height: 150,
                width: 350,
                child: CustomPaint(painter: _BuildingArt())),
            const SizedBox(height: 14),
            text(copy('ui027', [building?['address'], building?['entrances']]),
                size: 11, color: const Color(0xFFB8CBE3))
          ])),
      const SizedBox(height: 20),
      if (!widget.admin) ...[
        SizedBox(height: 230, child: threeDEmbed(compact: true)),
        const SizedBox(height: 20)
      ],
      LayoutBuilder(
          builder: (c, box) => Wrap(spacing: 14, runSpacing: 14, children: [
                metric(
                    copy('ui028'),
                    kzt(total),
                    copy('ui029',
                        [reports.isEmpty ? '—' : reports.first['month']]),
                    Icons.pie_chart_outline,
                    () => updateView(() => page = 'reports'),
                    box.maxWidth),
                metric(
                    copy('ui030'),
                    '${issues.where((i) => i['status'] != 'Resolved').length}',
                    copy('ui031', [
                      issues.where((i) => i['status'] == 'Resolved').length
                    ]),
                    Icons.task_alt,
                    () => updateView(() => page = 'issues'),
                    box.maxWidth),
                metric(
                    widget.admin ? copy('ui032') : copy('ui033'),
                    widget.admin
                        ? '${building?['apartments']}'
                        : '${me?['apartment']}',
                    widget.admin ? copy('ui034') : copy('ui035'),
                    Icons.apartment,
                    () => updateView(() => page = 'balance'),
                    box.maxWidth)
              ])),
      const SizedBox(height: 24),
      Wrap(spacing: 8, runSpacing: 8, children: [
        ActionChip(
            avatar: const Icon(Icons.how_to_vote_outlined, size: 17),
            label: Text(copy('ui036')),
            onPressed: () => updateView(() => page = 'polls')),
        ActionChip(
            avatar: const Icon(Icons.chat_bubble_outline, size: 17),
            label: Text(copy('ui013')),
            onPressed: () => updateView(() => page = 'feedback'))
      ]),
      const SizedBox(height: 25),
      Row(children: [
        Expanded(child: text(copy('ui037'), size: 21, weight: FontWeight.w700)),
        TextButton(
            onPressed: () => updateView(() => page = 'announcements'),
            child: Text(copy('ui038')))
      ]),
      const SizedBox(height: 10),
      if (news.isNotEmpty)
        card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(copy('ui039'), size: 9, color: blue, weight: FontWeight.w700),
          const SizedBox(height: 10),
          text(news.first['title'], size: 18, weight: FontWeight.w700),
          const SizedBox(height: 10),
          text(news.first['body'], color: muted)
        ])),
      const SizedBox(height: 25),
      text(copy('ui040'), size: 21, weight: FontWeight.w700),
      const SizedBox(height: 12),
      ...issues.take(3).map(issueCard)
    ]);
  }

  Widget metric(String label, String value, String hint, IconData icon,
          VoidCallback tap, double width) =>
      SizedBox(
          width: width > 950
              ? (width - 28) / 3
              : width > 600
                  ? (width - 14) / 2
                  : width,
          child: InkWell(
              onTap: tap,
              borderRadius: BorderRadius.circular(20),
              child: card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(icon, color: blue, size: 20),
                      const SizedBox(width: 10),
                      text(label, color: muted, size: 12)
                    ]),
                    const SizedBox(height: 18),
                    text(value, size: 30, weight: FontWeight.w700),
                    const SizedBox(height: 8),
                    text(hint, size: 11, color: muted)
                  ]))));
}
