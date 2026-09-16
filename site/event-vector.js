const median=a=>{const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
/** Retrospective overall progression, not advection or a measured trajectory. */
export function eventVector(event, centers) {
  const points=centers.map((p,i)=>p?{...p,t:event.frames[i].time_h}:null).filter(Boolean);
  const base={method:'robust whole-event rainfall progression',uses_future_intervals:true,positions:[],note:'Arrow extends a fitted overall direction to the map edges; it does not imply observed travel across the entire map or represent storm speed.'};
  if(points.length<3)return {...base,available:false,reason:'Too few wet intervals'};
  const span=points.at(-1).t-points[0].t, sx=[],sy=[];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const dt=points[j].t-points[i].t;
    if(dt>0&&dt>=span/4){sx.push((points[j].x_km-points[i].x_km)/dt);sy.push((points[j].y_km-points[i].y_km)/dt);}
  }
  if(!sx.length)return {...base,available:false,reason:'Insufficient time separation'};
  const vx=median(sx),vy=median(sy),speed=Math.hypot(vx,vy),g=event.grid;
  const resolution=Math.max(Math.abs(g.x_km[1]-g.x_km[0]),Math.abs(g.y_km[1]-g.y_km[0]));
  if(speed*span<resolution)return {...base,available:false,reason:'No clear net progression at this grid resolution'};
  const anchor={x_km:median(points.map(p=>p.x_km)),y_km:median(points.map(p=>p.y_km))};
  const dx=vx/speed,dy=vy/speed;
  const bounds=[g.x_km[0]-(g.x_km[1]-g.x_km[0])/2,g.x_km.at(-1)+(g.x_km[1]-g.x_km[0])/2,g.y_km[0]-(g.y_km[1]-g.y_km[0])/2,g.y_km.at(-1)+(g.y_km[1]-g.y_km[0])/2];
  let lo=-Infinity,hi=Infinity;
  for(const [v,p,min,max] of [[dx,anchor.x_km,bounds[0],bounds[1]],[dy,anchor.y_km,bounds[2],bounds[3]]])if(Math.abs(v)>1e-10){const a=(min-p)/v,b=(max-p)/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
  const at=t=>({x_km:anchor.x_km+t*dx,y_km:anchor.y_km+t*dy});
  return {...base,available:true,start:at(lo),end:at(hi),bearing_deg:(Math.atan2(dx,dy)*180/Math.PI+360)%360,fit_displacement_km:speed*span,anchor};
}
