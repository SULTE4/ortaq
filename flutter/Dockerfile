FROM ghcr.io/cirruslabs/flutter:3.35.7 AS build
WORKDIR /app
COPY flutter/pubspec.yaml ./
RUN flutter pub get
COPY flutter/ ./
ARG ENTRYPOINT=lib/main_resident.dart
RUN flutter build web --release --target=$ENTRYPOINT --no-web-resources-cdn
FROM nginx:1.28-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html
