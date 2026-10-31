---
name: Genki
description: "A private, offline-first tracker for water, food and training, drawn as a sober Material 3 gym notebook: ink blue on ivory paper."
colors:
  ink-blue: "rgb(38, 94, 167)"
  on-ink-blue: "rgb(255, 255, 255)"
  ink-tint: "rgb(217, 227, 248)"
  ink-tint-text: "rgb(18, 28, 43)"
  ink: "rgb(29, 27, 23)"
  ink-soft: "rgb(74, 70, 63)"
  pencil: "rgb(123, 119, 110)"
  paper: "rgb(254, 248, 241)"
  paper-card: "rgb(249, 243, 236)"
  paper-bar: "rgb(243, 237, 230)"
  paper-dialog: "rgb(237, 231, 224)"
  sand: "rgb(232, 226, 216)"
  error-red: "rgb(186, 26, 26)"
  inverse-surface: "rgb(50, 48, 44)"
  inverse-ink: "rgb(246, 240, 233)"
  water-tint: "rgb(214, 227, 255)"
  water-tint-ink: "rgb(0, 27, 60)"
  calories-tint: "rgb(249, 216, 254)"
  calories-tint-ink: "rgb(40, 19, 47)"
  protein-tint: "rgb(178, 237, 235)"
  protein-tint-ink: "rgb(0, 32, 31)"
  pace-green: "#007334"
  pace-orange: "#B56A00"
  pace-red: "#9E1910"
typography:
  headline-md:
    fontFamily: "Nunito, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "36px"
    letterSpacing: "0px"
  headline-sm:
    fontFamily: "Nunito, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "32px"
    letterSpacing: "0px"
  title-lg:
    fontFamily: "Nunito, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "0px"
  title-md:
    fontFamily: "Nunito, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "0.15px"
  body-lg:
    fontFamily: "Nunito, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0.15px"
  body-md:
    fontFamily: "Nunito, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0.25px"
  body-sm:
    fontFamily: "Nunito, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.4px"
  label-lg:
    fontFamily: "Nunito, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0.1px"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  button: "20px"
  dialog: "28px"
  track: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  screen:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "{spacing.lg}"
  button-tonal:
    backgroundColor: "{colors.ink-tint}"
    textColor: "{colors.ink-tint-text}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    height: "48px"
  button-filled:
    backgroundColor: "{colors.ink-blue}"
    textColor: "{colors.on-ink-blue}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    height: "48px"
  button-text:
    textColor: "{colors.ink-blue}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    height: "48px"
  gauge:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.ink}"
    typography: "{typography.headline-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  metric-disc-water:
    backgroundColor: "{colors.water-tint}"
    textColor: "{colors.water-tint-ink}"
    rounded: "{rounded.lg}"
    size: "32px"
  metric-disc-calories:
    backgroundColor: "{colors.calories-tint}"
    textColor: "{colors.calories-tint-ink}"
    rounded: "{rounded.lg}"
    size: "32px"
  metric-disc-protein:
    backgroundColor: "{colors.protein-tint}"
    textColor: "{colors.protein-tint-ink}"
    rounded: "{rounded.lg}"
    size: "32px"
  greeting:
    textColor: "{colors.ink}"
    typography: "{typography.title-lg}"
  greeting-line:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-lg}"
  gauge-label:
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-lg}"
  gauge-detail:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-md}"
  gauge-track:
    backgroundColor: "{colors.sand}"
    rounded: "{rounded.track}"
    height: "12px"
  gauge-fill-green:
    backgroundColor: "{colors.pace-green}"
    rounded: "{rounded.track}"
    height: "12px"
  gauge-fill-orange:
    backgroundColor: "{colors.pace-orange}"
    rounded: "{rounded.track}"
    height: "12px"
  gauge-fill-red:
    backgroundColor: "{colors.pace-red}"
    rounded: "{rounded.track}"
    height: "12px"
  gauge-tick:
    backgroundColor: "{colors.ink}"
    width: "2px"
    height: "12px"
  actions-bar:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.ink}"
    padding: "{spacing.lg}"
  card:
    backgroundColor: "{colors.paper-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  list-secondary-line:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-md}"
  chip:
    backgroundColor: "{colors.ink-tint}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.sm}"
  segmented-button:
    backgroundColor: "{colors.ink-tint}"
    textColor: "{colors.ink-tint-text}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    height: "48px"
  text-field:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.xs}"
  text-field-error:
    textColor: "{colors.error-red}"
    typography: "{typography.body-sm}"
  dialog:
    backgroundColor: "{colors.paper-dialog}"
    textColor: "{colors.ink}"
    typography: "{typography.headline-sm}"
    rounded: "{rounded.dialog}"
    padding: "{spacing.xl}"
  snackbar:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-ink}"
    rounded: "{rounded.xs}"
  tab-bar:
    backgroundColor: "{colors.paper-bar}"
    textColor: "{colors.ink-soft}"
    height: "80px"
  tab-indicator:
    backgroundColor: "{colors.ink-tint}"
    rounded: "{rounded.lg}"
    width: "64px"
    height: "32px"
  outline-border:
    textColor: "{colors.pencil}"
