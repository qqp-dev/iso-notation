# Schumann Op.68 No.14 — IMSLP research coverage correction

Observed2026-10-03. This records a research-method correction, not a new edition selection, source-comparison certification or studio deployment.

The operator identified critical editions omitted from the prior bounded acquisition dossier: Henle1977 and Breitkopf1984. The old dossier mentioned IMSLP historical scans and failed direct routes, then selected the accessible Schuberth1848 institutional images for14/30. It did not assess these two critical-edition entries or exhaust normal browser access before describing the Henle page-access gap. Mentioning IMSLP was insufficient evidence of relevant edition coverage.

## Verified entries and access

The [IMSLP Op.68 work page](https://imslp.org/wiki/Album_f%C3%BCr_die_Jugend,_Op.68_(Schumann,_Robert)) lists both entries. Edition/editor/year below are catalogue statements. Actual PDF bytes were subsequently retrieved through the listed download flow and independently checked by `pdfinfo`.

| Entry | Catalogue edition | Normal download entry | Public asset reached through the ordinary flow | Retrieved bytes / pages / SHA-256 |
| --- | --- | --- | --- | --- |
|971889|Munich: G.Henle Verlag,1977; Wolfgang Boetticher, Walther Lampe fingerings|[Henle download](https://imslp.org/wiki/Special:ImagefromIndex/971889)|[Henle PDF](https://petruccimusiclibrary.ca/files/imglnks/caimg/c/cd/IMSLP971889-PMLP2707-Schumann_album_fur_die_jugend_henle_46.pdf)|15,092,276 /58 / `d03ed506bc67a5fb21795df4581a8e97251805f75f9a64862270dd2790c1613a`|
|889469|Wiesbaden: Breitkopf & Härtel No.8436,1984; Clara Schumann/Joachim Draheim; plateWb.1701|[Breitkopf download](https://imslp.org/wiki/Special:ImagefromIndex/889469)|[Breitkopf PDF](https://imslp.eu/files/imglnks/euimg/0/0f/IMSLP889469-PMLP2707-schumann_op.68_breitkopf.pdf)|8,553,215 /59 / `203f910d0c0e9ed95ad499b8cc964657281860a1c4685c5fa641eb77ee8b281a`|

Text-fetch navigation encountered IMSLP's JavaScript redirect/bot-check surface. An ordinary fresh Chromium browser instead reached the standard IMSLP disclaimer and the CA/EU library continuation pages. Following their actual public links supplied the PDF URLs above; both returned HTTP200 and valid PDF bytes. No challenge-solving, stealth, proxy, credential read or access-control bypass was used. The browser profile was removed; acquired PDFs remain in an outside-checkout research cache.

Receipt: `/tmp/no14-imslp-browser-access-receipt.json`; cache: `/tmp/no14-imslp-source-access-0o4o4a/`. These establish file identity and an accessible route, not musical accuracy, visual acceptance, complete No.14 page inspection or redistribution permission. No reference asset was copied into the repository or public build. Henle1977/Boetticher must not be relabeled as current Henle HN45/Herttrich.

## Corrected method and authority

For a work with an IMSLP entry, explicitly inspect its relevant original, critical and practical editions before proposing an access fallback. Distinguish metadata, retrieved files and actually inspected piece pages. A failed text-fetch tool does not establish source unavailability: test the ordinary browser/download route before handing an access gap back to the operator.

The operator clarified that the usual research handoff should show the actual source edition beside a candidate transcription so they can judge similarity and difference. That presentation requirement does not authorize an automatic full comparative certification task or silent edition substitution. Existing project-local score-research instructions remain unchanged; the stronger explicit requirements are recorded in the current OpenSpec source-research delta.

The operator reports no piano indicators in Henle, with crescendo/diminuendo retained. This is operator evidence, not an agent's Henle musical comparison. The current relative-reading refinement removes the two encoded piano statements also absent from the already inspected selected Schuberth1848 pages, restores existing authored final rests and removes assistant-added sheet instructions. Its raw Hardy encoding, accepted Gold and source edition selection remain separately preserved. The original cancelled No.13 study remains cancelled.

Visual impact of this access investigation: not affected. No source-view provisioning, service restart, Git delivery, PDF export or publishing occurred.
