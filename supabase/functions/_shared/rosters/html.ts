// Deno-friendly HTML parsing helpers.
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

export function parseHtml(html: string): Document | null {
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
}

export function textContent(el: Element | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

export function attr(el: Element | null | undefined, name: string): string | null {
  const v = el?.getAttribute?.(name);
  return v == null ? null : v;
}

