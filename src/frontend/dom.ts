// Minimal element builder. Text always goes through textContent, never innerHTML.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, any>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value" && "value" in el) (el as HTMLInputElement).value = String(v);
      else if (k === "checked" && "checked" in el) (el as HTMLInputElement).checked = !!v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Element, children: (Child | Child[])[]): void {
  for (const c of children) {
    if (Array.isArray(c)) append(el, c);
    else if (c == null || c === false) continue;
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function bar(label: string, cur: number, max: number, kind: string): HTMLElement {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return h(
    "div",
    { class: `ufl-bar ufl-bar-${kind}`, title: `${label} ${cur}/${max}` },
    h("div", { class: "ufl-bar-fill", style: { width: `${pct}%` } }),
    h("span", { class: "ufl-bar-text" }, `${label} ${fmt(cur)}/${fmt(max)}`),
  );
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function section(title: string, ...children: (Child | Child[])[]): HTMLElement {
  return h("section", { class: "ufl-section" }, h("h4", { class: "ufl-h" }, title), ...children);
}

export function empty(text: string, ...extra: Child[]): HTMLElement {
  return h("div", { class: "ufl-empty" }, h("p", null, text), ...extra);
}

export function button(label: string, onClick: () => void, opts: { disabled?: boolean; title?: string; kind?: string } = {}): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: `ufl-btn ${opts.kind ? `ufl-btn-${opts.kind}` : ""}`, disabled: opts.disabled, title: opts.title, onclick: onClick },
    label,
  );
}

export function select(options: { value: string; label: string }[], value: string, onChange: (v: string) => void, attrs: Attrs = {}): HTMLSelectElement {
  const el = h("select", { class: "ufl-input", ...attrs, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) }, options.map((o) => h("option", { value: o.value }, o.label)));
  el.value = value;
  return el;
}

export function input(value: string, onInput: (v: string) => void, attrs: Attrs = {}): HTMLInputElement {
  return h("input", { class: "ufl-input", value, ...attrs, oninput: (e: Event) => onInput((e.target as HTMLInputElement).value) });
}
