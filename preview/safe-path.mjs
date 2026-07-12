import { isAbsolute, relative, resolve, sep } from "node:path";

// Resolve a URL path beneath a serving root. A plain startsWith(root) check is insufficient:
// `/tmp/design-secret` also starts with `/tmp/design`, and malformed percent escapes can throw.
export function safeJoin(root, urlPath) {
  if (typeof urlPath !== "string") return null;
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const base = resolve(root);
  const candidate = resolve(base, decoded.replace(/^[/\\]+/, ""));
  const rel = relative(base, candidate);
  if (rel === "") return candidate;
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return candidate;
}
