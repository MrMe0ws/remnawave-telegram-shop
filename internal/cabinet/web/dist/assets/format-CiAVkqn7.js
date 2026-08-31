import{i as o,b4 as n}from"./index-DYod2ONn.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]],h=o("Banknote",i);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]],u=o("LayoutGrid",a);function m(t){const e=Math.round(t*100)%100!==0;return`${t.toLocaleString(n(),{minimumFractionDigits:e?2:0,maximumFractionDigits:2})} ₽`}function s(t){return`${t.toLocaleString(n(),{maximumFractionDigits:2})}%`}function y(t){const[e,r]=t.split("-").map(Number);return!e||!r?t:new Date(Date.UTC(e,r-1,1)).toLocaleDateString(n(),{month:"short"})}function g(t){const[e,r]=t.split("-").map(Number);return!e||!r?t:new Date(Date.UTC(e,r-1,1)).toLocaleDateString(n(),{month:"long",year:"numeric"})}function f(t){if(!t)return"";const e=new Date(t);return Number.isFinite(e.getTime())?e.toLocaleDateString(n(),{day:"numeric",month:"long"}):""}function d(t){if(!t)return"";const e=new Date(t);return Number.isFinite(e.getTime())?e.toLocaleDateString(n(),{day:"numeric",month:"short"}):""}export{h as B,u as L,d as a,s as b,f as c,g as d,y as e,m as f};
