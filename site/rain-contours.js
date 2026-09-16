/** Linear isolines on a consistently triangulated grid of cell centers.
 * No padding: lines stop at coverage edges; unknown samples leave gaps.
 */
export function contourSegments(grid, values, level) {
  const {nx,ny,x_km:xs,y_km:ys}=grid, segments=[];
  for(let r=0;r<ny-1;r++) for(let c=0;c<nx-1;c++) {
    const nodes=[[c,r],[c+1,r],[c+1,r+1],[c,r+1]].map(([x,y])=>({x:xs[x],y:ys[y],v:values[y*nx+x]}));
    for(const ids of [[0,1,2],[0,2,3]]) {
      const t=ids.map(i=>nodes[i]);
      if(t.some(p=>!Number.isFinite(p.v))) continue;
      const hits=[];
      for(let i=0;i<3;i++) {
        const a=t[i],b=t[(i+1)%3];
        if((a.v>=level)===(b.v>=level)) continue;
        const f=(level-a.v)/(b.v-a.v);
        hits.push({x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y)});
      }
      if(hits.length===2) segments.push(hits);
    }
  }
  return segments;
}
export function contourLayers(event, frame, history=true) {
  const layers=[];
  if(history) for(let i=0;i<frame;i++) {
    const age=event.frames[frame].time_h-event.frames[i].time_h;
    if(age>0 && age<=2) layers.push({age,level:1,values:event.frames[i].values});
  }
  for(const level of [1,5,10]) layers.push({age:0,level,values:event.frames[frame].values});
  return layers;
}
