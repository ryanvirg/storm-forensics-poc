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

export function displayPath(event, windowSize) {
  return {
    method:windowSize === 1 ? 'raw centroid' : 'centered triangular moving average',
    window_intervals:windowSize,
    preserves_segment_endpoints:true,
    uses_future_intervals:windowSize > 1,
    note:'Display only; raw centroids and analytical metrics are unchanged. Missing/dry gaps are not bridged. This is a whole-grid rainfall center, not a physical storm-cell track.',
    positions:smoothCentroids(event.frames.map(f => f.centroid), windowSize).map((p,i) => p ? {frame:i,time_h:event.frames[i].time_h,timestamp:event.frames[i].timestamp,...p} : null)
  };
}
