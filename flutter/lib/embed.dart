part of 'app.dart';

@JS('Object.is')
external bool _sameWindow(JSAny? a, JSAny? b);

extension EmbedUI on _WorkspaceState {
  String get threeDOrigin =>
      Uri(scheme: Uri.base.scheme, host: Uri.base.host, port: 8083).origin;
  Widget threeDEmbed({bool compact = false}) => ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: _ThreeDFrame(
          origin: threeDOrigin,
          token: api.token,
          admin: widget.admin,
          compact: compact));
  Widget threeDView() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        text(copy('ui095'), size: 28, weight: FontWeight.w700),
        const SizedBox(height: 8),
        text(copy('ui096'), color: muted),
        const SizedBox(height: 22),
        SizedBox(
            height: math.max(680.0, MediaQuery.sizeOf(context).height - 230),
            child: threeDEmbed())
      ]);
}

class _ThreeDFrame extends StatefulWidget {
  final String origin, token;
  final bool admin, compact;
  const _ThreeDFrame(
      {required this.origin,
      required this.token,
      required this.admin,
      required this.compact});
  @override
  State<_ThreeDFrame> createState() => _ThreeDFrameState();
}

class _ThreeDFrameState extends State<_ThreeDFrame> {
  web.HTMLIFrameElement? frame;
  late final JSFunction listener;
  @override
  void initState() {
    super.initState();
    listener = ((web.Event event) {
      final message = event as web.MessageEvent;
      if (message.origin != widget.origin ||
          !_sameWindow(message.source, frame?.contentWindow)) return;
      try {
        final payload = jsonDecode((message.data as JSString).toDart);
        if (payload['type'] == 'ortaq:ready') sendSession();
      } catch (_) {}
    }).toJS;
    web.window.addEventListener('message', listener);
  }

  void sendSession() {
    if (mounted)
      frame?.contentWindow?.postMessage(
          jsonEncode({'type': 'ortaq:session', 'token': widget.token}).toJS,
          widget.origin.toJS);
  }

  @override
  void didUpdateWidget(covariant _ThreeDFrame oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.token != widget.token) sendSession();
  }

  @override
  void dispose() {
    web.window.removeEventListener('message', listener);
    frame = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => HtmlElementView.fromTagName(
      tagName: 'iframe',
      onElementCreated: (Object element) {
        final iframe = element as web.HTMLIFrameElement;
        frame = iframe;
        iframe.src =
            '${widget.origin}/?embed=${widget.admin ? 'admin' : 'resident'}';
        iframe.title =
            widget.compact ? copy('iframeCompact') : copy('iframeFull');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
        iframe.allow = 'fullscreen';
        iframe.addEventListener(
            'load', ((web.Event event) => sendSession()).toJS);
      });
}
