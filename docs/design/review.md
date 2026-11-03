# Ortaq visual rework — review and evidence

## The direction

**One motif**, seed **2003435766**. An apartment window organizes the identity, the scene, the welcome illustration and the interface surfaces. The theme is **120 windows. One shared home.** The setting is the brief's Astana building, rather than an unrelated stock photograph.

The direction's roles map to actual application states: arrival introduces the home; window selection makes it tangible; the cinematic explains the process; the live journal and expense report provide proof; the real OTP form opens the building. No fabricated customer logos, endorsements or extra marketing sections were added.

One type redraw: the initial Switzer files restricted redistribution through repositories. The replacement draw gave **Libre Franklin / Source Serif 4**, both SIL OFL. The first carries controls, figures and headings; the second carries the human narrative. Flutter uses static font instances, since the variable Libre Franklin source defaults to weight 100 in CanvasKit. Font provenance and licenses are bundled with the assets.

## What changed

- A moonlit courtyard, individual warm windows, porch lighting, balconies, benches, footsteps and neighbours replace the pale slab-model presentation. Real issue, voting and balance colours remain distinct.
- The public entrance has one dominant scene, a two-line headline, a direct story action, and a real sign-in dialog. The previous fake flat towers and generic floating-card composition are gone.
- The keyboard-accessible window picker and direct 3D window selection reveal the same apartment and smoothly move the camera to it. Apartment 45 leads into the existing scripted process.
- The film follows Arman noticing a cold corridor, neighbours joining, someone taking responsibility, and warmth returning. It retains all nine stages and the explicit scripted-data notice.
- The money control brings the camera to the fund; selecting a problem or apartment returns the focus to the home. Actor data and private balances still come from the existing API.
- The resident and management homes use the same window mark, local type, quiet paper surfaces and actual live 3D preview. Shared expenses, care needs, notices and advisory voting remain functional.
- The phone gets a separate stacked scene area so the model cannot cross behind the headline or story action. Tablet and desktop retain their own compositions.

## Picture review

Baseline: tidy but anonymous, with five medium-sized floating panels, small tracked labels and a cold blue wash. Self-review: design 5.8, usability 7.0, creativity 4.8, content 6.4 — **6.0/10 weighted**.

Round one: the much larger scene and type established a clear point of view, but the lighting bleached the windows and the snow weakened text contrast. Corrected per-instance emissive tint, moonlight and snow material.

Round two: the desktop held as a poster, but the phone's building crossed through the copy. Corrected the phone/tablet scene viewport and camera. The first Flutter render also exposed the variable font's 100-weight default; generated and registered static 400/600/700 faces.

Final review: one dominant object, two headline lines at every tested width, no horizontal overflow, a specific place and resident story, readable typography, real controls and a coherent window motif across all three apps. There are no stock photographs; the scene and welcome illustration are code-native artwork of the subject. The phone and tablet are separate compositions, not scaled desktop canvases.

Final self-review: design **8.0**, usability **7.8**, creativity **8.0**, content **8.0** — **7.9/10 weighted**. This is an internal critique, not an external award or user approval. The model remains intentionally stylized, and dense data views still use conventional application layouts.

The final money pass also separated the six category labels into a legible fan around the fund and kept each film chapter focused on its own event. A domain regression check now proves that live voter windows cannot appear in the scripted film before its voting chapter.

## Checks

- Source taste lint: **0 failures**. Remaining warnings are the real clock's zero padding and blur on actual application overlays. These overlays retain glass because the product brief explicitly requests it; the public entrance has no ornamental glass cards.
- The skill's local Chrome inspector could not start because the sandbox denies Chrome's socket operation. Playwright's connected browser supplied the visual and DOM checks instead. No automated-inspector pass is claimed.
- Headline measured at **2 lines** and no document overflow at **1440**, **768**, and **390** pixels. Screenshots reviewed at each width, then the mobile scene collision corrected.
- Flutter analysis and both web release builds, strict TypeScript/Vite build, existing backend race tests and all six 3D domain checks.
- Browser checks use generated API fixtures through request routing. They verify the compiled interfaces, not a Docker/PostgreSQL deployment.
- Full Docker smoke verification and integrated-GPU frame-rate benchmarking retain the limitations documented in the README.

## Image and type provenance

All scene geometry, the window mark and the Flutter welcome drawing are original code-native assets. Screenshots show the actual compiled applications with the existing generated seed data. No archival or stock photography stands in for the building.

Libre Franklin: https://github.com/google/fonts/tree/main/ofl/librefranklin

Source Serif 4: https://github.com/google/fonts/tree/main/ofl/sourceserif4

Full SIL OFL notices and the preparation note are in `web3d/public/fonts/` and `flutter/assets/fonts/`.

## Final interaction evidence

The compiled browser checks confirmed: apartment 45 can be chosen by keyboard and opens its story; Escape closes the sign-in dialog; the resident card connects to the correct apartment; the management compact preview connects to the building; duplicate suggestions remain present; attaching the generated photo enables submit; the private-balance link and management board remain reachable. Cinematic pause stayed stable, seeking reached the 68% scripted result, and the film emitted zero API write requests during the check. All six category nodes render in the expense chapter. Reduced-motion emulation reports no headline entrance animation.

Representative renders: [desktop](../screenshots/3d-arrival.png), [phone](../screenshots/3d-phone.png), [resident](../screenshots/resident-home.png), [management](../screenshots/admin-overview.png), [film](../screenshots/cinematic.png), [fund](../screenshots/cinematic-expenses.png).
