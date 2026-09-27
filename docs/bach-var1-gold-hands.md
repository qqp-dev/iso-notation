# Goldberg Variatio 1 · GOLD hand assignments (16 events)

The operator approved these sixteen editorial hand corrections against the landed PR112 score (`0efb871`). The event IDs identify original builder events, not historical part labels; only `hand` changes. The evidence is two **complete 32-bar textual** transcriptions, read by measure and part, plus musical context and operator judgment:

- **M**: Mutopia #980, [item](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=980), [LilyPond source](https://www.mutopiaproject.org/ftp/BachJS/BWV988/bwv-988-v01/bwv-988-v01.ly), SHA-256 `24fcef149fc4ac2b562020f7db2c38084bee0c47c73adec9cea7134d1aa18b5c`. `soprano`/`bass` lines 65–66 and 120–121 (mm. 4–5), 90–95 and 145–149 (mm. 20–24); `%1-5`, `%16-20`, `%21-25` delimit the bars. The Mutopia LilyPond, PDF and MIDI are **one** BGA-parent transcription lineage, not independent votes.
- **K**: Knute Snortum [variation parts](https://github.com/ksnortum/bach-goldberg/blob/main/includes/variation-01-bwv-988-parts.ily), tag v0.1 (commit `970dc7ccf194639ec97dddfb660fde3d775de35c`), SHA-256 `53009b0f55011c7d7f9ec54771a7ffc7a09ac519394f6773d52d2c20d1276773`. `rightHand`/`leftHand` lines 19–20 and 65–66 (mm. 4–5), 38–47 and 83–94 (mm. 17–25), with pipe-separated bars and `\barNumberCheck 17` / `25`. This editor used Open Goldberg **in part**; this is a useful second edited reading, not independent historical proof.

| m. | IDs · absolute ticks · solf | PR112 → GOLD | M and K part reading |
|---|---|---|---|
| 4 | 68 t552 2 (D3); 69 t564 0 (C3) | LH→RH; RH→LH | M soprano `d,8`, bass `c'!16`; K rightHand `d,8`, leftHand `c'!` after rest |
| 20 | 348 t2844 3 (D#4); 349 t2856 6 (F#4); 350 t2868 9 (A4) | RH→LH ×3 | M bass / K leftHand ascending `dis16 fis16 a16` |
| 21 | 351 t2880 7 (G4); 354 t2916 6 (F#4); 355 t2928 7 (G4) | RH→LH ×3 | M bass / K leftHand `g8. fis16 g8.`; RH B4 is tied, not a new attack |
| 21 | 360 t2988 3 (D#3); 361 t3000 4 (E3) | LH→RH ×2 | M soprano / K rightHand `dis,16 e8`, printed in lower staff |
| 22 | 366 t3060 B (B4); 367 t3072 0 (C5) | RH→LH ×2 | M bass / K leftHand `b''16 c8.` in upper staff |
| 22 | 372 t3132 8 (G#3); 373 t3144 9 (A3) | LH→RH ×2 | M soprano / K rightHand `gis,16 a8~`, lower staff; tied A3 extends into m. 23 |
| 24 | 408 t3432 4 (E3); 409 t3444 2 (D3) | LH→RH; RH→LH | M soprano `e,8`, bass `d'16`; K rightHand / leftHand same allocation |

M soprano m. 20–24 is lines 90–95, bass m. 20–24 within lines 142–149; K rightHand m. 20–24 lines 38–47, leftHand m. 20–24 within lines 83–94. Source-part assignment is an editorial aid, **not** an automatic MIDI-track, staff, stem or pitch-to-performing-hand rule. #343 B4 (RH t2784, 108 ticks) remains a hold to t2892; LH B2 t3012 and C3 t3024 cross the m. 21–22 barline. #373 A3 (now RH t3144, 36 ticks) remains held to t3180. Alternation ends at m. 23 t3168, where texture changes; m. 5 #70/#71 stay LH and m. 25 is not assigned by copying m. 5.

At m. 16 t2256, #282 D4 is **unresolved**: both textual transcriptions place the coincident unison in both parts, but the score has one event; neither its hand nor its encoding changes here. At m. 32 t4560, #550/#551 G3 are distinct coincident events and remain so. The first-print Handexemplar (IMSLP #74598, [BnF catalogue](https://gallica.bnf.fr/ark:/12148/btv1b550059626), retrieved SHA-256 `d3c29d4d4875d4c0dee059eb723852c987cd5ba543af9eec3ecb28afeb387ab9`) and BGA 1853 scan ([IMSLP #00823](https://imslp.org/wiki/File:BWV0988.pdf), SHA-256 `f1600d575f7ee5fec1cf199cbdfe2884ba13669cb0eda0785c3835f33395b994`) were retrieved but **not optically collated**. No explicit historical hand marks have been verified; these assignments are bounded editorial choices, not claims of original fingering or historical performing hands. No source encoding or scan is redistributed here.