---

# Design System: Genki

## Overview

**Creative North Star: "Le carnet de salle"**

Genki looks like the notebook kept in a gym bag: dense and useful first, nothing ornamental. Every pixel on the main screens carries a number the author needs now (water, calories, protein), a control that changes it, or a state that says whether it is saved. It is read at arm's length, one-handed, between sets and often with no network, so legibility and a one-tap reach come before expression.

The interface is Material 3 through React Native Paper, used without decoration: tonal buttons for actions, soft cards for the day's lists, and one gauge pattern repeated down the Today screen. The voice is calm and utilitarian, with warmth where it costs nothing: an ivory page, black ink and one ballpoint blue; a rounded type; an icon on a pastel disc for each measure; a greeting by first name and a sentence on what is left. The first version was drier, and the author found it too sober once it ran on a phone: the warmth was added on 2026-10-31 without turning the screen into decoration. The app is light-only for now.

The palette was chosen on 2026-10-31, after the first critique found the Material baseline violet and the navigation library's iOS blue living side by side. It is a Material 3 scheme from a blue seed on warm neutrals, held in one file (`src/theme.ts`). The roles, not the hues, are what code depends on, so the palette can still change without touching a screen. Material governs structure, navigation and interaction; brand expresses itself through Material's theming.

**Key Characteristics:**
- One signature pattern: the gauge, in a soft card: an icon disc and a label, the day's figure in 24 sp, a 12 dp track with a tick for where the day should be by now, then the goal and what is left.
- Reading and acting are separate: the gauges scroll; the frequent actions stay pinned above the tab bar.
- One accent, rare: ink blue on filled buttons, text buttons, focus and the pale selected tint. Three pastel tints only mark the measures on their icon discs.
- Tonal, never loud: actions are `contained-tonal`; a filled button is a screen's single committing action.
- Depth is tonal: page, then the action bar and cards, then the tab bar, then dialogs. No custom shadow.
- Light theme only, dark-content status bar, one theme for Paper and the navigation chrome.
- 48 dp touch targets and a French accessibility name and hint on every control.
- Nunito, rounded and warm, in two weights.

## Colors

Ink blue on ivory paper: a restrained Material 3 scheme with warm neutrals, plus a traffic-light trio that exists only to read pace on the gauges.

### Primary
- **Ink Blue** (rgb(38, 94, 167)): the ballpoint. Filled buttons (« Se connecter avec Google », « Ajouter à Déjeuner », « Enregistrer »), the labels of text buttons (Annuler, Enregistrer, « Enregistrer comme favori »), a focused field's label and underline. White (rgb(255, 255, 255)) is its on-color. Rare on a screen by construction, because most actions are tonal.

### Secondary
- **Ink Tint** (rgb(217, 227, 248)) with **Ink Tint Text** (rgb(18, 28, 43)): the working surface of actions and selection. Every « +250 ml », « + Repas » and « Ajouter » button, the pill under the open tab, the chosen segment of the add-food switch, the « cru » / « cuit » chip.

