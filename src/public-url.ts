export const DEFAULT_PUBLIC_BASE_URL = 'https://forms.trainlabhq.com/atcflexlabaccess';

export function joinBase(base: string, path: string): string {
  const root = base.replace(/\/+$/, '');
  if (!path || path === '/') return root || '/';
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const queryAt = suffix.indexOf('?');
  const pathname = queryAt === -1 ? suffix : suffix.slice(0, queryAt);
  const query = queryAt === -1 ? '' : suffix.slice(queryAt);
  return `${root}${pathname}${query}`;
}

export function logicalPath(pathname: string, basePath: string): { path: string; prefixed: boolean } {
  const path = stripTrailingSlash(pathname) || '/';
  const base = stripTrailingSlash(basePath);
  if (!base) return { path, prefixed: false };
  if (path === base) return { path: '/', prefixed: true };
  if (path.startsWith(`${base}/`)) return { path: path.slice(base.length) || '/', prefixed: true };
  return { path, prefixed: false };
}

export function readPublicUrl(source: Record<string, string | undefined>): { publicBaseUrl: string; basePath: string } {
  const raw = source.PUBLIC_BASE_URL?.trim() || DEFAULT_PUBLIC_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an absolute http(s) URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('PUBLIC_BASE_URL must use http or https.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('PUBLIC_BASE_URL must be an origin and path.');
  }
  const pathFromUrl = stripTrailingSlash(parsed.pathname);
  const publicBaseUrl = `${parsed.origin}${pathFromUrl === '/' ? '' : pathFromUrl}`;
  const configured = source.BASE_PATH?.trim() ?? '';
  let basePath = configured ? stripTrailingSlash(configured) : pathFromUrl === '/' ? '' : pathFromUrl;
  if (basePath === '/') basePath = '';
  if (basePath && (!basePath.startsWith('/') || basePath.startsWith('//') || basePath.includes('//') || basePath.includes('..'))) {
    throw new Error('BASE_PATH must be a single path such as /atcflexlabaccess.');
  }
  return { publicBaseUrl, basePath };
}

function stripTrailingSlash(value: string): string {
  let path = value;
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}
