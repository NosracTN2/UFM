// Styles built on Lumiverse theme variables (with fallbacks), scoped under .ufl-*.

export const CSS = `
.ufl-root { --ufl-text: var(--lumiverse-text, #e8e6e3); --ufl-dim: var(--lumiverse-text-dim, #9a978f);
  --ufl-border: var(--lumiverse-border, rgba(255,255,255,.12)); --ufl-fill: var(--lumiverse-fill-subtle, rgba(255,255,255,.04));
  --ufl-accent: var(--lumiverse-primary, #c9a35b); --ufl-radius: var(--lumiverse-radius, 8px);
  --ufl-danger: #d1605a; --ufl-ok: #6fae6a; --ufl-mana: #5b8fd1; --ufl-hp: #c75a5a; --ufl-teth: #b48ad6; --ufl-blood: #8e1b26;
  color: var(--ufl-text); font-size: 13px; line-height: 1.4; display: flex; flex-direction: column; gap: 10px; padding: 10px; box-sizing: border-box; }
.ufl-root * { box-sizing: border-box; }
.ufl-section { border: 1px solid var(--ufl-border); border-radius: var(--ufl-radius); padding: 8px 10px; background: var(--ufl-fill); }
.ufl-h { margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ufl-dim); font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.ufl-title { font-size: 15px; font-weight: 600; margin: 0; }
.ufl-sub { color: var(--ufl-dim); font-size: 12px; }
.ufl-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ufl-grow { flex: 1 1 auto; min-width: 0; }
.ufl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
.ufl-stat { border: 1px solid var(--ufl-border); border-radius: 6px; padding: 4px 6px; }
.ufl-stat b { display: block; font-size: 15px; }
.ufl-stat small { color: var(--ufl-dim); }
.ufl-bar { position: relative; height: 20px; border-radius: 5px; background: rgba(127,127,127,.18); overflow: hidden; margin: 3px 0; }
.ufl-bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 5px; opacity: .85; transition: width .25s ease; }
.ufl-bar-hp .ufl-bar-fill { background: var(--ufl-hp); }
.ufl-bar-mana .ufl-bar-fill { background: var(--ufl-mana); }
.ufl-bar-teth .ufl-bar-fill { background: var(--ufl-teth); }
.ufl-bar-xp .ufl-bar-fill { background: var(--ufl-accent); }
.ufl-bar-text { position: relative; padding: 0 8px; font-size: 11.5px; line-height: 20px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.6); color: #fff; white-space: nowrap; }
.ufl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ufl-list li { padding: 3px 0; border-bottom: 1px dashed var(--ufl-border); }
.ufl-list li:last-child { border-bottom: 0; }
.ufl-badge { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; border: 1px solid var(--ufl-border); white-space: nowrap; }
.ufl-badge-active { border-color: var(--ufl-ok); color: var(--ufl-ok); }
.ufl-badge-slumbering { border-color: var(--ufl-mana); color: var(--ufl-mana); }
.ufl-badge-soul { border-color: var(--ufl-teth); color: var(--ufl-teth); }
.ufl-badge-lost, .ufl-badge-released { border-color: var(--ufl-dim); color: var(--ufl-dim); }
.ufl-badge-ready { border-color: var(--ufl-accent); color: var(--ufl-accent); animation: ufl-glow 1.6s ease-in-out infinite; }
@keyframes ufl-glow { 50% { box-shadow: 0 0 8px var(--ufl-accent); } }
.ufl-btn { appearance: none; border: 1px solid var(--ufl-border); background: transparent; color: var(--ufl-text); border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer; min-height: 28px; }
.ufl-btn:hover:not(:disabled) { border-color: var(--ufl-accent); }
.ufl-btn:disabled { opacity: .45; cursor: not-allowed; }
.ufl-btn-primary { background: var(--ufl-accent); color: #1a1408; border-color: transparent; font-weight: 600; }
.ufl-btn-danger { color: var(--ufl-danger); }
.ufl-btn-small { padding: 2px 7px; min-height: 24px; font-size: 11.5px; }
.ufl-input { width: 100%; background: rgba(127,127,127,.12); color: var(--ufl-text); border: 1px solid var(--ufl-border); border-radius: 6px; padding: 5px 8px; font-size: 13px; min-height: 30px; }
.ufl-input:focus { outline: 1px solid var(--ufl-accent); }
textarea.ufl-input { min-height: 64px; resize: vertical; }
.ufl-label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--ufl-dim); }
.ufl-empty { text-align: center; color: var(--ufl-dim); padding: 18px 8px; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.ufl-empty p { margin: 0; }
.ufl-warn { border-left: 3px solid var(--ufl-danger); padding: 3px 8px; margin: 3px 0; font-size: 12px; }
.ufl-warn code, .ufl-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; word-break: break-word; }
.ufl-event { border-left: 3px solid var(--ufl-accent); padding: 3px 8px; margin: 3px 0; font-size: 12px; }
.ufl-event.big { background: rgba(201,163,91,.12); font-weight: 600; }
.ufl-pillar { display: flex; gap: 6px; align-items: baseline; font-size: 12px; padding: 2px 0; }
.ufl-pillar .num { width: 22px; color: var(--ufl-dim); text-align: right; flex: none; }
.ufl-pillar.sealed { color: var(--ufl-dim); }
.ufl-pillar.stirring { color: var(--ufl-accent); font-style: italic; }
.ufl-pillar.open { font-weight: 600; }
.ufl-pillar.blocked { text-decoration: line-through; }
.ufl-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.ufl-tab { border: 1px solid var(--ufl-border); border-radius: 999px; padding: 2px 10px; font-size: 12px; background: transparent; color: var(--ufl-dim); cursor: pointer; min-height: 26px; }
.ufl-tab.on { color: var(--ufl-text); border-color: var(--ufl-accent); }
.ufl-card { border: 1px solid var(--ufl-border); border-radius: var(--ufl-radius); padding: 8px; display: flex; flex-direction: column; gap: 5px; background: var(--ufl-fill); }
.ufl-card.hand { border-color: var(--ufl-accent); box-shadow: 0 0 0 1px var(--ufl-accent) inset; }
.ufl-card.gone { opacity: .55; }
.ufl-card.ready { border-color: var(--ufl-accent); }
.ufl-card-head { display: flex; gap: 8px; align-items: center; }
.ufl-portrait { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex: none; background: rgba(127,127,127,.2); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--ufl-dim); }
.ufl-card-name { font-weight: 600; font-size: 13.5px; }
.ufl-card-meta { color: var(--ufl-dim); font-size: 11.5px; }
.ufl-card-actions { display: flex; gap: 4px; flex-wrap: wrap; }
.ufl-topbar { position: sticky; top: 0; z-index: 2; background: var(--lumiverse-bg-elevated, rgba(20,20,22,.96)); padding: 6px 0 8px; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid var(--ufl-border); }
.ufl-pending { border: 1px dashed var(--ufl-accent); border-radius: 6px; padding: 4px 8px; font-size: 12px; display: flex; gap: 6px; align-items: center; }
.ufl-kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 12px; }
.ufl-kv dt { color: var(--ufl-dim); }
.ufl-kv dd { margin: 0; }
.ufl-modal { display: flex; flex-direction: column; gap: 10px; color: var(--ufl-text); }
.ufl-choice { border: 1px solid var(--ufl-border); border-radius: 8px; padding: 8px; cursor: pointer; text-align: left; background: transparent; color: var(--ufl-text); width: 100%; }
.ufl-choice.on { border-color: var(--ufl-accent); box-shadow: 0 0 0 1px var(--ufl-accent) inset; }
.ufl-choice small { display: block; color: var(--ufl-dim); }
.ufl-scroll { max-height: 260px; overflow: auto; display: flex; flex-direction: column; gap: 4px; }
.ufl-blood { --ufl-accent: #b3202e; border-color: #6d1520 !important; background: linear-gradient(180deg, rgba(120,10,25,.25), rgba(40,0,8,.2)) !important; }
.ufl-hud { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 4px 6px; border-radius: 10px; background: rgba(15,15,18,.82); border: 1px solid rgba(255,255,255,.14); color: #fff; font-size: 11px; cursor: pointer; }
.ufl-hud .ufl-bar { height: 14px; margin: 0; }
.ufl-hud .ufl-bar-text { line-height: 14px; font-size: 10px; }
.ufl-cutaway { border: 1px dashed #8a7bd1; border-radius: 8px; padding: 8px 10px; margin: 8px 0; background: rgba(138,123,209,.08); }
.ufl-cutaway-h { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #a99be6; margin-bottom: 4px; }
@media (max-width: 640px) {
  .ufl-root { font-size: 14px; padding: 8px; }
  .ufl-btn { min-height: 34px; padding: 5px 10px; }
  .ufl-grid { grid-template-columns: repeat(3, 1fr); }
}
`;
