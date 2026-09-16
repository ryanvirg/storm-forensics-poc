// Both the local API and GitHub Pages use the same Python-calculated results.
// Resolve from this module so project sites work below /repository-name/.
const siteBase = new URL('./', import.meta.url);
const durations = [3, 6, 12, 24, 48, 72];
const sources = ['AORC', 'MRMS'];
let configuration;

async function readJSON(path, description) {
  const url = new URL(path, siteBase);
  let response;
  try {
    response = await fetch(url, {headers: {'Accept': 'application/json'}});
  } catch {
    throw new Error(`Could not load ${description}. Check your connection and reload the page.`);
  }
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Could not read ${description}. The site may be missing its generated data files.`);
  }
  if (!response.ok) {
    const detail = typeof value?.detail === 'string' ? ` ${value.detail}` : '';
    throw new Error(`Could not load ${description} (HTTP ${response.status}).${detail}`);
  }
  return value;
}

export async function getMode() {
  if (!configuration) {
    configuration = readJSON('site-config.json', 'site configuration').then(value => {
      if (!value || !['api', 'static'].includes(value.mode)) {
        throw new Error('The site configuration must select API or static data.');
      }
      return value.mode;
    }).catch(error => {
      configuration = undefined;
      throw error;
    });
  }
  return configuration;
}

function validDuration(duration) {
  const value = Number(duration);
  if (!durations.includes(value)) throw new Error('Choose a supported storm duration.');
  return value;
}

export async function getCatalog(duration) {
  const value = validDuration(duration);
  const mode = await getMode();
  const path = mode === 'static'
    ? `data/catalog-${value}.json`
    : `api/historical/catalog?duration=${value}`;
  const catalog = await readJSON(path, `${value}-hour storm catalog`);
  if (!catalog || !Array.isArray(catalog.events) || !catalog.statistics || Number(catalog.duration_hours) !== value) {
    throw new Error('The storm catalog has an unexpected format. Rebuild or reload the site.');
  }
  return catalog;
}

export async function getEvent(id, duration, source = 'AORC') {
  const value = validDuration(duration);
  if (!sources.includes(source)) throw new Error('Choose an available historical source.');
  const mode = await getMode();
  if (mode === 'static' && !new RegExp(`^hist-(front-range-2013|denver-may-2023|denver-june-2023)-${value}$`).test(id)) {
    throw new Error('This event is not part of the published demonstration catalog.');
  }
  const encodedID = encodeURIComponent(id);
  const path = mode === 'static'
    ? `data/events/${source}/${encodedID}.json`
    : `api/historical/events/${encodedID}?duration=${value}&source=${source}`;
  const event = await readJSON(path, 'storm event');
  if (!event || event.id !== id || Number(event.duration_hours) !== value || !event.grid || !event.metrics || !Array.isArray(event.frames) || !event.frames.length) {
    throw new Error('The storm event has an unexpected format. Rebuild or reload the site.');
  }
  return event;
}

export async function getSources() {
  return readJSON((await getMode()) === 'static' ? 'data/source-manifest.json' : 'api/historical/sources', 'source metadata');
}
