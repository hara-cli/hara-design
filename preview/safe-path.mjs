import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(base, candidate) {
  const rel = relative(base, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

// Resolve an existing URL path beneath a serving root. Lexical containment alone is insufficient:
// `/tmp/design-secret` also starts with `/tmp/design`, and an in-root symlink can resolve outside it.
// Returning the canonical path also prevents a later read from following the symlink again.
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
  if (!isWithin(base, candidate)) return null;

  try {
    const realBase = realpathSync(base);
    const realCandidate = realpathSync(candidate);
    return isWithin(realBase, realCandidate) ? realCandidate : null;
  } catch {
    // Missing/unreadable paths are not serveable and should become a normal 404.
    return null;
  }
}
