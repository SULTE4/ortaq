part of 'app.dart';

extension DashboardUI on _WorkspaceState {
  String get residentHomeLabel {
    final apartment = (me?['apartment'] as num?)?.toInt() ?? 0;
    final location = buildingApartmentLocation(building, apartment);
    if (location == null) return '';
    return copy('homeApartment', [
      apartment,
      copy(location.rooms == 1 ? 'homeRoom' : 'homeRooms', [location.rooms]),
      location.entrance,
      location.floor
    ]);
  }

  Widget _statusChip(String status) {
    final color = status == 'Resolved'
        ? OrtaqColors.resolved
        : status == 'In Progress'
            ? OrtaqColors.inProgress
            : OrtaqColors.newIssue;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: Radii.pill,
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: 5),
        text(status, size: 11, color: color, weight: FontWeight.w700),
      ]),
    );
  }

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
    final pollVotes = polls.isEmpty
        ? 0
        : ((polls.first['total_votes'] as num?)?.toInt() ?? 0);
    final totalHomes = (building?['apartments'] as num?)?.toInt() ?? 120;

    final fundCard = InkWell(
      borderRadius: Radii.card,
      onTap: () => updateView(() => page = 'reports'),
      child: card(Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [
            windowMark(size: 14, color: OrtaqColors.homeGold),
            SizedBox(width: 9),
            Expanded(
                child: text(copy('newSharedFund'),
                    size: 13, color: muted, weight: FontWeight.w600)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                  color: OrtaqColors.surface2, borderRadius: Radii.pill),
              child: text(reports.isEmpty ? '-' : '${reports.first['month']}',
                  size: 11.5, color: snow, weight: FontWeight.w600),
            ),
          ]),
          SizedBox(height: 12),
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Expanded(
              child: count(
                'fund',
                total,
                (value) => text(kzt(value),
                    size: widget.admin ? 32 : 28, weight: FontWeight.w700),
                semanticLabel: kzt(total),
              ),
            ),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                  color: OrtaqColors.actionSoft, shape: BoxShape.circle),
              child: Icon(Icons.arrow_forward, color: blue, size: 18),
            ),
          ]),
          SizedBox(height: 10),
          count(
            'receipts',
            expenses.length,
            (value) => text(copy('newReceiptPromise', [value.round()]),
                size: 12.5, color: muted),
            semanticLabel: copy('newReceiptPromise', [expenses.length]),
          ),
        ],
      )),
    );

    final careRow = IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
          child: InkWell(
            borderRadius: Radii.card,
            onTap: () => updateView(() => page = 'issues'),
            child: card(Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (widget.admin)
                  text('OPEN TICKETS',
                      size: 11, color: muted, weight: FontWeight.w700),
                count(
                    'open',
                    open.length,
                    (value) => text('${value.round()}',
                        size: 32, weight: FontWeight.w700)),
                text(
                    widget.admin
                        ? 'Across ${building?['entrances'] ?? 3} entrances'
                        : copy('newNeedCare'),
                    size: widget.admin ? 12.5 : 13,
                    color: muted,
                    weight: FontWeight.w500),
              ],
            )),
          ),
        ),
        SizedBox(width: 12),
        Expanded(
          child: InkWell(
            borderRadius: Radii.card,
            onTap: () => updateView(() => page = 'issues'),
            child: card(Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (widget.admin)
                  text('RESOLVED',
                      size: 11,
                      color: OrtaqColors.resolved,
                      weight: FontWeight.w700),
                count(
                    'resolved',
                    resolved,
                    (value) => text('${value.round()}',
                        size: 32,
                        color: OrtaqColors.resolved,
                        weight: FontWeight.w700)),
                text(
                    widget.admin ? 'Closed this cycle' : copy('newTakenCare'),
                    size: widget.admin ? 12.5 : 13,
                    color: muted,
                    weight: FontWeight.w500),
              ],
            )),
          ),
        ),
      ]),
    );

    final addressText = building?['address'] ?? '';
    final residentMeta = residentHomeLabel.isNotEmpty
        ? (addressText.isNotEmpty
            ? '$addressText · $residentHomeLabel'
            : residentHomeLabel)
        : addressText;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(
          widget.admin
              ? copy('newAdminWelcome',
                  [addressText, building?['apartments'] ?? 0])
              : copy('newResidentWelcome',
                  [me?['name']?.split(' ').first ?? 'neighbour']),
          size: widget.admin ? 34 : 28,
          weight: FontWeight.w700),
      SizedBox(height: 6),
      text(
          widget.admin
              ? copy('newAdminIntro', [
                  addressText,
                  building?['apartments'] ?? 120,
                  building?['entrances'] ?? 3
                ])
              : residentMeta,
          size: widget.admin ? 14.5 : 13,
          color: muted),
      SizedBox(height: 18),
      if (widget.admin)
        LayoutBuilder(builder: (c, box) {
          final wide = box.maxWidth > 850;
          final journal = card(
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                  child:
                      text(copy('newCareToday'), size: 19, weight: FontWeight.w700)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                    color: OrtaqColors.actionSoft, borderRadius: Radii.pill),
                child: text('${open.length} open',
                    size: 11.5, color: blue, weight: FontWeight.w700),
              ),
            ]),
            SizedBox(height: 14),
            ...revealList(
                'journal',
                ([
                  ...open,
                  ...issues.where((i) => i['status'] == 'Resolved')
                ]).take(3).map((i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                        borderRadius: Radii.field,
                        onTap: () => issueDetails(i),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: OrtaqColors.surface2,
                            borderRadius: Radii.field,
                          ),
                          child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                      text(i['title'],
                                          size: 13.5, weight: FontWeight.w600),
                                      SizedBox(height: 4),
                                      Row(children: [
                                        _statusChip('${i['status']}'),
                                        SizedBox(width: 8),
                                        Expanded(
                                            child: text(location(i['location']),
                                                size: 11.5, color: muted)),
                                      ]),
                                    ])),
                                Icon(Icons.chevron_right, size: 18, color: muted)
                              ]),
                        ))))),
            if (wide) const Spacer() else const SizedBox(height: 4),
            TextButton(
                onPressed: () => updateView(() => page = 'issues'),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(copy('newOpenBoard')),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_forward, size: 15),
                ]))
          ]));
          return wide
              ? SizedBox(
                  height: 386,
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(flex: 7, child: homeScene()),
                        SizedBox(width: 20),
                        Expanded(flex: 4, child: journal)
                      ]),
                )
              : Column(children: [
                  homeScene(height: 280),
                  SizedBox(height: 16),
                  journal
                ]);
        })
      else
        homeScene(height: 190),
      SizedBox(height: 16),
      if (widget.admin)
        LayoutBuilder(builder: (c, box) {
          final wide = box.maxWidth > 900;
          final pollCard = polls.isEmpty
              ? SizedBox.shrink()
              : InkWell(
                  borderRadius: Radii.card,
                  onTap: () => updateView(() => page = 'polls'),
                  child: card(Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      text(copy('newOurSay').toUpperCase(),
                          size: 11, color: blue, weight: FontWeight.w700),
                      SizedBox(height: 8),
                      text(polls.first['question'],
                          size: 15.5, weight: FontWeight.w700),
                      SizedBox(height: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: Radii.pill,
                            child: LinearProgressIndicator(
                              value: (pollVotes / math.max(1, totalHomes))
                                  .clamp(0.0, 1.0),
                              minHeight: 7,
                              backgroundColor: OrtaqColors.surface2,
                              color: blue,
                            ),
                          ),
                          SizedBox(height: 8),
                          text('$pollVotes / $totalHomes neighbours voted',
                              size: 12.5, color: muted),
                        ],
                      ),
                    ],
                  )),
                );
          if (!wide) {
            return Column(children: [
              fundCard,
              SizedBox(height: 14),
              careRow,
              if (polls.isNotEmpty) ...[SizedBox(height: 14), pollCard],
            ]);
          }
          return IntrinsicHeight(
            child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(flex: 5, child: fundCard),
                  SizedBox(width: 16),
                  Expanded(flex: 4, child: careRow),
                  if (polls.isNotEmpty) ...[
                    SizedBox(width: 16),
                    Expanded(flex: 4, child: pollCard),
                  ],
                ]),
          );
        })
      else ...[
        fundCard,
        SizedBox(height: 12),
        careRow,
        SizedBox(height: 14),
        SizedBox(
            width: double.infinity,
            child: button(copy('newReportProblem'), () => reportIssue(),
                icon: Icons.add)),
        SizedBox(height: 20),
        residentPlanCard(),
      ],
      SizedBox(height: 24),
      Row(children: [
        Expanded(
            child: text(copy('newNoticeboard'),
                size: 20, weight: FontWeight.w700)),
        TextButton(
            onPressed: () => updateView(() => page = 'announcements'),
            child: Text(copy('ui038')))
      ]),
      SizedBox(height: 10),
      if (news.isNotEmpty)
        InkWell(
            borderRadius: Radii.card,
            onTap: () => updateView(() => page = 'announcements'),
            child: card(
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              text(news.first['title'], size: 18, weight: FontWeight.w700),
              SizedBox(height: 10),
              reading(news.first['body'], size: 15),
              SizedBox(height: 14),
              Row(children: [
                windowMark(size: 13),
                SizedBox(width: 8),
                text(copy('newFromOsi'), size: 12, color: muted)
              ])
            ]))),
      SizedBox(height: 16),
      text(copy('newSignature'), size: 12, color: muted)
    ]);
  }

  Widget homeScene({double? height}) {
    final embed = threeDEmbed(compact: true);
    return Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
            color: OrtaqColors.surface2,
            borderRadius: Radii.card,
            border: Border.all(color: OrtaqColors.hairline)),
        child: Stack(
            fit: height == null ? StackFit.expand : StackFit.loose,
            children: [
              if (height != null) SizedBox(height: height, child: embed) else embed,
              Positioned(
                  top: 10,
                  right: 10,
                  child: IconButton.filledTonal(
                      tooltip: copy('newOpen3d'),
                      style: IconButton.styleFrom(
                          backgroundColor: OrtaqColors.surface,
                          foregroundColor: blue,
                          shape: RoundedRectangleBorder(
                              borderRadius: Radii.pill)),
                      onPressed: () =>
                          web.window.open('$threeDOrigin/?story=1', '_blank'),
                      icon: Icon(Icons.open_in_full, size: 17)))
            ]));
  }
}
