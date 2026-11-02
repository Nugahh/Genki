# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

The primary user is the author, a former high-level athlete (parkour, basketball, handball, gymnastics) restarting sport after ten years. The goals, in priority order: hydration and nutrition first, then the training programme, then body weight, steps and tobacco. In practice: lose fat (visceral fat in particular), rebuild strength, volume and explosiveness without losing agility, and quit smoking.

Situations of use: logging water or a habitual meal in one tap during the day; entering sets between exercises in the gym, often with no network; checking the day at a glance. One account is used on two phones. Friends may be invited later, so all data is already stored per user.

## Product Purpose

A personal mobile tracker for water, food, a phased training programme and a few body measures (weight, waist, steps, tobacco).

Success, as defined by the author:
- it opens every day without friction, and one tap is enough for water and habitual meals;
- the home screen shows water, calories, protein, steps, weight, smoke-free days and today's session at a glance;
- each workout shows last time's loads pre-filled and the load to aim for;
- the data is identical on two phones and nothing is lost if a device is lost;
- everything works offline (gym) and syncs when the network returns.

## Positioning

A private, offline-first tracker built around one person's own programme and the official French food composition table (Anses Ciqual), embedded in the app, completed by the products of brands from Open Food Facts, a public crowd-sourced database that is read online and kept only when a product is used. It is not a social or coaching app. It has no server to run and no subscription.

## Operating Context

- The gym, with poor or no network, one hand free, the phone used between sets.
- The kitchen and the table, to log meals from the Ciqual table with raw and cooked foods, portions, custom foods, foods marked with a star and saved meals, or from a product of a brand found by name or by scanning its barcode (Open Food Facts, which needs the network the first time). A meal can be logged at another time or day than now.
- Steps come from the phone or a Fitbit through Android Health Connect.
- Data lives in Cloud Firestore in the Paris region (Firebase Spark plan, Google sign-in); the food table ships inside the app. The only other service the app talks to is Open Food Facts: only the text searched or the barcode scanned leaves the phone, with nothing that identifies the account.

## Capabilities and Constraints

- Android first, as an Expo / React Native development build with a Material 3 interface (React Native Paper). The iPhone version (HealthKit, Sign in with Apple) comes at the last planned milestone and reuses the same interface; it is not a second design language.
- The interface is in French, with metric units (kg, cm, L, kcal) and French dates and number formats.
- Offline-first with automatic sync between two phones. No backend and no REST API of its own. One developer; running cost must stay at zero.
- Health data is private by default and kept in a European region. The app gives no medical advice: it shows a reminder to consult a professional before changing diet or resuming intense activity. Safety floors are domain constants that cannot be edited from the interface: at least 1,500 kcal per day proposed, at most 1% of body weight lost per week.
- Scope in the app: water and the Today screen; food (Ciqual, products of brands, barcode scan, 26 micronutrients against the ANSES references of the profile, macro goals with net carbs, a day and time for each meal); the training programme with progression and milestones; a stats hub over a day, week, month or year with configurable metrics; steps; tobacco; body measures; settings with a JSON export and import. The iPhone version is on its own branch and is not merged.
- Planned next: recipes and saved meals built from ingredients among the custom foods.
- Out of scope: a parkour-style skill tree, an LLM assistant, friends and multi-user, Google Health API, readings from a connected scale, reading QR codes.

## Brand Commitments

The product is called Genki. The name has not been declared final.

## Evidence on Hand

- The design specification and the implementation plans: `docs/superpowers/specs/2026-10-23-fitness-tracker-design.md` and `docs/superpowers/plans/`.
- The Ciqual 2025 table (Anses, Etalab 2.0 licence) is embedded; the food database holds 3,400 foods, with 26 nutrients each where Ciqual gives them. Open Food Facts (ODbL licence) supplies the products of brands.
- Absent, and not to be fabricated: any real usage data, screenshots from a device, user testimonials, customers or benchmarks.

## Product Principles

1. Frequent actions cost one tap: logging must be quicker than skipping it.
2. Offline is the normal case, not an error state: a write is never lost, and the sync state is always visible.
3. The numbers are honest: macros are frozen when logged, and a missing value is left out rather than guessed.
4. The data belongs to the user: it is private, stored per user and exportable.
5. Guard rails, not advice: safe limits are built in, and the app never claims medical authority.

## Accessibility & Inclusion

Touch targets are at least 48 dp with a press effect and an accessibility label in French on every control.
