# Changelog

All notable changes to hara-design are documented here.

## 0.3.7 - 2026-07-13

### Security

- Prevent the preview server from following file, directory, or implicit `index.html` symlinks outside the configured serving root.
- Keep traversal and malformed URL escapes on the normal 404 path without exposing files or crashing the server.

### Fixed

- Synchronize the package and plugin versions and correct the advertised design-system count to 150.
- Treat `help`, `--help`, and `-h` as successful CLI input, and run bundled scripts with the current Node.js executable.

### Release

- Validate package, plugin, and tag versions before publishing, and require tests plus package inspection across supported Node.js releases.
