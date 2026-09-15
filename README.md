# Storm forensics — historical precipitation pilot

[Open the application](https://ryanvirg.github.io/storm-forensics-poc/)

The application displays actual NOAA historical precipitation estimates for selected Denver/MHFD periods:

- AORC: September 2013, May 2023 and June 2023.
- MRMS: May 2023, compared using the same UTC event windows.

The explorer offers six event durations, hourly animation, accumulated depth, centroid drift, footprint and JSON/CSV exports. Data are area-averaged to 2 km cells over a 100 × 100 km projected domain. The MHFD district outline is an interim proxy; statistics cover the full square.

This is a selected-period pilot, not the supplied MHFD historical catalog or independently gauge-validated engineering data. See Data & methods for exact coverage, processing, source notices and limitations.

This public repository contains generated site files in `site/` and the Pages deployment workflow. Development source, Python calculations, tests and acquisition scripts remain in a separate private repository. Site assets and data are published automatically; do not edit generated files here.

Sources: [NOAA AORC](https://registry.opendata.aws/noaa-nws-aorc/) and [NOAA MRMS](https://registry.opendata.aws/noaa-mrms-pds/). Modified NOAA data are attributed; NOAA does not endorse this application.
