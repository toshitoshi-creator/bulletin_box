"use client";

/** Classes that look auto-generated/unstable (CSS-module hashes, "css-xyz123"
 * from styled-components, etc.) and shouldn't be trusted as a stable selector. */
function isStableClass(cls: string): boolean {
  if (!cls) return false;
  if (/^(css|sc|jss|emotion|styled)-[a-z0-9]{4,}$/i.test(cls)) return false;
  if (/^[a-z0-9]{6,}$/i.test(cls) && /\d/.test(cls) && /[a-z]/i.test(cls)) return false;
  return true;
}

function compoundSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(isStableClass);
  if (classes.length === 0) return tag;
  return `${tag}.${classes.map((c) => CSS.escape(c)).join(".")}`;
}

function nthChildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (siblings.length <= 1) return tag;
  const index = siblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}

/** Computes a CSS selector for `el` that's unique within `root`, preferring
 * a stable class-based compound selector and falling back to an nth-of-type
 * ancestor path when classes alone aren't unique enough. */
export function computeSelector(el: Element, root: ParentNode = document): string {
  const own = compoundSelector(el);
  if (matchCount(root, own) === 1) return own;

  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && depth < 8) {
    const part = compoundSelector(current) === "html" || compoundSelector(current) === "body"
      ? nthChildSelector(current)
      : compoundSelector(current);
    parts.unshift(part);
    const candidate = parts.join(" > ");
    if (matchCount(root, candidate) === 1) return candidate;
    current = current.parentElement;
    depth++;
  }

  // Last resort: full nth-of-type path from the element up to root.
  const pathParts: string[] = [];
  current = el;
  depth = 0;
  while (current && current !== root && depth < 12) {
    pathParts.unshift(nthChildSelector(current));
    current = current.parentElement;
    depth++;
  }
  return pathParts.join(" > ") || compoundSelector(el);
}

/** Computes a selector for `el` meant to be used relative to `scopeRoot`
 * (e.g. a title/link/image selector inside one list-item card): prefers a
 * short selector that resolves to exactly `el` when queried from scopeRoot. */
export function computeRelativeSelector(el: Element, scopeRoot: Element): string {
  if (el === scopeRoot) return ":self";

  const own = compoundSelector(el);
  const ownMatches = Array.from(scopeRoot.querySelectorAll(own));
  if (ownMatches.length === 1 && ownMatches[0] === el) return own;

  // Build a path relative to scopeRoot instead of the whole document.
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current !== scopeRoot && depth < 8) {
    parts.unshift(nthChildSelector(current));
    const candidate = parts.join(" > ");
    const matches = Array.from(scopeRoot.querySelectorAll(candidate));
    if (matches.length === 1 && matches[0] === el) return candidate;
    current = current.parentElement;
    depth++;
  }
  return parts.join(" > ") || own;
}

export function matchCount(root: ParentNode, selector: string): number {
  if (!selector.trim()) return 0;
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

export function describeElement(el: Element): { tag: string; className: string; text: string } {
  return {
    tag: el.tagName.toLowerCase(),
    className: el.getAttribute("class") ?? "",
    text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
  };
}
