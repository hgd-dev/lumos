# LUMOS Air Public Release v1.4

LUMOS Air is a public, browser-based monitoring-design workspace for PM2.5, PM10, nitrogen dioxide, and ozone.

## What the public release does

- loads a regional atmospheric-composition screening field;
- adds current weather and a wind-aware transport geometry;
- constructs traffic, industrial, background, calibration, and systematic candidate roles;
- incorporates population exposure, vulnerability, and group-level information constraints;
- generates five alternative monitoring networks;
- compares LUMOS with established Gaussian-process design criteria and simple baselines;
- optionally conditions the concentration field on compatible current OpenAQ readings;
- supports source-control and post-intervention monitoring design;
- exports current-workspace and four-city evidence bundles.

## Four-city public evidence suite

The public suite applies one fixed protocol to:

1. Los Angeles PM2.5
2. Houston ozone
3. Chicago nitrogen dioxide
4. New York PM2.5

The suite is designed to test transfer across pollutant type, urban form, source structure, and prevailing transport. It does not precompute favorable results. Every run retrieves the available public inputs at run time and records a checksum.

## Interpretation boundary

Open-Meteo/CAMS concentrations are regional screening priors, not street-level regulatory observations. OpenStreetMap source and host features are mapped proxies. Census indicators are area-level estimates. OpenAQ values may differ in timestamp, instrument, and reporting method. LUMOS recommendations require field verification, permission, calibration planning, and local agency review before deployment.

## Credentials

OpenAQ credentials are optional, stored only in session storage, and excluded from saved workspaces, exports, release files, and repository history.
