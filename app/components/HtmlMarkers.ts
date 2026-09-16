'use client';

/**
 * DOM markers on the globe, after COBE's CDN showcase: a small spinning pyramid pinned to a
 * place with a mono label chip above it, and a label pill sitting on the midpoint of an arc.
 * globe.gl positions the elements with a CSS2D renderer and tells us when the anchor turns to
 * the far side, where the marker fades and blurs out. Styles live in globals.css (`.gm-*`).
 *
 * Only a handful of places get one (the selected incident and its arcs, you, the open ASN);
 * every other incident keeps its dot and ring, so the globe never fills with labels.
 */

export type HtmlMarkerKind = 'pin' | 'arc';

export interface HtmlMarkerDatum {
  id: string;
  kind: HtmlMarkerKind;
  lat: number;
  lng: number;
  /** Globe radii above the surface. */
  altitude: number;
  text: string;
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

/** Element factory for globe.gl's `htmlElement`. Module-level so the layer is never rebuilt. */
export function makeMarkerElement(datum: object): HTMLElement {
  const d = datum as HtmlMarkerDatum;
  const root = document.createElement('div');
  root.className = 'gm';
  root.dataset.kind = d.kind;
  if (d.kind === 'pin') {
    root.innerHTML = `<div class="gm-stack"><div class="gm-pyramid"><i class="gm-face"></i><i class="gm-face"></i><i class="gm-face"></i><i class="gm-face"></i></div><span class="gm-label">${esc(d.text)}</span></div>`;
  } else {
    root.innerHTML = `<div class="gm-stack"><span class="gm-arc">${esc(d.text)}</span></div>`;
  }
  return root;
}

/** Fade + blur instead of a hard hide when the anchor is behind the globe. */
export function markerVisibility(el: HTMLElement, visible: boolean) {
  el.classList.toggle('is-hidden', !visible);
}
