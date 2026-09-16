const escapeHTML = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isNumeric = n => n !== null && n !== undefined && n !== '' && typeof n !== 'boolean' && Number.isFinite(Number(n));
const finite = (n, fallback = 0) => isNumeric(n) ? Number(n) : fallback;

function rainColor(value, maximum) {
  const t = Math.max(0, Math.min(1, value / Math.max(maximum, 0.001)));
  const stops = [[0,30,74,130],[.14,35,96,167],[.32,34,171,201],[.49,55,202,167],[.66,168,218,103],[.82,245,205,82],[1,246,132,61]];
  let low = stops[0], high = stops[1];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { low = stops[i-1]; high = stops[i]; break; }
  const f = (t - low[0]) / (high[0] - low[0]);
  const c = [1,2,3].map(i => Math.round(low[i] + (high[i]-low[i])*f));
  return `rgba(${c.join(',')},${Math.min(.95, t*7).toFixed(3)})`;
}

/** Render projected rainfall cells, optionally over a basemap in the same local km extent. */
export function drawStormMap(canvas, {grid = {}, values = [], centroids = [], frame = 0, max = 20, showTrack = true, showGrid = true, geography = null, basemapImage = null, showBoundary = true, rainOpacity = .58, basemapMode = 'imagery', regionFrame = null, regionTracks = [], selectedRegion = null, showRegions = true, fullRegionTrack = false, trailFrames = 3} = {}) {
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const width = Math.max(280, box.width || canvas.parentElement?.clientWidth || 600);
  const height = Math.max(240, box.height || 400);
  const ratio = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.fillStyle = '#111e2a'; ctx.fillRect(0,0,width,height);
  const xs = grid.x_km?.length ? grid.x_km.map(Number) : [0,1];
  const ys = grid.y_km?.length ? grid.y_km.map(Number) : [0,1];
  const xstep = xs.length > 1 ? Math.abs(xs[1]-xs[0]) : 1;
  const ystep = ys.length > 1 ? Math.abs(ys[1]-ys[0]) : 1;
  const geographic = geography && finite(geography.width_km) > 0 && finite(geography.height_km) > 0;
  const hasBasemap = Boolean(geographic && basemapMode !== 'grid' && basemapImage?.complete && basemapImage.naturalWidth > 0);
  const opacity = geographic ? Math.max(0,Math.min(1,finite(rainOpacity,.58))) : 1;
  const xmin = geographic ? 0 : Math.min(...xs)-xstep/2, xmax = geographic ? Number(geography.width_km) : Math.max(...xs)+xstep/2;
  const ymin = geographic ? 0 : Math.min(...ys)-ystep/2, ymax = geographic ? Number(geography.height_km) : Math.max(...ys)+ystep/2;
  const pad = {left:44, right:26, top:22, bottom:36};
  const availableW = width-pad.left-pad.right, availableH = height-pad.top-pad.bottom;
  const scale = Math.min(availableW/(xmax-xmin), availableH/(ymax-ymin));
  const mapW = scale*(xmax-xmin), mapH = scale*(ymax-ymin);
  const left = pad.left+(availableW-mapW)/2, top = pad.top+(availableH-mapH)/2;
  const X = x => left+(x-xmin)*scale, Y = y => top+mapH-(y-ymin)*scale;

  ctx.save(); ctx.beginPath(); ctx.rect(left,top,mapW,mapH); ctx.clip();
  const backdrop = ctx.createLinearGradient(left,top,left+mapW,top+mapH);
  backdrop.addColorStop(0,'#172b37'); backdrop.addColorStop(1,'#122330');
  ctx.fillStyle = backdrop; ctx.fillRect(left,top,mapW,mapH);
  if (hasBasemap) {
    // North is at the top of this raster; its bounds share the grid's projected origin.
    ctx.drawImage(basemapImage,X(0),Y(Number(geography.height_km)),Number(geography.width_km)*scale,Number(geography.height_km)*scale);
  } else if (!geographic) {
    // Decorative contours belong only to the unreferenced schematic view.
    ctx.lineWidth = .8;
    for (let k = -8; k < 30; k++) {
      ctx.beginPath();
      for (let p = 0; p <= 100; p++) {
        const x = left+mapW*p/100;
        const y = top+k*mapH/19+Math.sin(p/17+k*.18)*mapH*.06+Math.sin(p/7+k*.32)*mapH*.023;
        if (!p) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = k%4 === 0 ? 'rgba(130,165,174,.085)' : 'rgba(130,165,174,.045)'; ctx.stroke();
    }
  }
  const activeRegions = showRegions ? (regionFrame?.regions || []) : [];
  const selected = activeRegions.find(r => r.track_id === selectedRegion);
  const selectedCells = selected ? new Set(selected.runs.flatMap(([row,a,b]) => Array.from({length:b-a+1},(_,i) => row*xs.length+a+i))) : null;
  ctx.save(); ctx.globalAlpha = opacity;
  for (let row = 0; row < Math.min(ys.length,values.length); row++) {
    const vals = values[row] || [];
    for (let col = 0; col < Math.min(xs.length,vals.length); col++) {
      const value = finite(vals[col]);
      if (value <= 0) continue;
      ctx.globalAlpha = opacity * (selectedCells && !selectedCells.has(row*xs.length+col) ? .18 : 1);
      ctx.fillStyle = rainColor(value,max);
      ctx.fillRect(X(xs[col]-xstep/2),Y(ys[row]+ystep/2),xstep*scale+.2,ystep*scale+.2);
    }
  }
  ctx.restore();
  if (showGrid) {
    ctx.strokeStyle = hasBasemap ? 'rgba(230,242,247,.23)' : 'rgba(164,196,206,.13)'; ctx.lineWidth = 1; ctx.setLineDash([2,5]);
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(left+mapW*i/4,top); ctx.lineTo(left+mapW*i/4,top+mapH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left,top+mapH*i/4); ctx.lineTo(left+mapW,top+mapH*i/4); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  if (geographic && showBoundary && Array.isArray(geography.boundary)) {
    ctx.save(); ctx.beginPath();
    for (const ring of geography.boundary) {
      if (!Array.isArray(ring)) continue;
      const points = ring.filter(p => Array.isArray(p) && isNumeric(p[0]) && isNumeric(p[1]));
      if (points.length < 3) continue;
      points.forEach((p,i) => i ? ctx.lineTo(X(Number(p[0])),Y(Number(p[1]))) : ctx.moveTo(X(Number(p[0])),Y(Number(p[1]))));
      ctx.closePath();
    }
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(11,23,31,.8)'; ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#ffe4a1'; ctx.setLineDash([6,4]); ctx.stroke();
    ctx.restore();
  }
  const occupied = [];
  if (geographic && Array.isArray(geography.places)) {
    ctx.save(); ctx.font = `${mapW < 330 ? 9 : 10}px ui-sans-serif, system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (const place of geography.places) {
      if (!isNumeric(place.x_km) || !isNumeric(place.y_km) || !place.name) continue;
      const px = X(Number(place.x_km)), py = Y(Number(place.y_km));
      if (px < left+5 || px > left+mapW-5 || py < top+5 || py > top+mapH-5) continue;
      const label = String(place.name), labelW = ctx.measureText(label).width+9, labelH = 17;
      const options = [[px+6,py-9],[px-labelW-6,py-9],[px-labelW/2,py-24],[px-labelW/2,py+7]];
      const spot = options.find(([x,y]) => x >= left+3 && x+labelW <= left+mapW-3 && y >= top+3 && y+labelH <= top+mapH-3 && !occupied.some(r => x < r.x+r.w+3 && x+labelW+3 > r.x && y < r.y+r.h+3 && y+labelH+3 > r.y));
      ctx.beginPath(); ctx.arc(px,py,2.4,0,Math.PI*2); ctx.fillStyle = '#faf5e4'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#172a35'; ctx.stroke();
      if (!spot) continue;
      const [lx,ly] = spot; occupied.push({x:lx,y:ly,w:labelW,h:labelH});
      ctx.fillStyle = 'rgba(13,27,38,.78)'; ctx.beginPath(); ctx.roundRect(lx,ly,labelW,labelH,3); ctx.fill();
      ctx.fillStyle = '#f3f5ef'; ctx.fillText(label,lx+4.5,ly+labelH/2);
    }
    ctx.restore();
  }
  if (showTrack && centroids.length) {
    const valid = centroids.map((c,i) => c && isNumeric(c.x_km) && isNumeric(c.y_km) ? {x:X(Number(c.x_km)),y:Y(Number(c.y_km)),index:i} : null).filter(Boolean);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(240,251,255,.75)'; ctx.setLineDash([4,5]); ctx.beginPath();
    valid.forEach((c,i) => i && c.index === valid[i-1].index + 1 ? ctx.lineTo(c.x,c.y) : ctx.moveTo(c.x,c.y)); ctx.stroke(); ctx.setLineDash([]);
    valid.forEach(c => {
      if (c.index === frame) return;
      ctx.beginPath(); ctx.arc(c.x,c.y,2.1,0,Math.PI*2); ctx.fillStyle = c.index < frame ? '#d6ebee' : '#a2bdc7'; ctx.fill();
    });
    const active = valid.find(c => c.index === frame);
    if (active) {
      ctx.shadowColor = 'rgba(255,255,255,.35)'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(active.x,active.y,10,0,Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
      ctx.beginPath(); ctx.arc(active.x,active.y,5,0,Math.PI*2); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#174452'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      const label = 'Whole-grid centroid', textWidth = ctx.measureText(label).width;
      const labelW = textWidth+16, labelH = 25;
      const candidates = [[active.x+14,active.y-12],[active.x-labelW-14,active.y-12],[active.x-labelW/2,active.y-39],[active.x-labelW/2,active.y+15]];
      const spot = candidates.find(([x,y]) => x >= left+3 && x+labelW <= left+mapW-3 && y >= top+3 && y+labelH <= top+mapH-3 && !occupied.some(r => x < r.x+r.w+3 && x+labelW+3 > r.x && y < r.y+r.h+3 && y+labelH+3 > r.y));
      if (spot) {
        const [lx,ly] = spot;
        ctx.fillStyle = 'rgba(13,27,38,.92)'; ctx.beginPath(); ctx.roundRect(lx,ly,labelW,labelH,4); ctx.fill();
        ctx.fillStyle = '#e7f1f3'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label,lx+8,ly+13);
      }
    }
  }
  // Region positions use geometric centers. Weighted centers are reported in the panel.
  const hits = [];
  if (showRegions) {
    const visibleTracks = selectedRegion == null
      ? regionTracks.filter(t => activeRegions.some(r => r.track_id === t.id))
      : regionTracks.filter(t => t.id === selectedRegion);
    for (const track of visibleTracks) {
      const points = track.points.filter(p => fullRegionTrack || (p.frame <= frame && p.frame >= frame-trailFrames));
      const color = regionColor(track.id);
      for (let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i];
        if(b.frame!==a.frame+1)continue;
        ctx.beginPath();ctx.moveTo(X(a.x_km),Y(a.y_km));ctx.lineTo(X(b.x_km),Y(b.y_km));
        ctx.strokeStyle='#07131b';ctx.lineWidth=5;ctx.setLineDash([]);ctx.stroke();
        ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(b.frame>frame?[3,5]:[]);ctx.stroke();ctx.setLineDash([]);
      }
      for (const point of points) {
        ctx.beginPath();ctx.arc(X(point.x_km),Y(point.y_km),point.frame===frame?4:2.5,0,Math.PI*2);
        ctx.fillStyle=point.frame>frame?'#7d919e':color;ctx.fill();
      }
    }
    for (const region of activeRegions) {
      const cells = new Set(region.runs.flatMap(([row,a,b]) => Array.from({length:b-a+1},(_,i)=>row*xs.length+a+i)));
      ctx.save();ctx.globalAlpha=selectedRegion==null||region.track_id===selectedRegion?1:.35;
      ctx.beginPath();
      for(const cell of cells){
        const row=Math.floor(cell/xs.length),col=cell%xs.length;
        const x0=xs[col]-xstep/2,x1=xs[col]+xstep/2,y0=ys[row]-ystep/2,y1=ys[row]+ystep/2;
        if(col===0||!cells.has(cell-1)){ctx.moveTo(X(x0),Y(y0));ctx.lineTo(X(x0),Y(y1));}
        if(col===xs.length-1||!cells.has(cell+1)){ctx.moveTo(X(x1),Y(y0));ctx.lineTo(X(x1),Y(y1));}
        if(row===0||!cells.has(cell-xs.length)){ctx.moveTo(X(x0),Y(y0));ctx.lineTo(X(x1),Y(y0));}
        if(row===ys.length-1||!cells.has(cell+xs.length)){ctx.moveTo(X(x0),Y(y1));ctx.lineTo(X(x1),Y(y1));}
      }
      ctx.lineJoin='round';ctx.lineWidth=3.5;ctx.strokeStyle='#07131bd9';ctx.stroke();
      ctx.lineWidth=region.track_id===selectedRegion?2.1:1.3;ctx.strokeStyle=regionColor(region.track_id);ctx.stroke();
      const px=X(region.center.x_km),py=Y(region.center.y_km);
      const mark = ['split','merge','reorganization'].includes(region.status) ? ' '+region.status : region.status==='unresolved'?' ?':'';
      const label=`R${region.track_id}${mark}`;ctx.font='bold 10px system-ui';
      const w=ctx.measureText(label).width+12,h=20;
      const options=[[px+7,py-23],[px-w-7,py-23],[px+7,py+5],[px-w-7,py+5]];
      let spot=options.find(([x,y])=>x>=left&&x+w<=left+mapW&&y>=top&&y+h<=top+mapH&&!occupied.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y));
      if(!spot)spot=[Math.max(left+2,Math.min(left+mapW-w-2,px+7)),Math.max(top+2,Math.min(top+mapH-h-2,py-23))];
      const [lx,ly]=spot;occupied.push({x:lx,y:ly,w,h});
      ctx.fillStyle='#07131bed';ctx.fillRect(lx,ly,w,h);ctx.fillStyle=regionColor(region.track_id);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,lx+6,ly+h/2);
      ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='#fff';ctx.stroke();
      hits.push({id:region.track_id,cells,label:{x:lx,y:ly,w,h}});ctx.restore();
    }
  }
  // Hit-testing uses the same geometry as rendering, including letterboxing.
  canvas.regionHitTest=(clientX,clientY)=>{
    const b=canvas.getBoundingClientRect(),px=(clientX-b.left)*width/b.width,py=(clientY-b.top)*height/b.height;
    const label=hits.find(h=>px>=h.label.x&&px<=h.label.x+h.label.w&&py>=h.label.y&&py<=h.label.y+h.label.h);
    if(label)return label.id;
    if(px<left||px>=left+mapW||py<top||py>=top+mapH)return null;
    const col=Math.floor((xmin+(px-left)/scale-(xs[0]-xstep/2))/xstep);
    const row=Math.floor((ymin+(top+mapH-py)/scale-(ys[0]-ystep/2))/ystep);
    return hits.find(h=>h.cells.has(row*xs.length+col))?.id??null;
  };
  canvas.setAttribute('data-region-count',String(activeRegions.length));
  canvas.setAttribute('data-selected-region',selectedRegion==null?'':String(selectedRegion));
  ctx.restore();
  ctx.strokeStyle = 'rgba(137,170,184,.18)'; ctx.lineWidth = 1; ctx.strokeRect(left+.5,top+.5,mapW-1,mapH-1);
  ctx.fillStyle = '#708c9b'; ctx.font = '9px ui-monospace, SFMono-Regular, monospace'; ctx.textBaseline = 'middle';
  const fmt = n => Math.abs(n)<.001 ? '0' : Math.abs(n)<10 ? String(Math.round(n*10)/10) : String(Math.round(n));
  for (let i = 0; i <= 4; i++) {
    ctx.textAlign = 'center'; ctx.fillText(fmt(xmin+(xmax-xmin)*i/4),left+mapW*i/4,top+mapH+14);
    ctx.textAlign = 'right'; ctx.fillText(fmt(ymax-(ymax-ymin)*i/4),left-9,top+mapH*i/4);
  }
  ctx.textAlign = 'right'; ctx.fillStyle = '#8aa5b3'; ctx.fillText(geographic ? 'Easting from UTM origin (km)' : 'Easting (km)',left+mapW,top+mapH+29);
  if (geographic) {
    ctx.save(); ctx.translate(left-35,top+mapH/2); ctx.rotate(-Math.PI/2); ctx.textAlign = 'center'; ctx.fillText('Northing from UTM origin (km)',0,0); ctx.restore();
  }
  // Positive projected y is UTM grid north, which differs slightly from true north.
  const nx = left+mapW-18, ny = top+29;
  if (geographic) { ctx.fillStyle = 'rgba(13,27,38,.78)'; ctx.beginPath(); ctx.roundRect(nx-12,ny-24,24,39,4); ctx.fill(); }
  ctx.fillStyle = '#d4e4e9'; ctx.textAlign = 'center'; ctx.font = '10px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(geographic ? 'GN' : 'N',nx,ny-13);
  ctx.beginPath(); ctx.moveTo(nx,ny-4); ctx.lineTo(nx-4,ny+8); ctx.lineTo(nx,ny+5); ctx.lineTo(nx+4,ny+8); ctx.closePath(); ctx.fill();
  const unit = Math.pow(10,Math.floor(Math.log10((xmax-xmin)/5)));
  const scaleKm = Math.max(unit,Math.floor((xmax-xmin)/5/unit)*unit);
  const sx = left+13, sy = top+mapH-15;
  if (geographic) { ctx.fillStyle = 'rgba(13,27,38,.78)'; ctx.beginPath(); ctx.roundRect(sx-6,sy-22,scaleKm*scale+12,29,4); ctx.fill(); }
  ctx.fillStyle = '#d4e4e9';
  ctx.strokeStyle = '#aec5ce'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sx,sy-4); ctx.lineTo(sx,sy); ctx.lineTo(sx+scaleKm*scale,sy); ctx.lineTo(sx+scaleKm*scale,sy-4); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = '9px ui-monospace, SFMono-Regular, monospace'; ctx.fillText(`${fmt(scaleKm)} km`,sx,sy-11);
  canvas.setAttribute('role','img');
  canvas.setAttribute('data-geographic',String(Boolean(geographic)));
  canvas.setAttribute('data-basemap',hasBasemap ? basemapMode : 'grid');
  canvas.setAttribute('data-basemap-present',String(hasBasemap));
  canvas.setAttribute('data-rain-opacity',String(opacity));
  const reference = geographic ? `Rainfall grid over the Denver MHFD demonstration area, ${geography.crs || 'UTM Zone 13N'}. Coordinates are kilometres from the demonstration UTM origin; GN indicates grid north. ${hasBasemap ? basemapMode === 'topo' ? 'Topographic' : 'USGS imagery' : 'Plain grid'} background, rainfall opacity ${Math.round(opacity*100)} percent. ${showBoundary ? 'The gold dashed outline is the provisional MHFD district reference boundary.' : ''}` : 'Schematic projected rainfall grid.';
  canvas.setAttribute('aria-label',`${reference} Frame ${frame+1}. Rainfall ranges from 0 to ${max}. ${activeRegions.length} identified rainfall regions. ${showTrack ? 'The white dashed line shows the whole-grid centroid, not a tracked cell.' : ''}`);
}

function niceTick(value) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return `${Number((value/1000).toFixed(1))}k`;
  return String(Number(value.toFixed(Math.abs(value) < 1 ? 2 : 1)));
}

/** Responsive, dependency-free chart. All x/y coordinates must be numeric. */
export function chartSVG({series = [], xLabel = '', yLabel = '', height = 180, bar = false} = {}) {
  const width = typeof window !== 'undefined' && window.innerWidth < 700 ? Math.max(250, window.innerWidth - 120) : 620, H = Math.max(150,height), margin = {left:43,right:18,top:36,bottom:35};
  const W = width-margin.left-margin.right, plotH = H-margin.top-margin.bottom;
  const clean = series.map((s,i) => ({name:String(s.name || ''),color:s.color || ['#58d9ce','#ebbd70','#899ceb'][i%3],values:(s.values || []).filter(p => p && isNumeric(p.x) && isNumeric(p.y)).map(p => ({x:Number(p.x),y:Number(p.y)}))}));
  const points = clean.flatMap(s => s.values);
  if (!points.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="100%" height="${H}" role="img" aria-label="No chart data"><text x="310" y="${H/2}" fill="#8299a8" text-anchor="middle" font-size="12" font-family="system-ui, sans-serif">No data available</text></svg>`;
  const xmin = Math.min(...points.map(p=>p.x)), rawXmax = Math.max(...points.map(p=>p.x));
  const xmax = rawXmax === xmin ? xmin+1 : rawXmax;
  const ymin = Math.min(0,...points.map(p=>p.y));
  const rawMax = Math.max(0,...points.map(p=>p.y));
  const ymax = rawMax === ymin ? ymin+1 : rawMax*1.1;
  const X = x => margin.left+(x-xmin)/(xmax-xmin)*W, Y = y => margin.top+plotH-(y-ymin)/(ymax-ymin)*plotH;
  const f = n => n.toFixed(2);
  let html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="100%" height="${H}" preserveAspectRatio="none" style="display:block;overflow:visible" role="img" aria-label="${escapeHTML(yLabel || 'Value')} by ${escapeHTML(xLabel || 'time')}"><g font-family="ui-sans-serif,system-ui,sans-serif" font-size="10">`;
  for (let i = 0; i <= 3; i++) {
    const val = ymin+(ymax-ymin)*i/3, y = Y(val);
    html += `<line x1="${margin.left}" y1="${f(y)}" x2="${width-margin.right}" y2="${f(y)}" stroke="#243642" stroke-width="1"/><text x="${margin.left-9}" y="${f(y+3)}" text-anchor="end" fill="#738a9a" font-family="ui-monospace,SFMono-Regular,monospace">${niceTick(val)}</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const val = xmin+(xmax-xmin)*i/4;
    html += `<text x="${f(X(val))}" y="${H-17}" text-anchor="middle" fill="#738a9a" font-family="ui-monospace,SFMono-Regular,monospace">${niceTick(val)}</text>`;
  }
  let legendX = margin.left;
  clean.forEach((s,index) => {
    const color = escapeHTML(s.color);
    html += `<rect x="${legendX}" y="9" width="11" height="3" rx="1.5" fill="${color}"/><text x="${legendX+17}" y="14" fill="#a6bac5" font-size="10">${escapeHTML(s.name)}</text>`;
    legendX += Math.max(95,s.name.length*6+37);
    if (!s.values.length) return;
    if (bar && index === 0) {
      const barWidth = Math.max(1,Math.min(25,W/Math.max(1,s.values.length)*.62));
      s.values.forEach(p => {
        const top = Math.min(Y(p.y),Y(0)); const bottom = Math.max(Y(p.y),Y(0));
        html += `<rect x="${f(X(p.x)-barWidth/2)}" y="${f(top)}" width="${f(barWidth)}" height="${f(Math.max(0,bottom-top))}" rx="2" fill="${color}" fill-opacity=".75"/>`;
      });
    } else {
      const line = s.values.map((p,i) => `${i ? 'L' : 'M'}${f(X(p.x))},${f(Y(p.y))}`).join(' ');
      if (index === 0) html += `<path d="${line} L${f(X(s.values.at(-1).x))},${f(Y(0))} L${f(X(s.values[0].x))},${f(Y(0))} Z" fill="${color}" fill-opacity=".06"/>`;
      html += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
      const last = s.values.at(-1); html += `<circle cx="${f(X(last.x))}" cy="${f(Y(last.y))}" r="3" fill="${color}"/>`;
    }
  });
  html += `<text x="${width-margin.right}" y="${H-2}" text-anchor="end" fill="#647e8e" font-size="9">${escapeHTML(xLabel)}</text><text x="${margin.left}" y="${margin.top-6}" fill="#647e8e" font-size="9">${escapeHTML(yLabel)}</text></g></svg>`;
  return html;
}

/** Meteorological bearing, degrees clockwise from north. */
export function compassSVG(bearing) {
  if (!isNumeric(bearing)) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86 86" width="86" height="86" role="img" aria-label="Direction unavailable"><circle cx="43" cy="43" r="28" fill="none" stroke="#2d4350"/><text x="43" y="49" text-anchor="middle" fill="#809baa" font-family="system-ui,sans-serif" font-size="20">—</text></svg>`;
  const angle = ((finite(bearing)%360)+360)%360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86 86" width="86" height="86" role="img" aria-label="Direction ${Math.round(angle)} degrees clockwise from north"><circle cx="43" cy="43" r="28" fill="none" stroke="#2d4350"/><circle cx="43" cy="43" r="18" fill="none" stroke="#223642" stroke-dasharray="2 4"/><path d="M43 12V20M43 66V74M12 43H20M66 43H74" stroke="#48616d"/><g fill="#809baa" font-family="system-ui,sans-serif" font-size="8" text-anchor="middle"><text x="43" y="9">N</text><text x="43" y="83">S</text><text x="5" y="46">W</text><text x="81" y="46">E</text></g><g transform="rotate(${angle} 43 43)"><path d="M43 20L36 49L43 45L50 49Z" fill="#64dcca"/><path d="M43 63L38 48L43 45L48 48Z" fill="#344f5b"/></g><circle cx="43" cy="43" r="3" fill="#b1eee0"/></svg>`;
}

export function regionColor(id) {
  const colors=['#ff88cf','#8dedff','#c8ed73','#ffa66b','#d6a7ff','#6aecd0','#ffe986'];
  return colors[(id-1)%colors.length];
}
