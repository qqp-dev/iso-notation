// Keep local PDF transport and decoding out of the published comparison.
if (import.meta.env.DEV) void import('./development-viewer');
else void import('./published-viewer');
