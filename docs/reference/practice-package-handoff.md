# Practice v1 offline browser package · Music Box integration handoff

Run `npm run build` upstream; take **the whole** generated `build/practice-v1/` directory for Music Box integration without a running server or network. This ignored build directory is separate from Pages `dist/`; this handoff does not publish a Git release or Pages package. Offline hosting is a technical requirement of this integration, not a use or licensing restriction. No Node/npm or development server is needed on Windows. `manifest.json` identifies `contractVersion` (schema), `isoVersion` (renderer label), `buildId` (SHA-256 over sorted file and source digest maps), and SHA-256 of each shipped file. Verify those file digests locally before accepting updates; the manifest itself is not signed. Preserve the bundled font attribution, AGPLv3 and limited PS/PDF exception; see `notices/URW-provenance.md`, `notices/URW-COPYING` and `notices/URW-LICENSE` for actual terms and upstream source-form pointers.

Load `iso-practice.js` once as a **classic** script from the same local package; it sets `window.IsoPractice` with `renderPracticeView`, `resolvePracticeScale`, `SUPPORTED_PRACTICE_SCALES`, `ISO_PRACTICE_VERSION`, `PRACTICE_CONTRACT_VERSION`. The supported list (also in the manifest/fixture) has `major` / Major and `natural-minor` / Natural minor (N26); populate the host selector from it. Harmonic, melodic and jazz minor are intentionally not offered yet. No imports, fetch, studio shell, third-party scripts or external font paths. All paths in the manifest are relative to the package. For example, after the host has initialized its persistent WebView2 and loaded its own local document:

```html
<script src="iso-practice.js"></script>
<div id="score"></div>
<script>
  const request = {rudiment:'scale', scaleType:'major', tonicLinear:48,
    width:760, height:380}; // measured available CSS pixels; default two-guides
  try {
    const view = window.IsoPractice.renderPracticeView(request);
    document.getElementById('score').innerHTML = view.svg; // INLINE, not <img>
    // Reply via the host-owned JS/message boundary with view.selectionId,
    // view.contractVersion, view.isoVersion, view.guide, view.attacks,
    // view.systemCount and view.railClearance as needed.
  } catch (error) {
    // Host reports unsupported input/insufficient fit; no silent fallback.
  }
</script>
```

The host owns shortcut, selector, arrows, absolute-tonic conversion, request/response correlation, error handling and retaining the browser control across updates. Pass absolute `tonicLinear = 12 * octave + pitchClass` (C4=48, **not MIDI**); ±1 is a 1-span. Do not assign row strings or infer LH pitch in the host: `attacks[].hands.RH/LH` expose separate finger/row/y/pitchLinear entries. The score engraves the LH notes one 10-span (12 linear units) below the RH notes at the same onsets; top-level `attacks[].pitchLinear` remains RH for contract-1 consumers. `selectionId = scale:<scaleType>:<tonic>` (e.g. `scale:major:48` or `scale:natural-minor:48`) is stable across guide/viewport changes; use host request correlation if an asynchronous response may arrive after another request. On resize, measure available browser CSS-pixel width/height and render again; dimensions are SVG user coordinates and intrinsic `px` attributes. Supported width 560–1600, height 360–900, tonic integers 36–60; invalid/unsupported or non-fitting geometry throws `RangeError` synchronously. One system/two measures/15 simultaneous sixteenth-note attacks per hand (12 ticks at TPB 48, eight in the first 96-tick measure and seven in the second, two-level real engine beams in 4/4/4/3 groups), display only (no sound/MIDI). N26 uses the operator's exact ascending offsets `[0,2,3,5,7,8,10,12]`, RH `31234123`, LH `21432132`, relative contour `[2,0,1,1,1,0,2,2]` mapped to legal physical rows `31222133` / `42333244` by tonic parity. Its descent exactly reverses the path, without repeating the apex. Major's reverse descent remains provisional; the two-measure double-beam silhouette awaits visual acceptance; the two faint guides on each rail are the selected default.

The complete SVG contains a data-URL URW Gothic Demi OTF. Insert **inline into the document**, preserve its `<defs><style>@font-face…</style></defs>`, and wait for `document.fonts.ready` after insertion before using browser-measured SVG/text geometry or treating a visual check as final. Check actual font face/number glyph appearance, not just a returned string. The separate `fonts/URWGothic-Demi.otf` is an audit copy, not a runtime fetch dependency. Do not strip data URLs or alter CSP without checking the font. Neither the Linux bundle smoke test nor host inventory verifies WebView2 font/SVG behavior.

Acceptance fixtures in `fixtures/practice-v1.json`: compare versions, supported types and selection identity, exact RH/LH pitches, RH/LH fingers and parity-keyed physical rows for both types at 48 and 49 (a 1-span), 36 and 60 bounds, and invalid requests. With default guide verify four faint guides (two per rail), RH upper/LH lower, four possible finger seats (nearest row lowest), separate fingers from both hands' real pitch symbols, black field, no network, and one system. Resize within allowed bounds, move by ±1 and back, and ensure SVG/digits/identity update without recreating the WebView2. For `guide:'none'` the guide lines alone disappear. Actual Windows host acceptance remains consumer-owned and unverified; no Music Box code or deployment is included.
