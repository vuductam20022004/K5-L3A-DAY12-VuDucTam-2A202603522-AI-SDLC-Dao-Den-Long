export const ACTION_LABELS = {forward:'Đi tới',backward:'Đi lùi',left:'Sang trái',right:'Sang phải',jump:'Nhảy',dash:'Lướt',interact:'Tương tác',pulse:'Tỏa Sáng',pause:'Tạm dừng'} as const;
export type Action=keyof typeof ACTION_LABELS;
export type Bindings=Record<Action,string>;
export const DEFAULT_BINDINGS:Bindings={forward:'w',backward:'s',left:'a',right:'d',jump:' ',dash:'shift',interact:'e',pulse:'q',pause:'p'};
export function keyLabel(key:string):string {return key===' '?'Space':key==='escape'?'Esc':key.toUpperCase();}
export function setBinding(bindings:Bindings,action:Action,key:string):Bindings {
  const normalized=key.toLowerCase();
  if(!normalized || ['control','alt','meta','dead','unidentified'].includes(normalized))throw new Error('Chọn một phím riêng, không dùng tổ hợp Ctrl/Alt');
  const other=(Object.keys(bindings) as Action[]).find(a=>a!==action&&bindings[a]===normalized);
  if(other)throw new Error(`Trùng phím với “${ACTION_LABELS[other]}”`);
  return {...bindings,[action]:normalized};
}
export function parseBindings(raw:unknown):Bindings {
  if(!raw||typeof raw!=='object')return {...DEFAULT_BINDINGS};
  const b=raw as Bindings;
  if((Object.keys(DEFAULT_BINDINGS) as Action[]).some(a=>typeof b[a]!=='string'||!b[a]||b[a].length>20))return {...DEFAULT_BINDINGS};
  const normalized=Object.fromEntries((Object.keys(DEFAULT_BINDINGS) as Action[]).map(a=>[a,b[a].toLowerCase()])) as Bindings;
  return new Set(Object.values(normalized)).size===9?normalized:{...DEFAULT_BINDINGS};
}
