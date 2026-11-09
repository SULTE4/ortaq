part of 'app.dart';

extension BuildingUI on _WorkspaceState {
  Widget buildingView() => FutureBuilder<dynamic>(
      future: api.request('/invites'),
      builder: (context, snap) {
        final invites = (snap.data as List? ?? []);
        final sharedEntrances = [
          for (var e = 1; e <= buildingEntranceCount(building); e++)
            if (!buildingEntrancePlans(building).containsKey('$e')) e
        ];
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(copy('ui151'), size: 28, weight: FontWeight.w700),
          SizedBox(height: 8),
          text(copy('ui152'), color: muted),
          SizedBox(height: 22),
          card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            text(copy('floorPlanTitle'), size: 20, weight: FontWeight.w700),
            SizedBox(height: 8),
            text(copy('floorPlanHint'), color: muted),
            SizedBox(height: 14),
            _FloorPlanBlocks(plan: buildingFloorPlan(building)),
            for (var e = 1; e <= buildingEntranceCount(building); e++) ...[
              SizedBox(height: 12),
              text(
                  copy(
                      buildingEntrancePlans(building).containsKey('$e')
                          ? 'entranceOwn'
                          : 'entranceSame',
                      [e]),
                  color: muted),
              if (buildingEntrancePlans(building).containsKey('$e'))
                _FloorPlanBlocks(plan: buildingPlanFor(building, e)),
            ],
            SizedBox(height: 12),
            TextButton(
                onPressed: editFloorPlan, child: Text(copy('floorPlanEdit')))
          ])),
          SizedBox(height: 22),
          text(copy('planDocumentsHint'), color: muted),
          SizedBox(height: 14),
          if (buildingEntrancePlans(building).isEmpty)
            Wrap(spacing: 14, runSpacing: 14, children: [
              for (var i = 0; i < buildingFloorPlan(building).length; i++)
                SizedBox(width: 320, child: managementPlanCard(i)),
            ])
          else ...[
            // Entrances without their own floor share one set of documents.
            if (sharedEntrances.isNotEmpty) ...[
              text(
                  copy(
                      sharedEntrances.length == 1
                          ? 'entranceSame'
                          : 'entrancesShared',
                      [sharedEntrances.join(', ')]),
                  size: 20,
                  weight: FontWeight.w600),
              SizedBox(height: 12),
              Wrap(spacing: 14, runSpacing: 14, children: [
                for (var i = 0; i < buildingFloorPlan(building).length; i++)
                  SizedBox(width: 320, child: managementPlanCard(i)),
              ]),
              SizedBox(height: 18),
            ],
            for (var e = 1; e <= buildingEntranceCount(building); e++)
              if (!sharedEntrances.contains(e)) ...[
                text(copy('entranceOwn', [e]),
                    size: 20, weight: FontWeight.w600),
                SizedBox(height: 12),
                Wrap(spacing: 14, runSpacing: 14, children: [
                  for (var i = 0; i < buildingPlanFor(building, e).length; i++)
                    SizedBox(
                        width: 320, child: managementPlanCard(i, entrance: e)),
                ]),
                SizedBox(height: 18),
              ],
          ],
          SizedBox(height: 22),
          Wrap(spacing: 12, runSpacing: 12, children: [
            button(copy('ui153'), () => createBuilding()),
            button(copy('ui154'), () => generateInvite())
          ]),
          SizedBox(height: 24),
          if (snap.hasError)
            text(copy('ui015', [snap.error]), color: OrtaqColors.newIssue),
          ...revealList(
              'invites',
              invites.map((i) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: card(Row(children: [
                    Icon(Icons.key, color: blue),
                    SizedBox(width: 18),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          text(copy('ui054', [i['apartment']]),
                              weight: FontWeight.w700),
                          SelectableText(i['code'],
                              style:
                                  TextStyle(color: muted, fontSize: 12))
                        ])),
                    if (i['revoked'] == true)
                      text(copy('ui155'), color: OrtaqColors.newIssue)
                    else
                      TextButton(
                          onPressed: () => action(() async {
                                await api.request(
                                    '/invites/${i['code']}/revoke',
                                    method: 'POST',
                                    body: {});
                                updateView(() {});
                              }),
                          child: Text(copy('ui156')))
                  ])))))
        ]);
      });

  Future<void> editFloorPlan() async {
    var plan = buildingFloorPlan(building);
    final entrancePlans = buildingEntrancePlans(building);
    int total() => buildingApartmentTotal(
        plan,
        entrancePlans,
        buildingEntranceCount(building),
        (building?['floors'] as num?)?.toInt() ?? 0);
    var saving = false;
    var error = '';
    final updated = await showCalmDialog<Map<String, dynamic>>(
        context: context,
        barrierDismissible: false,
        builder: (c) => StatefulBuilder(
            builder: (c, change) => PopScope(
                canPop: !saving,
                child: AlertDialog(
                    title: Text(copy('floorPlanEdit')),
                    content: SizedBox(
                        width: 600,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              _FloorPlanEditor(
                                  plan: plan,
                                  enabled: !saving,
                                  onChanged: (value) =>
                                      change(() => plan = value)),
                              SizedBox(height: 12),
                              for (var e = 1;
                                  e <= buildingEntranceCount(building);
                                  e++) ...[
                                SwitchListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(copy(
                                      entrancePlans.containsKey('$e')
                                          ? 'entranceOwn'
                                          : 'entranceSame',
                                      [e])),
                                  subtitle: Text(copy('entranceSwitch')),
                                  value: entrancePlans.containsKey('$e'),
                                  onChanged: saving
                                      ? null
                                      : (own) => change(() {
                                            if (own) {
                                              entrancePlans['$e'] =
                                                  List<int>.from(plan);
                                            } else {
                                              entrancePlans.remove('$e');
                                            }
                                          }),
                                ),
                                if (entrancePlans.containsKey('$e'))
                                  _FloorPlanEditor(
                                      key: ValueKey('entrance-$e'),
                                      plan: entrancePlans['$e']!,
                                      enabled: !saving,
                                      onChanged: (value) => change(
                                          () => entrancePlans['$e'] = value)),
                              ],
                              Semantics(
                                  liveRegion: true,
                                  child: Text(copy('floorPlanTotal', [total()]),
                                      style: TextStyle(color: blue))),
                              if (total() < 1 || total() > 500)
                                Text(copy('floorPlanTotalLimit'),
                                    style: TextStyle(
                                        color: OrtaqColors.newIssue)),
                              if (error.isNotEmpty) ...[
                                SizedBox(height: 12),
                                Semantics(
                                    liveRegion: true,
                                    child: Text(error,
                                        style: TextStyle(
                                            color: OrtaqColors.newIssue)))
                              ]
                            ]))),
                    actions: [
                      TextButton(
                          onPressed: saving ? null : () => Navigator.pop(c),
                          child: Text(copy('ui018'))),
                      FilledButton(
                          onPressed: saving || total() < 1 || total() > 500
                              ? null
                              : () async {
                                  change(() {
                                    saving = true;
                                    error = '';
                                  });
                                  try {
                                    final value = await api.request('/building',
                                        method: 'PATCH',
                                        body: {
                                          'floor_plan': plan,
                                          'entrance_plans': entrancePlans,
                                          'apartments': total()
                                        });
                                    if (c.mounted)
                                      Navigator.pop(
                                          c, Map<String, dynamic>.from(value));
                                  } catch (e) {
                                    if (c.mounted)
                                      change(() {
                                        saving = false;
                                        error = e.toString();
                                      });
                                  }
                                },
                          child: Text(copy(
                              saving ? 'floorPlanSaving' : 'floorPlanSave')))
                    ]))));
    if (updated != null && mounted) updateView(() => building = updated);
  }

  Future<void> generateInvite() async {
    final apt = TextEditingController();
    await showCalmDialog<void>(
        context: context,
        builder: (c) => AlertDialog(
                title: Text(copy('ui157')),
                content: SizedBox(
                    width: 340,
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      field(apt, copy('ui158')),
                      text(copy('ui159'), color: muted)
                    ])),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c),
                      child: Text(copy('ui018'))),
                  TextButton(
                      onPressed: () {
                        Navigator.pop(c);
                        action(() async {
                          await api.request('/invites',
                              method: 'POST',
                              body: {'apartment': int.tryParse(apt.text) ?? 0});
                        });
                      },
                      child: Text(copy('ui160')))
                ]));
  }

  Future<void> createBuilding() async {
    final created = await showCalmDialog<Map<String, dynamic>>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _AddBuildingDialog(api: api, origin: threeDOrigin));
    if (created == null || !mounted) return;
    await action(() async {
      final user = await api.request('/me');
      updateView(() {
        building = created;
        me = Map<String, dynamic>.from(user);
      });
      await refresh();
    });
  }
}

