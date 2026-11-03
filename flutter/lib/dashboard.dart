part of 'app.dart';

extension DashboardUI on _WorkspaceState {
  Widget dashboard() {
    final reports = data['reports'] as List? ?? [],
        issues = data['issues'] as List? ?? [],
        news = data['announcements'] as List? ?? [],
        polls = data['polls'] as List? ?? [];
    final expenses =
        reports.isEmpty ? <dynamic>[] : currentExpenses(reports.first);
    final total = expenses.fold<num>(0, (sum, e) => sum + (e['amount'] as num));
    final open = issues.where((i) => i['status'] != 'Resolved').toList(),
        resolved = issues.length - open.length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(
          widget.admin
              ? copy('newAdminWelcome')
              : copy('newResidentWelcome',
                  [me?['name']?.split(' ').first ?? 'neighbour']),
          size: widget.admin ? 43 : 34,
          weight: FontWeight.w500),
      const SizedBox(height: 12),
      text(widget.admin ? copy('newAdminIntro') : building?['address'] ?? '',
          size: widget.admin ? 16 : 14, color: muted),
      const SizedBox(height: 27),
      if (widget.admin)
        LayoutBuilder(builder: (c, box) {
          final wide = box.maxWidth > 850;
          final stage = homeScene(height: wide ? 360 : 300);
          final journal = card(
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            text(copy('newCareToday'), size: 24, weight: FontWeight.w500),
            const SizedBox(height: 13),
            text(copy('newCareCount', [open.length]), size: 14, color: muted),
            const SizedBox(height: 18),
            ...open.take(2).map((i) => Padding(
                padding: const EdgeInsets.only(bottom: 15),
                child: InkWell(
                    onTap: () => issueDetails(i),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          text(i['title'], size: 16, weight: FontWeight.w500),
                          const SizedBox(height: 7),
                          text(location(i['location']), size: 12, color: muted)
                        ])))),
            TextButton(
                onPressed: () => updateView(() => page = 'issues'),
                child: Text(copy('newOpenBoard')))
          ]));
          return wide
              ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(flex: 7, child: stage),
                  const SizedBox(width: 22),
                  Expanded(flex: 4, child: journal)
                ])
              : Column(children: [stage, const SizedBox(height: 18), journal]);
        })
      else
        homeScene(height: 265),
      const SizedBox(height: 22),
      InkWell(
          onTap: () => updateView(() => page = 'reports'),
          child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(23),
              decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.all(Radius.circular(4))),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                          child: text(copy('newSharedFund'),
                              size: 14, color: muted)),
                      text(reports.isEmpty ? '—' : reports.first['month'],
                          size: 13, color: muted)
                    ]),
                    const SizedBox(height: 12),
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Expanded(
                          child: text(kzt(total),
                              size: widget.admin ? 42 : 31,
                              weight: FontWeight.w500)),
                      const Icon(Icons.arrow_forward, color: navy, size: 21)
                    ]),
                    const SizedBox(height: 12),
                    text(copy('newReceiptPromise', [expenses.length]),
                        size: 13, color: muted)
                  ]))),
      const SizedBox(height: 22),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
            child: InkWell(
                onTap: () => updateView(() => page = 'issues'),
                child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          text('${open.length}',
                              size: 37, weight: FontWeight.w500),
                          const SizedBox(height: 5),
                          text(copy('newNeedCare'), size: 14, color: muted)
                        ])))),
        Expanded(
            child: InkWell(
                onTap: () => updateView(() => page = 'issues'),
                child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          text('$resolved',
                              size: 37,
                              color: const Color(0xFF3B7B68),
                              weight: FontWeight.w500),
                          const SizedBox(height: 5),
                          text(copy('newTakenCare'), size: 14, color: muted)
                        ]))))
      ]),
      if (!widget.admin) ...[
        const SizedBox(height: 19),
        SizedBox(
            width: double.infinity,
            child: button(copy('newReportProblem'), () => reportIssue(),
                icon: Icons.add))
      ],
      const SizedBox(height: 32),
      Row(children: [
        Expanded(
            child: text(copy('newNoticeboard'),
                size: 25, weight: FontWeight.w500)),
        TextButton(
            onPressed: () => updateView(() => page = 'announcements'),
            child: Text(copy('ui038')))
      ]),
      const SizedBox(height: 12),
      if (news.isNotEmpty)
        InkWell(
            onTap: () => updateView(() => page = 'announcements'),
            child: card(
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              text(news.first['title'], size: 22, weight: FontWeight.w500),
              const SizedBox(height: 14),
              reading(news.first['body'], size: 17),
              const SizedBox(height: 20),
              Row(children: [
                windowMark(size: 13),
                const SizedBox(width: 9),
                text(copy('newFromOsi'), size: 12, color: muted)
              ])
            ]))),
      if (polls.isNotEmpty) ...[
        const SizedBox(height: 27),
        InkWell(
            onTap: () => updateView(() => page = 'polls'),
            child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(23),
                decoration: const BoxDecoration(
                    color: Color(0xFFDDE8E0),
                    borderRadius: BorderRadius.all(Radius.circular(4))),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      text(copy('newOurSay'),
                          size: 14, color: const Color(0xFF48695F)),
                      const SizedBox(height: 12),
                      text(polls.first['question'],
                          size: 23, weight: FontWeight.w500),
                      const SizedBox(height: 20),
                      Row(children: [
                        Expanded(
                            child: text(copy('newAdvisoryVote'),
                                size: 13, color: const Color(0xFF48695F))),
                        const Icon(Icons.arrow_forward, size: 21, color: navy)
                      ])
                    ])))
      ],
      const SizedBox(height: 26),
      Wrap(spacing: 15, runSpacing: 10, children: [
        TextButton(
            onPressed: () => updateView(() => page = 'balance'),
            child:
                Text(widget.admin ? s['balance']! : copy('newPrivateBalance'))),
        TextButton(
            onPressed: () => updateView(() => page = 'feedback'),
            child: Text(copy('ui013')))
      ]),
      const SizedBox(height: 15),
      text(copy('newSignature'), size: 12, color: muted)
    ]);
  }

  Widget homeScene({required double height}) => Container(
      clipBehavior: Clip.antiAlias,
      decoration:
          BoxDecoration(color: navy, borderRadius: BorderRadius.circular(4)),
      child: Stack(children: [
        SizedBox(height: height, child: threeDEmbed(compact: true)),
        Positioned(
            top: 12,
            right: 12,
            child: IconButton.filledTonal(
                tooltip: copy('newOpen3d'),
                style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF153642),
                    foregroundColor: const Color(0xFFE6CA97),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(3))),
                onPressed: () =>
                    web.window.open('$threeDOrigin/?story=1', '_blank'),
                icon: const Icon(Icons.open_in_full, size: 18)))
      ]));
}
