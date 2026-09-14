# Denver / MHFD geographic reference

The prototype uses the **official Mile High Flood District administrative boundary as an interim proxy** while the project's study-area map is pending. This published district outline is useful geographic context; it is not a claim that the eventual study boundary is identical. All demonstration rainfall remains simulated.

## Sources

- **District outline:** [MHFD GIS, MHFD Boundary layer](https://gis.mhfd.org/server/rest/services/Boundaries/MHFDBoundary/FeatureServer/0). Its [item metadata](https://gis.mhfd.org/server/rest/services/Boundaries/MHFDBoundary/FeatureServer/0/iteminfo) describes digitization from BLM Township and Range data using the district's statutory description. Attribution is **MHFD GIS**. The published `licenseInfo` field is empty; this asset does not assert a separate open-data license. Layer metadata and the query URL are retained in `metadata.json`; retrieval timestamps are recorded there and in `reference.json`.
- **City labels:** [U.S. Census Bureau 2025 Colorado places Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_gaz_place_08.txt). The [Gazetteer documentation](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html) identifies these as representative geographic coordinates. Labels use the Gazetteer's internal point for each incorporated place, not a downtown landmark. The downloaded source is retained in `census-places-2025.txt`.
- **Background maps:** See `usgs-manifest.json` for imagery and topographic-map provenance, image extent, retrieval timestamp, and service attribution. These are independent of the boundary source. The [USGS National Map use and licensing FAQ](https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map) states that its map services and data are free and in the public domain, with source acknowledgment requested.

## Projection and display domain

The boundary query requests GeoJSON in longitude/latitude (`outSR=4326`). `boundary.geojson` retains the complete returned feature and its attributes. Display coordinates are transformed with PROJ through `pyproj` into **WGS 84 / UTM zone 13N (EPSG:32613)**. Every source ring and vertex is retained; local coordinates are rounded to six decimal places in kilometres (one millimetre). The current download is one polygon, one closed ring, and 896 vertices.

The **100 × 100 km demonstration square** is centered on the bounding box of the projected district outline. The entire outline fits inside it. Its southwest origin is easting **458064.58138263633 m**, northing **4352087.30159522 m**. Coordinates in `reference.json.boundary` are `[x_km, y_km]`, with x increasing east and y increasing north. The boundary field is an array of rings; `boundary_polygon_ring_counts` preserves each polygon's ring count. Images cover precisely the same projected square. The WGS84 bounds are an enclosing reference box, not the coordinates for image warping.

The district outline is an overlay. Rainfall statistics continue to describe the full square and are **not clipped to the district**. The generated rainfall fields illustrate placement and visualization; they are not observed or reconstructed storms over Denver.

## Refreshing and replacing

From the repository root:

```bash
.venv/bin/python -m pip install pyproj==3.7.2 certifi
.venv/bin/python scripts/fetch_geography.py
```

These are asset-generation dependencies; the application reads static assets and does not require `pyproj` at runtime. Regenerate background images after a refresh if the projected origin changes. Once the supplied project map arrives, verify its CRS and domain, replace the interim boundary, align the map and rainfall coordinates, and decide explicitly whether statistics should be clipped to the new study area.