class _AddBuildingDialog extends StatefulWidget {
  final Api api;
  final String origin;
  const _AddBuildingDialog({required this.api, required this.origin});

  @override
  State<_AddBuildingDialog> createState() => _AddBuildingDialogState();
}

class _AddBuildingDialogState extends State<_AddBuildingDialog> {
  final search = TextEditingController(),
      name = TextEditingController(),
      address = TextEditingController(),
      floors = TextEditingController(),
      entrances = TextEditingController();
  List<int> floorPlan = [3, 1, 2, 1, 3];
  int get apartmentTotal =>
      (int.tryParse(entrances.text) ?? 0) *
      math.max(0, (int.tryParse(floors.text) ?? 0) - 1).toInt() *
      floorPlan.length;
  final form = GlobalKey<FormState>();
  List<Map<String, dynamic>> results = [];
  Map<String, dynamic>? selected, focus;
  bool searching = false, saving = false;
  String error = '';

  @override
  void dispose() {
    for (final controller in [search, name, address, floors, entrances]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> findAddress() async {
    if (searching || saving) return;
    final query = search.text.trim();
    if (query.length < 2) {
      setState(() => error = copy('mapSearchRequired'));
      return;
    }
    setState(() {
      searching = true;
      error = '';
      results = [];
    });
    try {
      final value = await widget.api
          .request('/v1/geo/search?q=${Uri.encodeQueryComponent(query)}');
      if (!mounted) return;
      setState(() {
        results = (value as List)
            .map((row) => Map<String, dynamic>.from(row))
            .toList();
        if (results.isEmpty) error = copy('mapSearchEmpty');
      });
    } catch (e) {
      if (mounted) setState(() => error = mapError(e));
    } finally {
      if (mounted) setState(() => searching = false);
    }
  }

  String mapError(Object error) =>
      error is ApiError ? error.message : copy('mapUnavailable');

  void pickBuilding(Map<String, dynamic> value) {
    if (saving) return;
    if (value['already_managed'] == true) {
      setState(() {
        selected = null;
        error = copy('mapAlreadyManaged');
      });
      return;
    }
    // The iframe has its own session, but still validate the message shape.
    final ring = value['footprint'];
    if (value['osm_id'] is! num ||
        (value['osm_id'] as num) <= 0 ||
        value['lat'] is! num ||
        value['lon'] is! num ||
        ring is! List ||
        ring.length < 3 ||
        ring.length > 200 ||
        ring.any((point) =>
            point is! List ||
            point.length != 2 ||
            point.any((coordinate) => coordinate is! num))) {
      setState(() => error = copy('mapInvalidSelection'));
      return;
    }
    setState(() {
      selected = value;
      error = '';
      address.text = value['address'] as String? ?? '';
      final levels = (value['levels'] as num?)?.toInt() ?? 0;
      floors.text = levels > 0 ? '$levels' : '';
      name.clear();
      entrances.clear();
      floorPlan = [3, 1, 2, 1, 3];
    });
  }

  Future<void> saveBuilding() async {
    if (saving || selected == null || !form.currentState!.validate()) return;
    if (apartmentTotal < 1 || apartmentTotal > 500) {
      setState(() => error = copy('floorPlanTotalLimit'));
      return;
    }
    setState(() {
      saving = true;
      error = '';
    });
    try {
      final value =
          await widget.api.request('/v1/buildings', method: 'POST', body: {
        'name': name.text.trim(),
        'address': address.text.trim(),
        'entrances': int.parse(entrances.text),
        'apartments': apartmentTotal,
        'floor_plan': floorPlan,
        'floors': int.parse(floors.text),
        for (final key in ['osm_id', 'lat', 'lon', 'footprint'])
          key: selected![key]
      });
      if (mounted) Navigator.pop(context, Map<String, dynamic>.from(value));
    } catch (e) {
      if (mounted) setState(() => error = mapError(e));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget input(TextEditingController controller, String label,
          {int? maximum, int? maxLength, bool readOnly = false}) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextFormField(
              controller: controller,
              enabled: !saving,
              readOnly: readOnly,
              onChanged: (_) => setState(() {}),
              maxLength: maxLength,
              keyboardType:
                  maximum == null ? TextInputType.text : TextInputType.number,
              decoration: InputDecoration(labelText: label),
              validator: (value) {
                if (maximum != null) {
                  final number = int.tryParse(value ?? '');
                  if (controller == floors && number != null && number < 2) {
                    return copy('floorPlanFloorsRequired');
                  }
                  if (number == null || number < 1 || number > maximum) {
                    return copy('mapNumberRequired', [maximum]);
                  }
                } else if ((value ?? '').trim().isEmpty) {
                  return copy('mapFieldRequired');
                }
                return null;
              }));

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: !saving,
      child: AlertDialog(
          backgroundColor: navy,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
              borderRadius: Radii.card,
              side: BorderSide(color: OrtaqColors.hairline)),
          title: Text(copy('ui153')),
          content: SizedBox(
              width: 940,
              child: ConstrainedBox(
                  constraints: BoxConstraints(
                      maxHeight: math.max(
                          240, MediaQuery.sizeOf(context).height - 220)),
                  child: SingleChildScrollView(
                      child: Form(
                          key: form,
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(copy('mapIntro'),
                                    style: TextStyle(color: muted)),
                                SizedBox(height: 16),
                                TextField(
                                    controller: search,
                                    enabled: !saving,
                                    textInputAction: TextInputAction.search,
                                    onSubmitted: (_) => findAddress(),
                                    decoration: InputDecoration(
                                        labelText: copy('mapSearchLabel'),
                                        suffixIcon: IconButton(
                                            tooltip: copy('mapSearch'),
                                            onPressed: searching || saving
                                                ? null
                                                : findAddress,
                                            icon: Icon(Icons.search)))),
                                if (searching) const CalmLoading(linear: true),
                                ...results.map((result) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: Icon(Icons.place_outlined,
                                        color: blue),
                                    title: Text(result['label'] as String),
                                    onTap: saving
                                        ? null
                                        : () => setState(() {
                                              focus = {
                                                'lat': result['lat'],
                                                'lon': result['lon']
                                              };
                                              selected = null;
                                              results = [];
                                              error = '';
                                            }))),
                                if (error.isNotEmpty)
                                  Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 14),
                                      child: Semantics(
                                          liveRegion: true,
                                          child: Text(error,
                                              style: TextStyle(
                                                  color:
                                                      OrtaqColors.newIssue)))),
                                SizedBox(height: 16),
                                SizedBox(
                                    height:
                                        MediaQuery.sizeOf(context).width < 600
                                            ? 340
                                            : 410,
                                    child: ClipRRect(
                                        borderRadius: Radii.field,
                                        child: _ThreeDFrame(
                                            origin: widget.origin,
                                            token: widget.api.token,
                                            admin: true,
                                            compact: false,
                                            picker: true,
                                            focus: focus,
                                            onBuildingPicked: pickBuilding))),
                                if (selected != null) ...[
                                  SizedBox(height: 20),
                                  Text(copy('mapSelected'),
                                      style: TextStyle(
                                          color: blue,
                                          fontWeight: FontWeight.w700)),
                                  SizedBox(height: 12),
                                  if (selected!['address'] == '')
                                    Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 12),
                                        child: Text(copy('mapMissingAddress'),
                                            style:
                                                TextStyle(color: muted))),
                                  input(address, copy('ui162'),
                                      maxLength: 240,
                                      readOnly:
                                          (selected!['address'] as String? ??
                                                  '')
                                              .isNotEmpty),
                                  input(floors, copy('ui164'),
                                      maximum: 50,
                                      readOnly:
                                          ((selected!['levels'] as num?) ?? 0) >
                                              0),
                                  input(entrances, copy('ui163'), maximum: 10),
                                  _FloorPlanEditor(
                                      plan: floorPlan,
                                      enabled: !saving,
                                      onChanged: (value) =>
                                          setState(() => floorPlan = value)),
                                  SizedBox(height: 14),
                                  Semantics(
                                      liveRegion: true,
                                      child: Text(
                                          copy('floorPlanTotal',
                                              [apartmentTotal]),
                                          style: TextStyle(color: blue))),
                                  SizedBox(height: 14),
                                  input(name, copy('ui161'), maxLength: 120),
                                  Text(copy('mapInvites'),
                                      style: TextStyle(color: muted)),
                                ]
                              ]))))),
          actions: [
            TextButton(
                onPressed: saving ? null : () => Navigator.pop(context),
                child: Text(copy('ui018'))),
            FilledButton(
                onPressed: saving || selected == null ? null : saveBuilding,
                child: Text(copy(saving ? 'mapSaving' : 'mapAdd')))
          ]));
}

