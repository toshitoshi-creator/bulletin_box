"use client";

import { useEffect, useRef } from "react";

export interface PickerFrameProps {
  src: string;
  /** When false, hovering/clicking inside the frame does nothing. */
  enabled: boolean;
  /** Restrict picking to this element and its descendants (used while
   * picking fields relative to one already-chosen list item). */
  scopeEl?: Element | null;
  /** CSS selector to persistently outline (e.g. all matched list items). */
  persistentSelector?: string | null;
  onFrameLoad?: (doc: Document) => void;
  onPick?: (el: Element) => void;
}

const HOVER_OUTLINE = "2px solid #6366f1";
const PERSIST_OUTLINE = "2px solid #22c55e";
const PERSIST_BG = "rgba(34,197,94,0.10)";

/** Renders our own sanitized same-origin proxy of an external page
 * (/api/rules/render) inside an iframe, and wires up hover/click handling
 * directly against `iframe.contentDocument` so the parent wizard can turn
 * taps into CSS selectors. Nothing from the source site ever executes:
 * the proxy route already stripped all scripts server-side. */
export function PickerFrame({ src, enabled, scopeEl, persistentSelector, onFrameLoad, onPick }: PickerFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef({ enabled, scopeEl, onPick });
  const hoveredRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    stateRef.current = { enabled, scopeEl, onPick };
  }, [enabled, scopeEl, onPick]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Elements from the iframe's own document belong to a different realm
    // than this parent script, so `el instanceof HTMLElement` (which checks
    // against *this* window's HTMLElement constructor) always fails for
    // them. Check nodeType instead, which is realm-independent.
    function isPickable(doc: Document, el: Element | null): el is HTMLElement {
      if (!el || el.nodeType !== 1) return false;
      if (el === doc.documentElement || el === doc.body) return false;
      const scope = stateRef.current.scopeEl;
      if (scope && el !== scope && !scope.contains(el)) return false;
      return true;
    }

    function handleLoad() {
      const doc = iframe!.contentDocument;
      if (!doc) return;
      onFrameLoad?.(doc);

      // On iOS Safari a tap on plain text (a title, a date — anything
      // without a native "clickable" affordance) is easily swallowed by
      // the default text-selection/callout gesture instead of producing a
      // click, and `cursor: pointer` — which signals "this is tappable" to
      // WebKit — was previously only ever applied reactively on hover,
      // which doesn't fire before a touch tap. Apply both up front, on
      // every element, the moment the document loads.
      const style = doc.createElement("style");
      style.textContent = `
        * {
          cursor: pointer !important;
          -webkit-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }
      `;
      (doc.head ?? doc.documentElement).appendChild(style);

      function onMouseOver(e: MouseEvent) {
        if (!stateRef.current.enabled) return;
        const target = e.target as HTMLElement;
        if (!isPickable(doc!, target)) return;
        if (hoveredRef.current && hoveredRef.current !== target) {
          hoveredRef.current.style.outline = "";
        }
        target.style.outline = HOVER_OUTLINE;
        target.style.cursor = "pointer";
        hoveredRef.current = target;
      }
      function onMouseOut(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (hoveredRef.current === target) {
          target.style.outline = "";
          hoveredRef.current = null;
        }
      }
      function onClick(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!stateRef.current.enabled) return;
        const target = e.target as HTMLElement;
        if (!isPickable(doc!, target)) return;
        stateRef.current.onPick?.(target);
      }

      doc.addEventListener("mouseover", onMouseOver, true);
      doc.addEventListener("mouseout", onMouseOut, true);
      doc.addEventListener("click", onClick, true);
    }

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const prevMatches = doc.querySelectorAll("[data-rule-editor-match]");
    prevMatches.forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.background = "";
      el.removeAttribute("data-rule-editor-match");
    });
    if (!persistentSelector || !persistentSelector.trim()) return;
    try {
      const matches = doc.querySelectorAll(persistentSelector);
      matches.forEach((el) => {
        (el as HTMLElement).style.outline = PERSIST_OUTLINE;
        (el as HTMLElement).style.background = PERSIST_BG;
        el.setAttribute("data-rule-editor-match", "1");
      });
    } catch {
      // Selector may be mid-edit/invalid transiently; ignore.
    }
  });

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="ページプレビュー"
      className="h-full w-full border-0 bg-white"
      // allow-scripts is required for Safari/WebKit to treat this frame as
      // an interactive scripting realm at all: without it, WebKit doesn't
      // reliably dispatch touch-driven click events to listeners the
      // parent attaches onto contentDocument (this is fine in Chromium,
      // which is why it only shows up on iPhone). The proxy response's
      // `Content-Security-Policy: script-src 'none'` header is the actual
      // thing preventing any script from running — allow-scripts alone
      // does not re-enable script execution against that policy.
      sandbox="allow-same-origin allow-scripts"
    />
  );
}
