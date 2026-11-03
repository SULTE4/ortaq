part of 'app.dart';

extension BuildingUI on _WorkspaceState {
  Widget buildingView() => FutureBuilder<dynamic>(
      future: api.request('/invites'),
      builder: (context, snap) {
        final invites = (snap.data as List? ?? []);
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(copy('ui151'), size: 28, weight: FontWeight.w700),
          const SizedBox(height: 8),
          text(copy('ui152'), color: muted),
          const SizedBox(height: 22),
          Wrap(spacing: 12, runSpacing: 12, children: [
            button(copy('ui153'), () => createBuilding()),
            button(copy('ui154'), () => generateInvite())
          ]),
          const SizedBox(height: 24),
          if (snap.hasError)
            text(copy('ui015', [snap.error]), color: Colors.red),
          ...invites.map((i) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: card(Row(children: [
                const Icon(Icons.key, color: blue),
                const SizedBox(width: 18),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      text(copy('ui054', [i['apartment']]),
                          weight: FontWeight.w700),
                      SelectableText(i['code'],
                          style: const TextStyle(color: muted, fontSize: 12))
                    ])),
                if (i['revoked'] == true)
                  text(copy('ui155'), color: Colors.red)
                else
                  TextButton(
                      onPressed: () => action(() async {
                            await api.request('/invites/${i['code']}/revoke',
                                method: 'POST', body: {});
                            updateView(() {});
                          }),
                      child: Text(copy('ui156')))
              ]))))
        ]);
      });
  Future<void> generateInvite() async {
    final apt = TextEditingController();
    await showDialog<void>(
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
    final title = TextEditingController(),
        address = TextEditingController(),
        apts = TextEditingController(text: '120'),
        entrances = TextEditingController(text: '3'),
        floors = TextEditingController(text: '9');
    await showDialog<void>(
        context: context,
        builder: (c) => AlertDialog(
                title: Text(copy('ui153')),
                content: SizedBox(
                    width: 420,
                    child: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      field(title, copy('ui161')),
                      field(address, copy('ui162')),
                      field(apts, copy('ui032')),
                      field(entrances, copy('ui163')),
                      field(floors, copy('ui164'))
                    ]))),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c),
                      child: Text(copy('ui018'))),
                  TextButton(
                      onPressed: () {
                        Navigator.pop(c);
                        action(() async {
                          final b = await api
                              .request('/buildings', method: 'POST', body: {
                            'name': title.text,
                            'address': address.text,
                            'apartments': int.tryParse(apts.text) ?? 0,
                            'entrances': int.tryParse(entrances.text) ?? 0,
                            'floors': int.tryParse(floors.text) ?? 0
                          });
                          final u = await api.request('/me');
                          updateView(() {
                            building = Map<String, dynamic>.from(b);
                            me = Map<String, dynamic>.from(u);
                          });
                        });
                      },
                      child: Text(copy('ui165')))
                ]));
  }
}