class _FloorPlanBlocks extends StatelessWidget {
  final List<int> plan;
  const _FloorPlanBlocks({required this.plan});
  @override
  Widget build(BuildContext context) =>
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (var i = 0; i < plan.length; i++)
          Semantics(
              label: copy('floorPlanPositionRooms', [
                i + 1,
                copy(plan[i] == 1 ? 'floorPlanRoom' : 'floorPlanRooms',
                    [plan[i]])
              ]),
              child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                      color: OrtaqColors.surface2,
                      borderRadius: Radii.small,
                      border: Border.all(color: OrtaqColors.hairline)),
                  child: Text(copy(
                      plan[i] == 1 ? 'floorPlanRoom' : 'floorPlanRooms',
                      [plan[i]]))))
      ]);
}

class _FloorPlanEditor extends StatelessWidget {
  final List<int> plan;
  final bool enabled;
  final ValueChanged<List<int>> onChanged;
  const _FloorPlanEditor(
      {super.key,
      required this.plan,
      required this.onChanged,
      this.enabled = true});

  @override
  Widget build(BuildContext context) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(copy('floorPlanTitle'),
                style:
                    TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            SizedBox(height: 8),
            Text(copy('floorPlanHint'), style: TextStyle(color: muted)),
            SizedBox(height: 16),
            CalmSelect<int>(
                key: ValueKey(plan.length),
                initialValue: plan.isEmpty ? null : plan.length,
                decoration: InputDecoration(labelText: copy('floorPlanCount')),
                items: [
                  for (var n = 1; n <= 12; n++)
                    DropdownMenuItem(value: n, child: Text('$n'))
                ],
                onChanged: enabled
                    ? (n) {
                        if (n == null) return;
                        onChanged(List.generate(
                            n, (i) => i < plan.length ? plan[i] : 2));
                      }
                    : null),
            SizedBox(height: 12),
            for (var i = 0; i < plan.length; i++)
              Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(copy('floorPlanPosition', [i + 1]),
                            style: TextStyle(color: muted)),
                        SizedBox(height: 6),
                        Wrap(spacing: 6, runSpacing: 6, children: [
                          for (var rooms = 1; rooms <= 5; rooms++)
                            ChoiceChip(
                                label: Text(copy(
                                    rooms == 1
                                        ? 'floorPlanRoom'
                                        : 'floorPlanRooms',
                                    [rooms])),
                                selected: plan[i] == rooms,
                                chipAnimationStyle:
                                    MediaQuery.disableAnimationsOf(context)
                                        ? ChipAnimationStyle(
                                            selectAnimation:
                                                AnimationStyle.noAnimation,
                                            enableAnimation:
                                                AnimationStyle.noAnimation)
                                        : null,
                                onSelected: enabled
                                    ? (_) {
                                        final updated = List<int>.from(plan);
                                        updated[i] = rooms;
                                        onChanged(updated);
                                      }
                                    : null)
                        ])
                      ]))
          ]);
}
