import { NYC_HEAT_ENDPOINTS } from "../js/data/heat/nyc.js";
import { buildNlcdSampleRequest } from "../js/data/heat/nlcd.js";
import { buildSdaPointQuery } from "../js/data/soil/national.js";

const checks = Object.entries(NYC_HEAT_ENDPOINTS).map(([name, url]) => {
  if (name !== "landCoverBlockGroups") return { name, url, options: { headers: { Accept: "application/json" } } };
  const query = new URL(url);
  const parameters = {
    where: "1=1",
    geometry: "-74.30,40.45,-73.65,40.95",
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,To_IA_Pct,UTC_Pct_y2",
    returnGeometry: "false",
    resultRecordCount: "5",
    f: "json"
  };
  for (const [key, value] of Object.entries(parameters)) query.searchParams.set(key, value);
  return { name, url: query.toString(), options: { headers: { Accept: "application/json" } } };
});

checks.push({
  name: "openMeteoViewportHeat",
  url: "https://api.open-meteo.com/v1/forecast?latitude=39.7392,40.7128&longitude=-104.9903,-74.0060&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=GMT&forecast_days=1",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "openMeteoAirQuality",
  url: "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=39.7392,40.7128&longitude=-104.9903,-74.0060&current=pm2_5,pm10,nitrogen_dioxide,ozone,us_aqi,us_aqi_pm2_5&timezone=GMT",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "openMeteoForecastPlayback",
  url: "https://api.open-meteo.com/v1/forecast?latitude=39.7392,40.7128&longitude=-104.9903,-74.0060&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=GMT&forecast_days=1",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "censusTigerNational",
  url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/8/query?where=1%3D1&geometry=-105.10%2C39.60%2C-104.90%2C39.80&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID%2CSTATE%2CCOUNTY%2CTRACT%2CNAME%2CAREALAND%2CCENTLAT%2CCENTLON&returnGeometry=true&outSR=4326&resultRecordCount=25&f=geojson",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "censusAcsNational",
  url: "https://api.census.gov/data/2024/acs/acs5?get=NAME%2CB01003_001E%2CB17001_001E%2CB17001_002E&for=tract%3A%2A&in=state%3A08%20county%3A031",
  options: { headers: { Accept: "application/json" } }
});
const soilQuery = buildSdaPointQuery([
  { id: "denver-soil", lat: 39.7392, lng: -104.9903 }
]);
checks.push({
  name: "usdaSdaSoil",
  url: "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest",
  options: {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams({
      service: "query",
      request: "query",
      query: soilQuery,
      format: "JSON+COLUMNNAME"
    })
  }
});
checks.push({
  name: "usgsWaterInstantaneous",
  url: "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=06711565&parameterCd=00060&period=P1D",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "usgsNldiNetwork",
  url: "https://api.water.usgs.gov/nldi/linked-data?f=json",
  options: { headers: { Accept: "application/json" } }
});
checks.push({
  name: "overpassCandidates",
  url: "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A20%5D%3Bnode%5B%22amenity%22%3D%22library%22%5D%2839.70%2C-105.05%2C39.76%2C-104.95%29%3Bout%205%3B",
  options: { headers: { Accept: "application/json" } }
});
const nlcd = buildNlcdSampleRequest([
  { id: "denver", lat: 39.7392, lng: -104.9903 },
  { id: "new-york", lat: 40.7128, lng: -74.0060 }
]);
checks.push({ name: "annualNlcdLandCover", ...nlcd });

let failures = 0;
for (const { name, url, options } of checks) {
  const started = performance.now();
  try {
    const response = await fetch(url, options);
    const elapsed = Math.round(performance.now() - started);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const body = await response.json();
    if (body?.error) throw new Error(body.error.message ?? "service returned an error");
    const count = Array.isArray(body)
      ? body.length
      : body.features?.length ?? body.samples?.length ?? body.elements?.length ?? body.Table?.length ?? body.exceededTransferLimit ?? "object";
    console.log(`PASS ${name.padEnd(24)} ${String(count).padStart(6)} records/features ${elapsed} ms`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name.padEnd(24)} ${error.message}`);
  }
}

if (failures) process.exitCode = 1;
