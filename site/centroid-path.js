/** Display-only retrospective smoothing. Never changes precipitation or metrics. */
export function smoothCentroids(centroids, windowSize = 5) {
  if (![1, 3, 5].includes(windowSize)) throw new Error('Unsupported centroid smoothing window');
  const points = centroids.map(p => p && Number.isFinite(p.x_km) && Number.isFinite(p.y_km)
    ? {x_km:p.x_km, y_km:p.y_km} : null);
  const result = points.map(p => p ? {...p} : null);
  const radius = Math.floor(windowSize / 2);
  for (let start = 0; start < points.length;) {
    if (!points[start]) { start++; continue; }
    let end = start;
    while (end + 1 < points.length && points[end + 1]) end++;
    // Preserve first/last actual positions of each uninterrupted wet segment.
    for (let i = start + 1; i < end; i++) {
      let weightSum = 0, x = 0, y = 0;
      for (let j = Math.max(start, i-radius); j <= Math.min(end, i+radius); j++) {
        const weight = radius + 1 - Math.abs(j-i);
        weightSum += weight; x += points[j].x_km * weight; y += points[j].y_km * weight;
      }
      result[i] = {x_km:x/weightSum, y_km:y/weightSum};
    }
    start = end + 1;
  }
  return result;
}

// Equal-area grid cells: retain the analytical centroid's 0.1 mm/h wet threshold.
export function rainfallCenters(event) {
  const {nx, ny, x_km, y_km} = event.grid;
  return event.frames.map(frame => {
    if (frame.values.length !== nx * ny) throw new Error('Rainfall grid shape mismatch');
    let total = 0, x = 0, y = 0;
    for (let i = 0; i < frame.values.length; i++) {
      const rate = frame.values[i];
      // Unknown rainfall invalidates this center instead of silently treating it as dry.
      if (!Number.isFinite(rate) || rate < 0) return null;
      if (rate < 0.1) continue;
      const weight = Math.sqrt(rate);
      total += weight;
      x += x_km[i % nx] * weight;
      y += y_km[Math.floor(i / nx)] * weight;
    }
    return total > 0 ? {x_km:x/total, y_km:y/total} : null;
  });
}

export function displayPath(event, windowSize = 3) {
  return {
    method:'square-root-weighted rainfall center',
    weighting:'sqrt(precip_mm_h)',
    minimum_rainfall_mm_h:0.1,
    smoothing:windowSize === 1 ? 'none' : 'centered triangular moving average',
    window_intervals:windowSize,
    preserves_segment_endpoints:true,
    uses_future_intervals:windowSize > 1,
    note:'Display only; original intensity-weighted centroids and analytical metrics are unchanged. Missing/dry gaps are not bridged. This is a whole-grid rainfall center, not a physical storm-cell track.',
    positions:smoothCentroids(rainfallCenters(event), windowSize).map((p,i) => p ? {frame:i,time_h:event.frames[i].time_h,timestamp:event.frames[i].timestamp,...p} : null)
  };
}
