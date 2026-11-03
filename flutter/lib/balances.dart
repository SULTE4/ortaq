part of 'app.dart';

extension BalanceUI on _WorkspaceState {
  Widget balancesView() {
    if (!widget.admin) {
      final b = data['balance'] ?? {'amount': 0};
      final amount = b['amount'] as num;
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui041'), size: 28, weight: FontWeight.w700),
        const SizedBox(height: 12),
        text(copy('ui042'), color: muted),
        const SizedBox(height: 24),
        card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          text(copy('ui043', [me?['apartment']]),
              size: 11, color: muted, weight: FontWeight.w700),
          const SizedBox(height: 22),
          text(kzt(amount.abs()),
              size: 38,
              weight: FontWeight.w700,
              color: amount < 0 ? const Color(0xFFDC6A70) : blue),
          const SizedBox(height: 8),
          text(
              amount < 0
                  ? copy('ui044')
                  : amount > 0
                      ? copy('ui045')
                      : copy('ui046'),
              weight: FontWeight.w600),
          const SizedBox(height: 22),
          text(copy('ui047'), color: muted)
        ]))
      ]);
    }
    final rows = data['balances'] as List? ?? [];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(copy('ui048'), size: 28, weight: FontWeight.w700),
      const SizedBox(height: 8),
      text(copy('ui049'), color: muted),
      const SizedBox(height: 22),
      button(
          copy('ui050'),
          () => action(() async {
                final files = await FilePicker.platform.pickFiles(
                    type: FileType.custom,
                    allowedExtensions: ['csv'],
                    withData: true);
                if (files == null) return;
                final f = files.files.single;
                if (f.bytes == null) throw Exception(copy('ui051'));
                final count = await api.importBalances(f.bytes!, f.name);
                await refresh();
                if (mounted)
                  ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(copy('ui052', [count]))));
              }),
          icon: Icons.upload_file),
      const SizedBox(height: 14),
      text(copy('ui053'), size: 12, color: muted),
      const SizedBox(height: 24),
      ...rows.map((b) {
        final amount = b['amount'] as num;
        return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: card(Row(children: [
              const Icon(Icons.apartment, color: muted),
              const SizedBox(width: 14),
              Expanded(
                  child: text(copy('ui054', [b['apartment']]),
                      weight: FontWeight.w600)),
              text(
                  amount < 0
                      ? copy('ui055')
                      : amount > 0
                          ? copy('ui056')
                          : copy('ui057'),
                  size: 12,
                  color: amount < 0
                      ? const Color(0xFFD96873)
                      : const Color(0xFF1A9474)),
              const SizedBox(width: 20),
              SizedBox(
                  width: 120,
                  child: Align(
                      alignment: Alignment.centerRight,
                      child: text(kzt(amount), weight: FontWeight.w700)))
            ])));
      })
    ]);
  }
}
