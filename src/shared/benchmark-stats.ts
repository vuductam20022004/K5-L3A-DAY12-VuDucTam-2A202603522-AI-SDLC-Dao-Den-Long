/** Statistical definitions from Ticket-04, independent of the renderer. */
export function frameStatistics(samples: number[]) {
  if(!samples.length || samples.some(x=>!Number.isFinite(x)||x<=0))throw new Error('Cần ít nhất một frame dt dương, hữu hạn');
  const sorted=[...samples].sort((a,b)=>a-b),frames=sorted.length;
  const sum=sorted.reduce((a,b)=>a+b,0),k=Math.max(1,Math.ceil(frames*0.01));
  return {avg_fps:1000*frames/sum,p1_low_fps:1000/(sorted.slice(-k).reduce((a,b)=>a+b,0)/k),frame_ms_p95:sorted[Math.ceil(frames*0.95)-1],frames};
}
