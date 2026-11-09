part of 'app.dart';

extension PlanImagesUI on _WorkspaceState {
  String? planAt(String key) =>
      (building?['plan_images'] as Map?)?[key] as String?;

  Future<void> uploadFloorPlan(String key) => action(() async {
        final result = await FilePicker.platform.pickFiles(
            type: FileType.custom,
            allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'],
            withData: true);
        if (result == null) return;
        final file = result.files.single;
        if (file.size > 10 * 1024 * 1024) throw Exception(copy('planTooLarge'));
        if (file.bytes == null) throw Exception(copy('ui118'));
        final updated = await api.uploadPlan(key, file.bytes!, file.name);
        updateView(() => building = updated);
      });

  Widget managementPlanCard(int position, {int? entrance}) {
    final rooms = (entrance == null
        ? buildingFloorPlan(building)
        : buildingPlanFor(building, entrance))[position];
    final key = entrance == null
        ? '$position'
        : buildingPlanKey(building, entrance, position);
    final url = planAt(key);
    final label = copy('planPosition', [
      copy(rooms == 1 ? 'floorPlanRoom' : 'floorPlanRooms', [rooms]),
      position + 1
    ]);
    return card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(
          entrance == null
              ? label
              : '${copy('entranceTitle', [entrance])} - $label',
          size: 18,
          weight: FontWeight.w600),
      SizedBox(height: 12),
      if (url == null)
        SizedBox(
            height: 140,
            child: Center(child: text(copy('planNoPlan'), color: muted)))
      else
        _PlanPreview(key: ValueKey(url), api: api, url: url),
      SizedBox(height: 10),
      Wrap(spacing: 8, children: [
        TextButton(
            onPressed: busy ? null : () => uploadFloorPlan(key),
            child: Text(copy(url == null ? 'planUpload' : 'planReplace'))),
        if (url != null)
          TextButton(
              onPressed: busy
                  ? null
                  : () => action(() async {
                        final updated = await api.request(
                            '/v1/building/plans/${Uri.encodeComponent(key)}',
                            method: 'DELETE');
                        updateView(() =>
                            building = Map<String, dynamic>.from(updated));
                      }),
              child: Text(copy('planRemove')))
      ]),
      text(copy('planFileHint'), size: 12, color: muted)
    ]));
  }

  Widget residentPlanCard() {
    final apartment = (me?['apartment'] as num?)?.toInt() ?? 0;
    final location = buildingApartmentLocation(building, apartment);
    final url = location == null ? null : planAt(location.key);
    return card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      text(copy('planTitle'), size: 20, weight: FontWeight.w600),
      SizedBox(height: 10),
      if (url == null)
        text(copy('planMissing'), color: muted)
      else ...[
        _PlanPreview(key: ValueKey(url), api: api, url: url, height: 210),
        SizedBox(height: 8),
        text(copy('planSource'), size: 12, color: muted)
      ]
    ]));
  }
}

class _PlanPreview extends StatefulWidget {
  final Api api;
  final String url;
  final double height;
  const _PlanPreview(
      {super.key, required this.api, required this.url, this.height = 140});
  @override
  State<_PlanPreview> createState() => _PlanPreviewState();
}

class _PlanPreviewState extends State<_PlanPreview> {
  String? blobURL;
  bool failed = false;
  bool get pdf => widget.url.endsWith('.pdf');

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => failed = false);
    try {
      final bytes = await widget.api.planBytes(widget.url);
      if (!mounted) return;
      final type = pdf
          ? 'application/pdf'
          : widget.url.endsWith('.jpg')
              ? 'image/jpeg'
              : widget.url.endsWith('.webp')
                  ? 'image/webp'
                  : 'image/png';
      final url = web.URL.createObjectURL(
          web.Blob([bytes.toJS].toJS, web.BlobPropertyBag(type: type)));
      setState(() => blobURL = url);
    } catch (_) {
      if (mounted) setState(() => failed = true);
    }
  }

  @override
  void dispose() {
    if (blobURL != null) web.URL.revokeObjectURL(blobURL!);
    super.dispose();
  }

  Widget image({bool cropFrame = false}) {
    if (!cropFrame) {
      return Image.network(blobURL!,
          fit: BoxFit.contain,
          semanticLabel: copy('planSource'),
          errorBuilder: (_, __, ___) => Center(child: Text(copy('planLoadError'))));
    }
    return FittedBox(
      fit: BoxFit.contain,
      child: ClipRRect(
        borderRadius: Radii.small,
        child: ClipRect(
          child: Transform.scale(
            scale: 1.20,
            alignment: const Alignment(0.14, 0.02),
            child: Image.network(blobURL!,
                semanticLabel: copy('planSource'),
                errorBuilder: (_, __, ___) =>
                    Center(child: Text(copy('planLoadError')))),
          ),
        ),
      ),
    );
  }

  Future<void> open() async {
    if (pdf) {
      web.window.open(blobURL!, '_blank', 'noopener');
      return;
    }
    await showCalmDialog<void>(
        context: context,
        builder: (c) => Dialog.fullscreen(
                child: SafeArea(
                    child: Column(children: [
              Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Expanded(child: Text(copy('planTitle'))),
                    IconButton(
                        tooltip: copy('planClose'),
                        onPressed: () => Navigator.pop(c),
                        icon: Icon(Icons.close))
                  ])),
              Text(copy('planSource'), textAlign: TextAlign.center),
              Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(copy('planZoomHint'),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: muted))),
              Expanded(
                  child: InteractiveViewer(
                      minScale: 1,
                      maxScale: 8,
                      child: SizedBox.expand(child: image())))
            ]))));
  }

  @override
  Widget build(BuildContext context) {
    final Widget child;
    if (failed) {
      child = Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(copy('planLoadError'), textAlign: TextAlign.center),
        TextButton(onPressed: load, child: Text(copy('planRetry')))
      ]));
    } else if (blobURL == null) {
      child = Center(
          child: Semantics(
              liveRegion: true,
              child: Text(copy('planLoading'),
                  style: TextStyle(color: muted))));
    } else if (pdf) {
      child = Center(
          child: TextButton.icon(
              onPressed: open,
              icon: Icon(Icons.picture_as_pdf),
              label: Text(copy('planPDF'))));
    } else {
      child = Semantics(
          button: true,
          label: copy('planOpen'),
          child: InkWell(
              onTap: open,
              child: Stack(fit: StackFit.expand, children: [
                image(cropFrame: true),
                Positioned(
                    right: 8,
                    bottom: 8,
                    child: IconButton.filledTonal(
                        style: IconButton.styleFrom(
                            backgroundColor: OrtaqColors.surface,
                            foregroundColor: OrtaqColors.linkAccent),
                        tooltip: copy('planOpen'),
                        onPressed: open,
                        icon: Icon(Icons.open_in_full, size: 17)))
              ])));
    }
    return SizedBox(
        height: widget.height,
        child: DecoratedBox(
            decoration: BoxDecoration(
                color: const Color(0xFFF6F9FC),
                borderRadius: Radii.field,
                border: Border.all(color: OrtaqColors.hairline)),
            child: ClipRRect(borderRadius: Radii.field, child: child)));
  }
}