### Neutral
- **Ink** (rgb(29, 27, 23)): primary text, and the gauge tick.
- **Ink Soft** (rgb(74, 70, 63)): secondary lines such as « 150 g · 210 kcal », the gauge label and its goal line, chip text, inactive tab labels.
- **Pencil** (rgb(123, 119, 110)): the border of outlined buttons and of the segmented switch.
- **Paper** (rgb(254, 248, 241)): the page behind everything, and the header. Warm ivory, tone 98: not the cooler tone 99, which comes out violet-white.
- **Paper Card** (rgb(249, 243, 236)): Paper's surface level 1: cards (the day totals, one per meal) and the pinned action bar.
- **Paper Bar** (rgb(243, 237, 230)): level 2, the tab bar.
- **Paper Dialog** (rgb(237, 231, 224)): level 3, dialogs and the water sheet.
- **Sand** (rgb(232, 226, 216)): the fill of text fields and the empty part of a gauge track.
- **Error Red** (rgb(186, 26, 26)): invalid input and the sign-in failure message. It is Material's error role, distinct from the pace red.
- **Inverse Surface** (rgb(50, 48, 44)) with **Inverse Ink** (rgb(246, 240, 233)): the snackbars, whose action takes the inverse primary.

### Measure tints (custom, outside the Material roles)
- **Water Tint** (rgb(214, 227, 255)), **Calories Tint** (rgb(249, 216, 254)) and **Protein Tint** (rgb(178, 237, 235)), each with its dark icon color (rgb(0, 27, 60), rgb(40, 19, 47), rgb(0, 32, 31)): the 32 dp disc under the icon of a gauge (a drop, a flame, a flexed arm). They are pastel and keep clear of green, ochre and brick, so a disc is never read as a pace. They live in the theme as `colors.metric`.

