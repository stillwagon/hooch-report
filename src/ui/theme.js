export const T = {
  bg: "#1a2b1f", card: "#213628", deep: "#0f1a14",
  cream: "#f0e4c8", creamDim: "#c4b898", gold: "#d4a340",
  sienna: "#c4613a", sage: "#7a9b6d", moss: "#4a6b42",
  river: "#5a8fa8", border: "#2d4a35",
  muted: "#8a9a7c", danger: "#d4573a", ok: "#5a9b4a", warn: "#d49a30",
};
export const MONO = "'JetBrains Mono',monospace";
export const SERIF = "'Playfair Display',Georgia,serif";

export const scoreColor = s => s >= 7 ? T.ok : s >= 5 ? T.sage : s >= 3 ? T.warn : T.danger;
export const clarityColor = t => t === "Clear" ? T.ok : t === "Clearing" ? T.warn : t === "Stained" ? T.sienna : T.danger;
export const flowColor = level => level === "base" ? T.ok : level === "up" ? T.sage : level === "high" ? T.sienna : level === "blown" ? T.danger : T.muted;

export const ft = d => { try { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch { return "-"; } };
export const fmtLag = m => m === 0 ? "At dam" : m < 60 ? `${m}m` : (m % 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m / 60}h`);

export const GLOBAL_CSS = `
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${T.deep}}
body{font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;color:${T.cream}}
button,select,input{font-family:'DM Sans',sans-serif;outline:none}
a{color:${T.river}}
::-webkit-scrollbar{width:0;height:0}
`;
