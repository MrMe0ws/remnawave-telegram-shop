import{j as f}from"./query-BjwzDfZs.js";import{r as g}from"./router-DG2ETBUV.js";import{i as m,u as $,v as T}from"./index-C-oU287q.js";import{E as K}from"./eye-off-DUKhMcd3.js";import{L as A}from"./link-2-D_AK1ay5.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8",key:"mg9rjx"}]],B=m("Bold",I);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1",key:"ezmyqa"}],["path",{d:"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1",key:"e1hn23"}]],j=m("Braces",M);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]],H=m("CodeXml",R);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=[["path",{d:"m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21",key:"182aya"}],["path",{d:"M22 21H7",key:"t4ddhn"}],["path",{d:"m5 11 9 9",key:"1mo9qw"}]],D=m("Eraser",O);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=[["line",{x1:"19",x2:"10",y1:"4",y2:"4",key:"15jd3p"}],["line",{x1:"14",x2:"5",y1:"20",y2:"20",key:"bu0au3"}],["line",{x1:"15",x2:"9",y1:"4",y2:"20",key:"uljnxc"}]],z=m("Italic",U);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=[["path",{d:"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"rib7q0"}],["path",{d:"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"1ymkrd"}]],P=m("Quote",V);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W=[["path",{d:"M16 4H9a3 3 0 0 0-2.83 4",key:"43sutm"}],["path",{d:"M14 12a4 4 0 0 1 0 8H6",key:"nlfj13"}],["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}]],X=m("Strikethrough",W);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=[["path",{d:"M6 4v6a6 6 0 0 0 12 0V4",key:"9kb039"}],["line",{x1:"4",x2:"20",y1:"20",y2:"20",key:"nun2al"}]],Q=m("Underline",G),F={B:"b",STRONG:"b",I:"i",EM:"i",U:"u",INS:"u",S:"s",STRIKE:"s",DEL:"s",CODE:"code"},J=3,Y=1,Z=new Set(["DIV","P","SECTION","ARTICLE","LI","H1","H2","H3","H4"]),y="tg-spoiler",N="is-expandable";function k(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function C(o){const e=o.trim();return/^https?:\/\//i.test(e)||/^tg:\/\//i.test(e)?e:null}function L(o){const e=[],a=()=>{for(let s=e.length-1;s>=0;s--)if(e[s]!=="")return e[s].endsWith(`
`);return!0},u=()=>{a()||e.push(`
`)},c=s=>{s.childNodes.forEach(d=>{if(d.nodeType===J){e.push(k(d.nodeValue??""));return}if(d.nodeType!==Y)return;const l=d,p=l.tagName;if(p==="BR"){e.push(`
`);return}if(p==="BLOCKQUOTE"){u(),e.push(l.classList.contains(N)?"<blockquote expandable>":"<blockquote>"),c(l),e.push(`</blockquote>
`);return}if(p==="A"){const h=C(l.getAttribute("href")??"");if(!h){c(l);return}e.push(`<a href="${k(h)}">`),c(l),e.push("</a>");return}if(p==="SPAN"&&l.classList.contains(y)){e.push("<tg-spoiler>"),c(l),e.push("</tg-spoiler>");return}const b=F[p];if(b){e.push(`<${b}>`),c(l),e.push(`</${b}>`);return}if(Z.has(p)){u(),c(l),u();return}c(l)})};return c(o),e.join("").replace(/\n{3,}/g,`

`).trim()}const ee=["b","strong","i","em","u","ins","s","strike","del","code","pre"];function te(o){let e=k(o);for(const a of ee)e=e.replace(new RegExp(`&lt;${a}&gt;`,"gi"),`<${a}>`),e=e.replace(new RegExp(`&lt;/${a}&gt;`,"gi"),`</${a}>`);return e=e.replace(/&lt;tg-spoiler&gt;/gi,`<span class="${y}">`),e=e.replace(/&lt;\/tg-spoiler&gt;/gi,"</span>"),e=e.replace(/&lt;blockquote expandable&gt;/gi,`<blockquote class="${N}">`),e=e.replace(/&lt;blockquote&gt;/gi,"<blockquote>"),e=e.replace(/&lt;\/blockquote&gt;/gi,"</blockquote>"),e=e.replace(/&lt;a href=&quot;([^&]*)&quot;&gt;/gi,(a,u)=>{const c=C(u);return c?`<a href="${k(c)}" rel="noreferrer">`:a}),e=e.replace(/&lt;\/a&gt;/gi,"</a>"),e.replace(/\n/g,"<br>")}function ie(o){return[...o.replace(/<br\s*\/?>/gi,`
`).replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&amp;/g,"&").trim()].length}const w=[{cmd:"bold",icon:B,labelKey:"admin.broadcast.editor.bold",hint:"Ctrl+B",queryable:!0},{cmd:"italic",icon:z,labelKey:"admin.broadcast.editor.italic",hint:"Ctrl+I",queryable:!0},{cmd:"underline",icon:Q,labelKey:"admin.broadcast.editor.underline",hint:"Ctrl+U",queryable:!0},{cmd:"strikeThrough",icon:X,labelKey:"admin.broadcast.editor.strike",hint:"Ctrl+Shift+X",queryable:!0},"sep",{cmd:"mono",icon:H,labelKey:"admin.broadcast.editor.mono",hint:"Ctrl+Shift+M"},{cmd:"spoiler",icon:K,labelKey:"admin.broadcast.editor.spoiler",hint:"Ctrl+Shift+P"},"sep",{cmd:"quote",icon:P,labelKey:"admin.broadcast.editor.quote",hint:"Ctrl+Shift+."},{cmd:"quoteExpandable",icon:j,labelKey:"admin.broadcast.editor.quoteExpandable",hint:""},"sep",{cmd:"link",icon:A,labelKey:"admin.broadcast.editor.link",hint:"Ctrl+K"},{cmd:"clear",icon:D,labelKey:"admin.broadcast.editor.clear",hint:"Ctrl+Shift+N"}];function le({onChange:o,placeholder:e,initialHtml:a,resetKey:u,className:c}){const{t:s}=$(),d=g.useRef(null),[l,p]=g.useState({}),b=g.useCallback(()=>{const t=d.current;t&&o(L(t))},[o]);g.useEffect(()=>{const t=d.current;t&&(t.innerHTML=a?te(a):"",o(a?L(t):""))},[u]);const h=(t,n)=>{try{document.execCommand("styleWithCSS",!1,"false"),document.execCommand(t,!1,n)}catch{}},x=t=>{const n=d.current,r=window.getSelection();if(!n||!r||!r.rangeCount||r.isCollapsed)return;const i=r.getRangeAt(0);if(!n.contains(i.commonAncestorContainer))return;const S=t();try{S.appendChild(i.extractContents()),i.insertNode(S),i.selectNodeContents(S),r.removeAllRanges(),r.addRange(i)}catch{}},v=t=>{x(()=>{const n=document.createElement("blockquote");return t&&(n.className=N),n})},E=t=>{const n=d.current;if(n){switch(n.focus(),t){case"mono":x(()=>document.createElement("code"));break;case"spoiler":x(()=>{const r=document.createElement("span");return r.className=y,r});break;case"quote":v(!1);break;case"quoteExpandable":v(!0);break;case"link":{const r=window.prompt(s("admin.broadcast.editor.enterUrl")??"URL","https://");if(!r)return;const i=C(r);if(!i){window.alert(s("admin.broadcast.editor.badUrl"));return}h("createLink",i);break}case"clear":h("removeFormat"),h("unlink"),n.querySelectorAll(`.${y}, code, blockquote`).forEach(r=>{r.replaceWith(...Array.from(r.childNodes))});break;default:h(t)}b(),q()}},q=g.useCallback(()=>{const t={};for(const n of w)if(!(n==="sep"||!n.queryable))try{t[n.cmd]=document.queryCommandState(n.cmd)}catch{t[n.cmd]=!1}p(t)},[]);g.useEffect(()=>{const t=()=>{var i;const n=d.current,r=((i=window.getSelection())==null?void 0:i.anchorNode)??null;n&&r&&n.contains(r)&&q()};return document.addEventListener("selectionchange",t),()=>document.removeEventListener("selectionchange",t)},[q]);const _=t=>{if(!t.ctrlKey&&!t.metaKey)return;const n=t.key.toLowerCase();if(t.shiftKey){const i={x:"strikeThrough",m:"mono",p:"spoiler",n:"clear"}[n]??(n==="."||n===">"?"quote":void 0);i&&(t.preventDefault(),E(i));return}n==="k"&&(t.preventDefault(),E("link"))};return f.jsxs("div",{children:[f.jsx("div",{className:"flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/40 px-2 py-1.5",role:"toolbar","aria-label":s("admin.broadcast.editor.toolbar"),children:w.map((t,n)=>t==="sep"?f.jsx("span",{className:"mx-1 h-4 w-px bg-border","aria-hidden":!0},`sep-${n}`):f.jsx(ne,{label:s(t.labelKey),hint:t.hint,active:!!l[t.cmd],onRun:()=>E(t.cmd),children:f.jsx(t.icon,{className:"size-[15px]"})},t.cmd))}),f.jsx("div",{ref:d,contentEditable:!0,suppressContentEditableWarning:!0,role:"textbox","aria-multiline":"true","aria-label":e??s("admin.broadcast.compose"),"data-placeholder":e,onInput:b,onKeyDown:_,onBlur:b,className:T("cabinet-tg-text min-h-[132px] px-3 py-3 text-sm leading-relaxed outline-none","focus-visible:ring-2 focus-visible:ring-primary/50","empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",c)})]})}function ne({label:o,hint:e,active:a,onRun:u,children:c}){return f.jsx("button",{type:"button",title:e?`${o} · ${e}`:o,"aria-label":o,"aria-pressed":a,onMouseDown:s=>s.preventDefault(),onClick:u,className:T("grid size-7 place-items-center rounded-md border border-transparent transition-colors",a?"border-primary/40 bg-card text-primary":"text-muted-foreground hover:bg-card hover:text-foreground"),children:c})}export{D as E,y as S,le as T,N as a,te as r,ie as t};