### Pace trio (custom, outside the Material roles)
- **Pace Green** (#007334), **Pace Orange** (#B56A00, an ochre) and **Pace Red** (#9E1910, a brick): the fill of a gauge, meaning « dans le rythme », « un peu en retard », « en retard ». On the calories gauge, orange and red also flag going over the goal (above 105 % and 110 %), which the line under the bar then states as « au-dessus de l'objectif ». Each is 3:1 or more against Sand, and they differ in lightness as well as hue, so red and green stay apart to eyes that confuse them. They live in the theme as `colors.pace`.

### Named Rules
**The Rare Ink Rule.** Ink Blue is the only accent and it stays under a tenth of any screen. A new emphasis uses weight, size or the Ink Tint before it uses more blue. The measure tints are identity, not emphasis: one per measure, on its disc and nowhere else.

**The Role-Not-Value Rule.** New code asks the theme for a role (primary, secondaryContainer, surface, `colors.pace`) and never writes a color value, so the palette stays a one-file change. `src/theme.test.ts` holds the contrast of every pair in use: 4.5:1 for text, 3:1 for controls and gauge fills.

**The Pace-Only Rule.** Green, orange and red mean pace on a gauge and nowhere else. Errors use Material's error red; sync state uses neutral icons, because offline is a normal state, not a fault.

**The Tick-Beside-Color Rule.** A gauge's pace color is always paired with the 2 dp expected-progress tick, so the fill's end relative to the tick says what the color says. The words reach TalkBack through the gauge's accessibility value.

## Typography

**Display Font:** none; no display face is used.
**Body Font:** Nunito, in regular for reading and semi-bold for titles and labels, loaded before the first frame (about 460 KB). Android picks a font file per family, so in the theme the weight is in the family name (`Nunito_400Regular`, `Nunito_600SemiBold`) and no variant asks for a weight on top. The frontmatter writes the weight (400, 600) to say the intent.
**Label/Mono Font:** the same face; the gauge figures ask for tabular numerals so digits do not shift as the day's total grows, where the face has them.

**Character:** A rounded, friendly sans at Material 3's scale. Nothing competes with the numbers, which carry the screen. Type follows the system font size, so layouts must survive a larger scale: a figure sits on its own line and wraps instead of overflowing. Frontmatter sizes are written in px for portability; in React Native they are unitless sp.

### Hierarchy
- **Headline Medium** (400, 28 / 36): the product name on the sign-in screen, the only place it appears.
- **Headline Small** (400, 24 / 32): the day's figure on a gauge (« 1,5 L », « 1 100 kcal »), and the title of every Paper dialog.
- **Title Large** (400, 22 / 28): the greeting on Today and the food name on a food's fiche.
- **Title Medium** (600, 16 / 24, letter-spacing 0.15): meal headings and the day totals on Repas.
- **Body Large** (400, 16 / 24, letter-spacing 0.15): the sentence under the greeting, list titles and the macros line of a fiche.
- **Body Medium** (400, 14 / 20, letter-spacing 0.25): the line under a gauge (« sur 2,5 L · reste 1 L »), the per-meal kcal and the Glucides · Lipides line.
- **Body Small** (400, 12 / 16, letter-spacing 0.4): the helper text under a field.
- **Label Large** (600, 14 / 20, letter-spacing 0.1): every button, segment and chip label, and a gauge's label.

### Named Rules
**The French Number Rule.** Numbers are formatted for fr-FR: comma decimal, grouped thousands, and the unit after the value (« 1 100 kcal », « 1,5 L »). Text is sentence case with French typographic apostrophes.

**The Figure-Leads Rule.** On a reading surface the number is the largest thing and its label the quietest: the eye finds « 1 100 kcal » before « Calories », and « reste 1 100 kcal » answers the question the number raises.

## Layout

One column per screen on a phone in portrait. Screens use a 16 dp gutter and a 16 dp gap between blocks; inside a card the padding is 16 dp and the gap 8 dp; a gauge's touch area pads 12 dp with 4 dp between its rows; a form's fields stack with a 12 dp gap and wrapping rows of buttons or chips use 8 dp. The sign-in screen centers its content with 24 dp padding. There are no breakpoints and no tablet layout; the reference width is 360 dp.

Today splits into two groups. The upper region scrolls: a greeting (« Bonjour » until 18 h, « Bonsoir » after, then the first name from the Google account) with one sentence on what is left of the water and protein goals (or a bravo when they are reached; calories wait for the goal modes), then the gauge cards, then, with a programme in progress, the « Séance du jour » card (a dumbbell on a disc, the session name, its phase and week, and a tonal « Démarrer »). Below them, outside the scroll, the action bar holds the water amounts and « + Repas » on one row (wrapping to two on a narrow phone or a large font); a take-back snackbar rests on the bar's top edge. The add-food screen opens as a modal with the header « Ajouter un aliment » and a bottom inset, and its four modes sit in two rows of two.

Sport lists the programme in progress as cards, one per session of the phase (the next one marked « Prochaine », each with a tonal « Démarrer »), then « Modifier le programme », « Repartir du modèle » and the milestones. A workout is one column of exercises, each with its last result and one row per set (load and reps, prefilled), a rest timer under the thumb (« Repos 1:30 », « Passer ») and a summary at the end; leaving it asks « Abandonner la séance ? ». The editor opens an exercise in a form, and an exercise opens its history.

Suivi opens on a hub of statistic cards (label, the number over the period, how it moved since the period before in muted ink, a thin curve, a chevron) under a Jour / Semaine / Année switch; « Modifier » moves, hides and adds cards from a dialog with 48 dp arrow buttons. A section screen has the switch with arrows to earlier periods, chips for the statistics of the section, a chart in a level-1 card, a summary (average, days on target, best day) and what is particular to the section (macros split, glasses of the day, sessions against planned). Charts are thin: bars with a rounded data end standing on a flat baseline, a dashed goal line, today dashed and unfilled; a day's tone is the pace green, ochre or brick, never the only signal, since the chart is also read aloud in words (« dans la cible », « loin de la cible »). Each measure has one solid hue of its own (theme `chart`), clear of the pace colors.

Navigation is a four-tab bottom bar (Aujourd'hui, Repas, Sport, Suivi) under a header whose right end holds the sync cloud. Every control is at least 48 × 48 dp, with at least 8 dp between neighbouring targets: Paper buttons get a 48 dp content height, icon buttons are sized to 48 × 48, and segment labels are padded to reach 48 dp.

Frontmatter dimensions are written in px; in React Native they are unitless dp.

## Elevation & Depth

Tonal layering, with Android's native elevation as a faint companion on cards. Paper's Surface paints a tint per level: the page is level 0 (Paper), cards and the pinned action bar are level 1, the tab bar level 2, dialogs and the water sheet level 3, so each nearer layer is a step darker on the same ivory. The snackbar (level 2, on the inverse surface) sits above everything. The app code defines no shadow, no elevation value and no custom motion; press feedback is Paper's ripple.

### Named Rules
**The Tonal-First Rule.** Depth comes from Paper's surface levels. Do not add a shadow, an elevation prop or a border to separate a block; change its surface level or its spacing.

## Shapes

Material 3's shape scale derived from Paper's base radius of 4 dp: text fields round 4 dp at the top, chips 8 dp (2×), buttons and segmented switches 20 dp (5×, a pill at 40 to 48 dp tall), dialogs 28 dp (7×), the snackbar 4 dp. The app adds three radii of its own: meal cards 12 dp, gauge cards 16 dp (the ripple is clipped to them), and the gauge track 6 dp (half its 12 dp height, a full pill). The pace tick is a square-ended 2 dp bar. Icon buttons are 48 dp circles. The measure discs are 32 dp circles. The tab indicator is a 64 × 32 dp pill.

## Components

Standard Paper components, restrained: a tonal button, a soft card, a flat field. The one custom component is the gauge.

### Buttons
- **Shape:** near-pill, 20 dp radius, 48 dp tall (content height forced to 48).
- **Tonal (default):** Ink Tint fill, Ink Tint Text label, an optional leading icon: a glass on « +250 ml » and « +500 ml », a fork and knife on « + Repas », a plus on « Ajouter » of each meal.
- **Filled:** Ink Blue fill, white label. Only a screen's committing action: « Se connecter avec Google » (with a loading state), « Ajouter à {repas} » on a fiche, « Enregistrer » on the custom-food form.
- **Outlined:** Pencil border, blue label. Secondary actions on a custom food's fiche (« Modifier l'aliment », « Supprimer l'aliment »).
- **Text:** blue label, no container. Dialog actions, « Retour », « Enregistrer comme favori » (star-outline).
- **Disabled:** Paper's disabled colors (a faded fill and label); a filled button stays disabled until the quantity or the form is valid.

### Gauge (signature component)
- **Structure:** a Paper Card card (16 dp radius, 16 dp padding, 48 dp minimum, 4 dp between rows), pressable as a whole. Row 1: the measure's disc and the label in Label Large and Ink Soft, a 24 dp icon at the right (plus when the tap adds, chevron-right when it opens). Row 2: the day's figure in Headline Small, tabular. Row 3: the 12 dp track. Row 4: « sur {objectif} · reste {x} » in Body Medium and Ink Soft, or « objectif atteint », or « au-dessus de l'objectif » for calories.
- **Fill:** one of the pace trio, drawn from the left up to the progress and full from 100 %, on a Sand track. It slides to its value over 450 ms when the screen opens or the total changes, and does not move when the phone asks for no animation. The 2 dp Ink tick sits at the share of the active day (7 h to 23 h) already elapsed.
- **Behavior:** the whole block is the target. Its accessibility label reads « Eau : 1,5 L, sur 2,5 L, reste 1 L », its value the pace words, its hint what the tap does (« Ajoute une quantité d’eau de ton choix », « Ouvre le journal des repas »).

### Action bar
- **Style:** a level-1 flat surface under the gauges, 16 dp padding and 8 dp gap, pinned above the tab bar. The water amounts and « + Repas » share one 48 dp row and grow to fill it; on a large font they wrap onto a second row.
- **Snackbar:** the « +250 ml ajoutés · Annuler » take-back rests on its top edge for 4 seconds.

### Chips
- **Style:** Ink Tint fill, Ink Soft label, 8 dp radius. The compact state chip reads « cru » or « cuit » beside a food's name and renders nothing for other foods. On a fiche, the quantity chips (a portion, « 100 g », the last quantity used) are tappable and fill the quantity field; the filter chips (Tous, Cru, Cuit) show a check when selected.

### Cards / Containers
- **Corner Style:** 12 dp.
- **Background:** Paper Card (Paper surface level 1); see Elevation & Depth.
- **Border:** none.
- **Internal Padding:** 16 dp, 8 dp gap. A meal card holds a header row (heading and kcal at the left, a tonal « Ajouter » at the right), the entries as list items with a chevron-right and « {grams} g · {kcal} kcal » as the secondary line, the empty line « Rien pour l'instant. », and a text button to save the meal as a favorite.

### Inputs / Fields
- **Style:** Paper's flat text field: Sand fill, 4 dp top corners, a floating French label (« Quantité (g) », « Rechercher un aliment », « Nom »), numeric keyboard for quantities.
- **Focus:** label and underline turn Ink Blue.
- **Error:** helper text in Error Red, Body Small, under the field, announced politely to a screen reader (« La quantité doit être comprise entre 0 et 5 000 g. »).

### Segmented switch
- **Style:** the four add-food modes (Favoris, Récents, Recherche, Créer) in two rows of two, Pencil borders and 20 dp outer corners. The chosen segment takes Ink Tint and a check, so it is not told by its tint alone. The Cru / Cuit / Autre switch of the custom-food form is one row of three with the same check.

### Dialogs and sheet
- **Dialog:** Paper Dialog level 3, 28 dp corners, Headline Small title, text-button actions at the bottom right. For decisions that must interrupt: changing a journal line, naming a favorite, and confirming a delete that cannot be undone (« Supprimer {nom} du journal ? », « Supprimer l'aliment {nom} ? », « Supprimer le favori {nom} ? »), each with the same « Annuler » and « Supprimer ».
- **Water amount:** « Quantité d'eau », a small dialog with one numeric field in ml (above 0, up to 5 000, comma or point) and « Annuler » / « Ajouter ». It opens from the Eau gauge and replaces the former sheet of the day's glasses, which returns in Suivi (M4).

### Snackbar
- **Failure:** Inverse Surface, Inverse Ink, 4 dp radius, the message « L'enregistrement a échoué. », one « Réessayer » action and a close icon. No timeout; mounted only while a write has failed, never for pending or offline state.
- **Take-back:** the same shape with « +250 ml ajoutés » and « Annuler », 4 seconds, on Today only.

### Navigation
- **Tab bar:** Paper's Material 3 navigation bar, 80 dp on Paper Bar: four destinations, each an icon with a label (calendar-today for Aujourd'hui, silverware-fork-knife for Repas, dumbbell for Sport, chart-line for Suivi), the open one in a 64 × 32 dp Ink Tint pill with Ink-toned icon and label, the other in Ink Soft. Each tab is announced once, as a tab with its selected state.
- **Header:** the page color with a hairline, title at the left on Android. At the right, the sync cloud: 24 dp icon with 16 dp horizontal margin and a French label for each state (cloud-check-outline « Synchronisé », cloud-upload-outline « En attente d'envoi », cloud-off-outline « Hors-ligne », cloud-alert « Erreur de synchronisation »).

## Do's and Don'ts

### Do:
- **Do** use tonal buttons for in-flow actions and keep the filled button for a screen's one committing action.
- **Do** give every control a 48 × 48 dp target, at least 8 dp from its neighbour, and a French accessibility name that starts with its visible text.
- **Do** read colors through the theme: roles from Paper, `colors.pace` for the gauges. No color value in a screen.
- **Do** build any new daily metric as a gauge: label, figure, track, then the goal and what is left; plus when a tap adds and chevron-right when it opens.
- **Do** announce what appears under a field (errors, empty results, previews) with a polite live region.
- **Do** ask before deleting what cannot come back, naming the object on the message and the action on the button; offer « Annuler » for what can.
- **Do** format numbers for fr-FR and put the unit after the value.
- **Do** keep sync state visible in the header cloud and treat offline as a normal state, in neutral icons.
- **Do** keep the app light-only, with one theme for Paper and the navigation chrome, until a dark scheme is designed on purpose.

### Don't:
- **Don't** use green, orange or red for anything but pace; errors use Error Red.
- **Don't** add ornament beyond the icons and discs: no illustration, gradient, hero image or decorative color. Every pixel carries a number, a control, a state or a measure's identity.
- **Don't** rely on color alone for pace: keep the tick and the accessibility words with every gauge.
- **Don't** add a shadow, an elevation value or a divider to separate blocks; use the surface level or the spacing.
- **Don't** write a color value in a screen, or add an accent beside Ink Blue and the pace trio.
- **Don't** put an action that is used every day inside the scrolling content; pin it with the others above the tab bar.
- **Don't** pad a label out to fit: if four labels do not fit a row at a larger system font, they go in two rows.
