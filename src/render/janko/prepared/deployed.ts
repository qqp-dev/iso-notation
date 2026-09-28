/** Static Pages propagation: one coherent, hash-verified release, never a half update. */
export interface ReleaseAsset { url: string; sha256: string }
export interface DeployedRelease { schema: 1; generation: string; engineIdentity: string;
  canonicalRevisions: Record<string, string>; status: import('./status').PreparedManifest['status']; data: ReleaseAsset; pdf: ReleaseAsset;
  artifacts: { candidates: ReleaseAsset; reference: ReleaseAsset } }
export interface VerifiedRelease { manifest: DeployedRelease; data: string; candidates: string; reference: string; pdfUrl: string }
const hex = /^[0-9a-f]{64}$/;
export function releaseAssetUrl(asset: ReleaseAsset, manifestUrl: string): string {
  if (!hex.test(asset.sha256) || !/^janko-(?:release|prepared)\/[a-f0-9]{64}\.(?:json|html|pdf)$/.test(asset.url) ||
      !asset.url.includes(asset.sha256)) throw new Error('invalid release asset identity');
  return new URL(asset.url, manifestUrl).href;
}
async function hashed(response: Response, expected: string): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error(`release asset ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (!globalThis.crypto?.subtle) throw new Error('release hash verification unavailable');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (digest !== expected) throw new Error('release asset hash mismatch');
  return bytes;
}
async function readReleaseManifest(manifestUrl: string, request: typeof fetch): Promise<DeployedRelease> {
  const response = await request(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`release manifest ${response.status}`);
  const manifest = await response.json() as DeployedRelease;
  if (manifest.schema !== 1 || !hex.test(manifest.generation) || !hex.test(manifest.engineIdentity) ||
      !manifest.canonicalRevisions || !manifest.canonicalRevisions['bach-goldberg-var1'] || !manifest.canonicalRevisions['brahms-op118-no1'])
    throw new Error('invalid release manifest');
  return manifest;
}
/** Fetch all four matching assets before exposing any of the new release to callers. */
export async function fetchVerifiedRelease(manifestUrl: string, request: typeof fetch = fetch, verifiedManifest?: DeployedRelease): Promise<VerifiedRelease> {
  const manifest = verifiedManifest ?? await readReleaseManifest(manifestUrl, request);
  const assets = [manifest.data, manifest.pdf, manifest.artifacts.candidates, manifest.artifacts.reference];
  const urls = assets.map(asset => releaseAssetUrl(asset, manifestUrl));
  const bytes = await Promise.all(urls.map((url, i) => request(url, { cache: 'no-store' }).then(r => hashed(r, assets[i].sha256))));
  const text = (index: number) => new TextDecoder().decode(bytes[index]);
  const data = JSON.parse(text(0)) as { scores?: Record<string, { revision?: string }> };
  for (const [id, revision] of Object.entries(manifest.canonicalRevisions))
    if (data.scores?.[id]?.revision !== revision) throw new Error(`release score mismatch: ${id}`);
  if (!text(2).includes('data-view="candidates"') || !text(3).includes('data-view="reference"'))
    throw new Error('release panel mismatch');
  return { manifest, data: text(0), candidates: text(2), reference: text(3), pdfUrl: urls[1] };
}
/** Bounded polling/backoff, no network activity while hidden; last-good remains applied on failure. */
export function watchDeployedRelease(manifestUrl: string, onRelease: (release: VerifiedRelease) => Promise<void> | void,
  onStale: (error: Error) => void, currentEngine: string, request: typeof fetch = fetch) {
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, serial = 0;
  let applied = '', delay = 5000;
  const tick = async () => {
    if (stopped) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { schedule(); return; }
    const token = ++serial;
    try {
      const manifest = await readReleaseManifest(manifestUrl, request);
      if (stopped || token !== serial) return;
      if (manifest.engineIdentity !== currentEngine) {
        onStale(new Error('reviewed engine bundle changed; awaiting matching JS'));
        if (typeof window !== 'undefined') {
          // Never loop reloads indefinitely while a CDN edge still serves an
          // older HTML/JS bundle. One attempt per new reviewed identity, then
          // retain the last-good screen stale until a fresh document arrives.
          const key = 'janko-engine-reload';
          try {
            if (sessionStorage.getItem(key) !== manifest.engineIdentity) {
              sessionStorage.setItem(key, manifest.engineIdentity);
              window.location.reload();
              return;
            }
          } catch { /* private storage blocked: keep stale, never spin */ }
        }
        delay = Math.min(delay * 2, 60000);
        schedule();
        return;
      }
      if (manifest.generation !== applied) {
        const release = await fetchVerifiedRelease(manifestUrl, request, manifest);
        if (stopped || token !== serial) return;
        await onRelease(release);
        if (stopped || token !== serial) return;
        applied = manifest.generation;
      }
      delay = 5000;
    } catch (error) {
      onStale(error instanceof Error ? error : new Error(String(error)));
      delay = Math.min(delay * 2, 60000);
    }
    schedule();
  };
  const schedule = () => { if (!stopped) timer = setTimeout(tick, delay); };
  void tick();
  return () => { stopped = true; ++serial; if (timer) clearTimeout(timer); };
}
