import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageName = 'stylelint-plugin-rhythmguard';
export const endpoint = `https://api.npmjs.org/downloads/point/last-month/${packageName}`;
const defaultDirectory = fileURLToPath(new URL('../assets/badges/', import.meta.url));

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDownloads(data) {
  if (
    data?.package !== packageName ||
    !Number.isSafeInteger(data.downloads) || data.downloads < 0 ||
    !validDate(data.start) || !validDate(data.end) || data.start > data.end
  ) {
    throw new Error('npm returned invalid download data');
  }
  return data;
}

export function renderBadge(data) {
  validateDownloads(data);
  const count = new Intl.NumberFormat('en', {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(data.downloads).toLowerCase();
  const message = `${count}/month`;
  const labelWidth = 79;
  const valueWidth = Math.max(80, message.length * 7 + 12);
  const width = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" role="img" aria-label="downloads: ${message}">
  <title>npm downloads: ${data.downloads.toLocaleString('en')} (${data.start} to ${data.end})</title>
  <desc>Last successful npm reporting window for ${packageName}. See the adjacent JSON file for source and refresh time.</desc>
  <clipPath id="round"><rect width="${width}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#round)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${valueWidth}" height="20" fill="#4c1"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">downloads</text><text x="${labelWidth / 2}" y="14">downloads</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text><text x="${labelWidth + valueWidth / 2}" y="14">${message}</text>
  </g>
</svg>
`;
}

async function previousSnapshot(directory) {
  try {
    const data = JSON.parse(await readFile(path.join(directory, 'rhythmguard-downloads.json'), 'utf8'));
    validateDownloads(data);
    await access(path.join(directory, 'rhythmguard-downloads.svg'));
    return data;
  } catch {
    return null;
  }
}

export async function updateBadge({ directory = defaultDirectory, fetchImpl = fetch, now = new Date() } = {}) {
  const previous = await previousSnapshot(directory);
  let data;
  try {
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`npm returned HTTP ${response.status}`);
    data = validateDownloads(await response.json());
  } catch (error) {
    if (!previous) throw error;
    return { status: 'stale', reason: error.message };
  }

  if (previous && data.downloads === previous.downloads && data.start === previous.start && data.end === previous.end) {
    return { status: 'unchanged' };
  }

  const snapshot = {
    schemaVersion: 1, package: packageName, downloads: data.downloads,
    start: data.start, end: data.end, fetchedAt: now.toISOString(), source: endpoint,
  };
  await mkdir(directory, { recursive: true });
  for (const [name, contents] of [
    ['rhythmguard-downloads.svg', renderBadge(snapshot)],
    ['rhythmguard-downloads.json', `${JSON.stringify(snapshot, null, 2)}\n`],
  ]) {
    const destination = path.join(directory, name);
    await writeFile(`${destination}.tmp`, contents);
    await rename(`${destination}.tmp`, destination);
  }
  return { status: 'updated' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await updateBadge();
  console.log(result.status === 'stale'
    ? `::warning::${result.reason}; keeping the last successful download badge.`
    : `Download badge: ${result.status}.`);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `status=${result.status}\n`, { flag: 'a' });
  }
}
