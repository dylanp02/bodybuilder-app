# LiftLedger — Technical Development Brief

> **Purpose:** This document is the canonical onboarding reference for a fresh Claude instance.
> It covers every layer of the project—from infrastructure to UI patterns—so that a new
> session can reason about, extend, or debug any part of the app without needing to re-read
> every source file.

---

## 1. Project Identity

| Field | Value |
|---|---|
| App name | **LiftLedger** |
| Expo slug | `liftledger` |
| Bundle ID (iOS) | `com.dylanpalmer.liftledger` |
| Android package | `com.dylanpalmer.liftledger` |
| Deep-link scheme | `bodybuilderapp://` |
| Supabase project ref | `wryqwwxhelcxoroxuyyx` |
| EAS project ID | `0104b35d-80bc-4fe0-9b21-b3a12c58a26a` |
| Developer | Dylan Palmer (`dylanpalmer02@gmail.com`) |

LiftLedger is a React Native / Expo bodybuilding & fitness tracking app. The working
directory is `C:\Users\dylan\BodybuilderApp`. Main branch is `main`.

---

## 2. Tech Stack & Key Dependencies

### Runtime
- **Expo SDK 54** with **Expo Router v6** (file-based routing)
- **React Native** (cross-platform iOS & Android)
- **TypeScript** throughout

### Backend
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
  - JS client: `@supabase/supabase-js@2`
  - Storage: `expo-secure-store` (used by the Supabase auth session adapter)
- Edge Functions run on **Deno** (ESM imports from `https://esm.sh/`)

### Monetisation
- **RevenueCat** (`react-native-purchases`) — live in-app purchase gating
- **Supabase `profiles.is_pro` column** — server-side Pro truth

### Error monitoring
- **Sentry** (`@sentry/react-native`) — init at module level in `_layout.tsx`, ErrorBoundary,
  `captureException` with tags throughout

### Notifications
- **`expo-notifications`** — local scheduling (training reminders, weight log reminders)
- **Expo Push API** (`https://exp.host/--/api/v2/push/send`) — server-side push batches
  from the `bodyweight-reminder` Edge Function

### UI
- **`react-native-svg`** — custom `LineChart` component
- **`react-native-safe-area-context`** — `useSafeAreaInsets()` in root layout
- **`expo-status-bar`** — `StatusBar` with `backgroundColor="#000"`

### Other
- **`@react-native-async-storage/async-storage`** — local preferences & notification ID cache
- **`expo-constants`** — reads `app.config.ts` `extra{}` values at runtime

### Build
- **EAS Build** — profiles: `development` (dev client), `preview` (internal APK/IPA),
  `production` (store)
- **`app.config.ts`** (TypeScript, replaces `app.json`) — dynamic config, reads
  `process.env.*` for secrets injected via EAS Secrets

---

## 3. Project Structure

```
BodybuilderApp/
├── app/                         Expo Router pages
│   ├── _layout.tsx              Root layout — auth gate, Sentry, providers
│   ├── auth.tsx                 Email/password login & sign-up
│   ├── account.tsx              Profile display; email/password update
│   ├── onboarding/              4-step first-run flow
│   │   ├── _layout.tsx
│   │   ├── step-name.tsx        Step 1 — full name + username
│   │   ├── step-stats.tsx       Step 2 — height / weight (imperial or metric)
│   │   ├── step-goals.tsx       Step 3 — training goal + experience level
│   │   └── step-plan.tsx        Step 4 — choose: set up plan now or explore first
│   ├── (tabs)/                  Bottom tab group
│   │   ├── _layout.tsx          Tab bar definition (Today, Workout, Progress, Planner)
│   │   ├── index.tsx            Today tab — weight log, top sets, next session
│   │   ├── workout.tsx          Active workout logger + plate calculator
│   │   ├── progress.tsx         Consistency calendar + per-exercise progress charts
│   │   ├── planner.tsx          Pro training plan builder
│   │   └── planner.tsx          Pro training plan builder (continued)
│   ├── workout/[id].tsx         Workout detail (sets by exercise)
│   ├── workout-detail/[id].tsx  Redirect → workout/[id]
│   ├── weight-history.tsx       Bodyweight chart + log list
│   ├── top-sets.tsx             Record a new top set (1RM or working)
│   ├── measurements.tsx         Pro — body measurement tracking
│   ├── workout-template.tsx     Pro — create/save custom workout templates
│   ├── subscription.tsx         Live RC offerings, purchase & restore
│   ├── notifications.tsx        Notification preferences
│   ├── settings.tsx             App settings + developer row (DEV only)
│   └── debug.tsx                DEV-only diagnostics (Pro, Auth, RC)
├── components/
│   ├── LineChart.tsx            SVG line chart (weight, measurements, exercise progress)
│   └── ProBanner.tsx            Persistent upgrade prompt strip (hidden when isPro)
├── constants/
│   └── theme.ts                 DarkColors, LightColors, Spacing, FontSize, Radius
├── lib/
│   ├── supabase.ts              Supabase client + getCurrentUser()
│   ├── ThemeContext.tsx         Dark/light + metric/imperial context
│   ├── ProContext.tsx           RevenueCat + profiles.is_pro runtime Pro gate
│   ├── proAccess.ts             DEV_PRO_UNLOCKED compile-time override (currently false)
│   ├── notifications.ts         Local scheduling + push token registration
│   ├── notifPrefs.ts            Notification preference schema + AsyncStorage helpers
│   ├── planProjection.ts        generateProjectedDates() — calendar overlay
│   ├── utils.ts                 isoDate(), formatShortDate(), errorMessage(), etc.
│   ├── constants.ts             MUSCLE_GROUPS, EQUIPMENT_FILTERS
│   └── types.ts                 All shared TypeScript interfaces
├── supabase/
│   ├── functions/
│   │   ├── bodyweight-reminder/ Daily push notification Edge Function
│   │   └── revenuecat-webhook/  RC webhook → profiles.is_pro update
│   ├── cron_bodyweight_reminder.sql  pg_cron job (run once in SQL Editor)
│   └── add_is_pro_column.sql   Migration for profiles.is_pro
├── app.config.ts                Dynamic Expo config (replaces app.json)
├── eas.json                     EAS build profiles
└── tsconfig.json                Excludes supabase/functions (Deno globals)
```

---

## 4. Configuration & Secrets

### `app.config.ts`
All runtime secrets are injected via `extra{}` and read with
`Constants.expoConfig?.extra?.<key>`. Keys:

| Key | Purpose |
|---|---|
| `supabaseUrl` | Supabase project URL |
| `supabaseAnonKey` | Supabase anon key |
| `sentryDsn` | Sentry DSN |
| `revenueCatApiKey` | RevenueCat public API key (test: `test_nvpeGAnBJgESZptnnvafWtVBvjd`) |
| `eas.projectId` | `0104b35d-80bc-4fe0-9b21-b3a12c58a26a` |

At build time `app.config.ts` reads `process.env.EXPO_PUBLIC_SUPABASE_URL` etc., which
are injected by EAS Secrets (`eas env:create`).

### EAS Secrets (set via `eas env:create --name KEY --value VALUE --environment all`)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SENTRY_DSN`
- `REVENUECAT_API_KEY`

### Supabase Edge Function environment
Edge Functions receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
Additional secrets are set in Supabase Dashboard → Edge Functions → Secrets:
- `REVENUECAT_WEBHOOK_SECRET` — compared against `Authorization: Bearer <token>` header

### `.gitignore` additions
`.env`, `sentry.properties`

---

## 5. Supabase Backend

### Database schema (key tables)

**`profiles`** (1-to-1 with `auth.users`)
```
id uuid PK (= auth.users.id)
username text UNIQUE
full_name text
height_inches integer
weight_lbs numeric
goal text            ('aesthetics' | 'strength' | 'endurance' | 'general')
experience_level text ('beginner' | 'intermediate' | 'advanced')
onboarding_complete boolean DEFAULT false
is_pro boolean DEFAULT false
push_token text NULL
```

**`weight_logs`**
```
id uuid PK
user_id uuid FK → auth.users
date date
weight_lbs numeric
UNIQUE (user_id, date)
```

**`workouts`**
```
id uuid PK
user_id uuid FK → auth.users
name text
date date
created_at timestamptz
```

**`workout_sets`**
```
id uuid PK
workout_id uuid FK → workouts
exercise_id uuid FK → exercises
set_number integer
reps integer NULL
weight_lbs numeric NULL
```

**`exercises`** (shared library + user-created)
```
id uuid PK
user_id uuid NULL (NULL = system exercise)
name text
muscle_group text  (see MUSCLE_GROUPS constant)
equipment text NULL
is_compound boolean
notes text NULL
created_at timestamptz
```

**`top_sets`**
```
id uuid PK
user_id uuid FK → auth.users
exercise_id uuid FK → exercises
set_type text  ('1rm' | 'working')
reps integer NULL
weight_lbs numeric
date date
created_at timestamptz
```

**`measurements`** (Pro)
```
id uuid PK
user_id uuid FK → auth.users
date date
chest_cm numeric NULL
waist_cm numeric NULL
hips_cm numeric NULL
left_arm_cm numeric NULL
right_arm_cm numeric NULL
left_thigh_cm numeric NULL
right_thigh_cm numeric NULL
notes text NULL
```

**`workout_templates`** (Pro)
```
id uuid PK
user_id uuid FK → auth.users
name text
exercises jsonb  (array of TemplateExerciseData)
created_at timestamptz
```

**`training_plans`** (Pro)
```
id uuid PK
user_id uuid FK → auth.users
plan_type text  ('weekly' | 'cycle')
plan_name text
duration_weeks integer DEFAULT 8
start_date date
schedule jsonb  (WeeklySchedule or CycleSchedule)
is_active boolean DEFAULT true
created_at timestamptz
updated_at timestamptz
UNIQUE INDEX on (user_id) WHERE is_active = true  -- one active plan per user
```

### Row Level Security
All user-data tables have RLS enabled with `auth.uid() = user_id` policies.
Note: `workout_sets` joined to `workouts` via a foreign key does **not** automatically
filter by user in progress queries — the app manually re-filters by `user_id` after
fetching joined data.

### Edge Functions

**`supabase/functions/revenuecat-webhook/index.ts`**
- Endpoint called by RevenueCat webhooks
- Auth: strips `Bearer ` prefix, compares raw token against `REVENUECAT_WEBHOOK_SECRET`
- `PRO_EVENTS` set → `UPDATE profiles SET is_pro = true`
- `REVOKE_EVENTS` set → `UPDATE profiles SET is_pro = false`
- Uses service role key (auto-injected) to bypass RLS

**`supabase/functions/bodyweight-reminder/index.ts`**
- Endpoint called by daily pg_cron job (09:00 UTC)
- Auth: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- Logic:
  1. Query `weight_logs` for anyone who logged in the last 5 days
  2. Query `profiles` where `push_token IS NOT NULL`
  3. Filter out users in step 1
  4. Batch-send via Expo Push API (100/batch)
- Notification: `title: "Log your weight"`, `channelId: "bodybuilderapp-reminders"`

### pg_cron job
`supabase/cron_bodyweight_reminder.sql` — run once in SQL Editor after enabling
`pg_cron` and `pg_net` extensions. Replaces `<SERVICE_ROLE_KEY>` placeholder before running.

---

## 6. Authentication & Session Management

### Auth flow (`app/auth.tsx`)
- Email + password only (no OAuth currently)
- Sign-up creates `auth.users` row; Supabase trigger should create matching `profiles` row
- **Email confirmation is disabled** in the Supabase dashboard (dev setting). Gmail
  link-wrapping breaks `bodybuilderapp://` deep links, so confirmation was turned off.
- "Keep me signed in" checkbox: stores `'false'` in AsyncStorage under key
  `keep_logged_in`; `_layout.tsx` reads this on cold launch and signs the user out if `false`

### Deep-link handling (`app/_layout.tsx` — `handleAuthUrl`)
- PKCE flow: `bodybuilderapp://?code=xxx` → `supabase.auth.exchangeCodeForSession()`
- Implicit fallback: `bodybuilderapp://#access_token=xxx&refresh_token=yyy` →
  `supabase.auth.setSession()`

### Root layout gate (`app/_layout.tsx`)
```
No session          → renders app/auth.tsx
Session + onboarding_complete = false → renders app/onboarding/ (step-name)
Session + onboarding_complete = true  → renders app/(tabs)/
```
Loading state returns `null` (blank screen) to avoid flash.

### Supabase client (`lib/supabase.ts`)
```ts
export const supabase = createClient(url, anonKey, {
  auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true }
});
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
```
Throws a descriptive error at module load if `supabaseUrl` or `supabaseAnonKey` is missing.

---

## 7. Onboarding Flow

4 steps under `app/onboarding/` with `slide_from_right` animation between steps.
Each step upserts immediately so progress survives app backgrounding.

| Step | Screen | Data saved |
|---|---|---|
| 1 | `step-name.tsx` | `profiles.full_name`, `profiles.username` (3-20 chars, `[a-z0-9_]`) |
| 2 | `step-stats.tsx` | `profiles.height_inches`, `profiles.weight_lbs`; also inserts first `weight_logs` row |
| 3 | `step-goals.tsx` | `profiles.goal`, `profiles.experience_level` |
| 4 | `step-plan.tsx` | `profiles.onboarding_complete = true`; navigates to `/(tabs)` or `/(tabs)/planner` |

Step 2 honours the metric/imperial toggle from `ThemeContext` (`isMetric`). Heights stored
internally as inches; weights stored as lbs regardless of display unit.

Step 4 offers two CTA paths: "Set up my training program" (→ planner) or "Explore first"
(→ today tab).

---

## 8. Navigation & Routing

### Tab bar (`app/(tabs)/_layout.tsx`)
Four tabs: **Today** (`index`), **Workout**, **Progress**, **Planner**.
The Planner tab replaced the former Coach tab; no redirect alias exists.

### Screens outside tabs (Stack)
- `auth`, `onboarding` — unauthenticated / pre-onboarding
- `account`, `settings`, `notifications` — settings stack
- `subscription` — paywall
- `weight-history`, `top-sets`, `measurements`, `workout-template` — feature screens
- `workout/[id]` — workout detail (navigated to after saving a workout)
- `workout-detail/[id]` — redirect alias for above
- `debug` — DEV only diagnostic screen

### Linking
The root `Stack` in `_layout.tsx` only renders the top-level route name (`auth`,
`onboarding`, or `(tabs)`). Other routes are available because Expo Router auto-registers
all `app/**` files.

---

## 9. Core Feature Screens

### Today Tab (`app/(tabs)/index.tsx`)
- Shows today's bodyweight (last logged), quick-log button, top sets summary, and
  "Up Next" from the active training plan (via `generateProjectedDates`)
- `useFocusEffect` re-fetches on every visit

### Workout Logger (`app/(tabs)/workout.tsx`)
**Idle state:**
- "Start Blank Workout" button
- Built-in templates: Push Day, Pull Day, Leg Day (resolved by matching exercise names)
- "My Templates" — user's saved `workout_templates` rows (Pro feature, loaded with
  `useFocusEffect`)
- "Create Custom Template" → `/workout-template` (Pro gate)

**Active workout state:**
- Live stopwatch (seconds counter with `setInterval`)
- Workout name input
- Exercise cards with set rows (set number, last-session reference, reps, weight inputs)
- Warmup sets modal (W1, W2... prefixed rows, excluded from save)
- Historic sets loaded per exercise from `workout_sets` joined to `workouts`, filtered to
  the most recent session
- "Finish" → inserts `workouts` row then `workout_sets` rows, navigates to `workout/[id]`

**Plate Calculator** (collapsible bottom panel):
- Bar weight: 45 / 35 / 105 presets or custom
- Available plates: toggle on/off from [45, 35, 25, 10, 5, 2.5, 1] lb set
- Target weight → greedy algorithm solving "each side" plate combination
- Shows "Bar only" for target = bar weight; error if target unreachable

**Exercise picker modal:**
- Filterable by muscle group and equipment type
- "+ Create New Exercise" inline form → inserts to `exercises` table with `user_id`
- Newly created exercise immediately added to the current workout

### Workout Detail (`app/workout/[id].tsx`)
Read-only view: workout name, date, sets grouped by exercise (set number, reps, weight).

### Progress Tab (`app/(tabs)/progress.tsx`)
**Section 1 — Consistency Calendar:**
- Monthly grid with navigation
- Days with logged workouts: filled primary-color circles (tappable)
- Future planned days from active training plan: secondary-color circles (tappable)
- Today: ring outline
- Day modal: lists logged workouts (tap → workout detail) and/or planned cards from plan
- Plan projected dates loaded from `generateProjectedDates()` on `useFocusEffect`

**Section 2 — Exercise Progress:**
- "+ " button opens exercise picker modal
- Per tracked exercise: SVG `LineChart` of max weight per session (last 30 days),
  PR highlight, and scrollable workout history list
- Chart requires ≥ 2 data points (shows message if fewer)
- RLS note: sets query joins workouts; app manually filters `workouts.user_id === user.id`
  because the join can return other users' rows

### Weight History (`app/weight-history.tsx`)
- `LineChart` of all weight logs over time
- Log list below chart (newest first)
- "+ Log Weight" → upserts `weight_logs` on `(user_id, date)` conflict

### Top Sets (`app/top-sets.tsx`)
- Exercise picker modal (same MUSCLE_GROUPS / EQUIPMENT_FILTERS as workout logger)
- Set type selector: 1RM or Working Set
- Reps + weight inputs
- Inserts to `top_sets` table

### Measurements (`app/measurements.tsx`) — Pro-gated
- 7 measurement fields: chest, waist, hips, left/right arm, left/right thigh (cm)
- LineChart per measurement (last 12 weeks)
- Gate: `useProContext().isPro` check; renders `<Redirect href="/subscription" />` if false

### Workout Template (`app/workout-template.tsx`) — Pro-gated
- Create and save reusable workout templates stored in `workout_templates.exercises` JSONB
- Template data: `{ exerciseId, exerciseName, muscleGroup, equipment, isCompound, sets[] }`
- Gate: same pattern as measurements

### Training Planner (`app/(tabs)/planner.tsx`) — Pro-gated
See Section 11 below.

### Subscription (`app/subscription.tsx`)
- Fetches live offerings from RevenueCat: `Purchases.getOfferings()`
- Displays all packages with monthly-equivalent pricing, highlighting ANNUAL
- `handleSubscribe`: calls `purchasePackage()` → on success calls `refreshPro()` +
  `router.back()`
- Silent on `PURCHASE_CANCELLED_ERROR`; alerts on other errors
- `handleRestore`: `restorePurchases()` → `refreshPro()`
- Shows "Already subscribed" banner when `isPro`

### Settings (`app/settings.tsx`)
- Theme toggle (dark/light), metric/imperial toggle
- Links to: Account, Notifications, Subscription
- `{__DEV__ && <Developer row → /debug />}`

### Notifications (`app/notifications.tsx`)
- Toggle: device notifications enabled/disabled
- Mute toggle: silence without disabling
- Morning hour picker (06:00–10:00)
- Afternoon hour picker (13:00–18:00)
- On any change: calls `forceRescheduleNotifications()`

### Debug (`app/debug.tsx`) — DEV only
- `if (!__DEV__) throw new Error(...)` at module level prevents production use
- Displays: `isPro` (from context), Supabase user ID, `Purchases.isConfigured()`,
  `getOfferings()` result or error string
- "Force Refresh isPro" button

---

## 10. Training Planner (Pro Feature)

**`app/(tabs)/planner.tsx`** is the most complex screen.

### State machine
`PlannerState`: `'loading'` | `'no_plan'` | `'building'` | `'active'`

- `loading` → spinner
- `no_plan` → "Create New Plan" CTA
- `building` → 4-step wizard
- `active` → active plan view

Non-Pro users see a gate view with "View Pro Plan" button.

### Plan types
**Weekly schedule** (`plan_type: 'weekly'`):
- `schedule: WeeklySchedule` → `{ Mon: DayCard[], Tue: DayCard[], ... Sun: DayCard[] }`
- Repeats every 7 days by day-of-week

**Continuous cycle** (`plan_type: 'cycle'`):
- `schedule: CycleSchedule` → `{ days: CycleDay[] }`
- `CycleDay: { id, label, cards: DayCard[] }`
- Walks days in sequence starting from `start_date`, wrapping modulo `days.length`

### DayCard
```ts
interface DayCard {
  id: string;
  name: string;
  subtitle: string;
  category: 'muscle' | 'cardio' | 'rest';
}
```
Predefined card groups: Muscle Groups (Push, Pull, Legs, etc.), Cardio (LISS, HIIT, etc.),
Rest/Recovery (Rest Day, Active Recovery, Deload).

### Builder wizard (4 steps)
1. Choose plan type (weekly / cycle)
2. Plan name, start date (← → day picker), duration weeks (1–52 stepper)
3. Build schedule: for weekly — assign cards to each day of week; for cycle — add/reorder/
   rename days, assign cards
4. Review summary → "Launch Plan 🚀" → inserts to `training_plans`

Only one active plan per user enforced by a partial unique index on `(user_id)` WHERE
`is_active = true`. "Cancel Plan" sets `is_active = false` (history preserved).

### Active plan view
- Plan name + type badge, week progress ("Week 3 of 8"), start date
- For cycle plans: current day position ("Today is Day 2 of 4")
- "UP NEXT" horizontal scroll of today's cards
- Weekly plans: 7-column mini grid showing this week's card colors
- Cycle plans: horizontal scroll of all cycle days with current highlighted, past dimmed
- Upcoming 7 days list with date labels and card names

### `lib/planProjection.ts` — `generateProjectedDates(plan)`
Iterates from `max(today, plan.start_date)` to `start_date + duration_weeks * 7`.
For weekly: maps `Date.getDay()` to the schedule key.
For cycle: offsets by `elapsed % days.length` from plan start.
Returns `ProjectedDay[]`: only days with at least one non-rest card.
Used by both the Planner active view and the Progress tab calendar overlay.

---

## 11. Monetisation & Pro Gating

### `lib/ProContext.tsx`
`ProContextProvider` wraps the entire authenticated tree (keyed by `session.user.id` so
it remounts on auth change).

**Initialization:**
1. If `DEV_PRO_UNLOCKED` (in `lib/proAccess.ts`, currently `false`) → skip everything,
   `isPro = true`
2. Otherwise: configure RevenueCat with `apiKey` + `appUserID = user.id` (in a try/catch
   for Expo Go safety), then fetch `profiles.is_pro` from Supabase
3. Re-fetches on `AppState → 'active'` (app foreground)

**Context value:** `{ isPro: boolean; refreshPro: () => Promise<void> }`

**`useProContext()`** — must be called before any conditional return (React hooks rules).

### Pro gates
Two gated screens use the **Redirect pattern** (for full-screen routes):
- `app/measurements.tsx`: `if (!isPro) return <Redirect href="/subscription" />`
- `app/workout-template.tsx`: same

One gated tab uses the **inline gate pattern** (tabs can't redirect out):
- `app/(tabs)/planner.tsx`: renders a centered "Training Planner / View Pro Plan" view
  when `!isPro`

### RevenueCat integration
- `Purchases.configure({ apiKey, appUserID })` at ProContext init
- `Purchases.getOfferings()` in `subscription.tsx`
- Enums are static props on the class (SCREAMING_SNAKE_CASE):
  - `Purchases.PACKAGE_TYPE.ANNUAL`, `.MONTHLY`, etc.
  - `Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR`, etc.
- `PurchasesError` interface (from `react-native-purchases`) has `code: PURCHASES_ERROR_CODE`

### RevenueCat webhook → `profiles.is_pro`
`supabase/functions/revenuecat-webhook/index.ts` handles RC event webhooks.
Event sets:
- PRO_EVENTS: `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`
- REVOKE_EVENTS: `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`

Webhook secret validated by stripping `Bearer ` prefix from `Authorization` header.

---

## 12. Notifications

### Local notifications (`lib/notifications.ts`)
Entry point: `rescheduleNotifications()` — throttled to once per 24h via AsyncStorage
(`notif_last_scheduled`). Bypass with `forceRescheduleNotifications()` (called after
preference changes).

`scheduleAllNotifications(plan, lastWeightIso, prefs)`:
1. Cancels all previously scheduled notifications (IDs stored in AsyncStorage)
2. **Bodyweight reminders** — if last log ≥ 5 days ago: weekly, at `prefs.morningHour`,
   for 8 weeks (up to `MAX_SLOTS = 58` total)
3. **Training plan notifications** — for each future plan day:
   - Training day: morning (`morningHour`) "Today is a training day" + afternoon
     (`afternoonHour`) "Still time to train"
   - Rest day: morning only "Rest day" notification

IDs capped at 58 to stay under iOS's 64 local notification limit.

Notification prefs (`lib/notifPrefs.ts` — `NotifPrefs`):
```ts
{
  deviceEnabled: boolean;   // master toggle
  deviceMuted: boolean;     // silence without disabling
  morningHour: number;      // 6–10
  afternoonHour: number;    // 13–18
}
```
Persisted in AsyncStorage under key `notif_prefs`.

### Push token registration (`lib/notifications.ts` — `registerPushToken()`)
Called fire-and-forget from `_layout.tsx` on every authenticated launch.
1. Requests notification permission
2. Gets Expo push token via `Notifications.getExpoPushTokenAsync({ projectId })`
3. Updates `profiles.push_token` via Supabase `.update()`
4. Any error captured to Sentry with `tags: { context: 'registerPushToken' }`

Tokens can rotate after app reinstall or data clear, so always re-fetches and upserts.

### Push notification channel (Android)
Channel ID: `bodybuilderapp-reminders`
Set in `requestNotificationPermission()` for Android via
`Notifications.setNotificationChannelAsync('default', ...)`.

### Server-side push (Edge Function)
`bodyweight-reminder` Edge Function sends push via Expo Push API to users who haven't
logged weight in 5+ days, batched in groups of 100 (Expo API limit). Runs daily at
09:00 UTC via pg_cron.

---

## 13. Theming & Design System

### `lib/ThemeContext.tsx`
`ThemeProvider` wraps the app (inside Sentry ErrorBoundary). Provides:
- `colors: AppColors` — current theme palette
- `isDark: boolean`
- `toggleTheme(): void`
- `isMetric: boolean`
- `setMetric(v: boolean): void`

Both preferences persisted in AsyncStorage (`theme_mode`, `metric_unit`).

Hook: `useColors()` → `AppColors` (shorthand, used by most screens).
Full hook: `useTheme()` → all theme context (used by screens that need `isMetric`).

### `constants/theme.ts`
```ts
// Color tokens (same keys for dark and light)
AppColors = {
  background, surface, surfaceAlt, border,
  text, textSecondary, textDisabled,
  primary, primaryLight, secondary,
  success, warning, danger,
}

Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 40 }
FontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 }
Radius   = { sm: 6, md: 10, lg: 16, full: 999 }
```

### Component styling pattern
Every screen uses:
```ts
const Colors = useColors();
const styles = useMemo(() => makeStyles(Colors), [Colors]);
// ...
const makeStyles = (Colors: AppColors) => StyleSheet.create({ ... });
```
`useMemo` ensures styles only recompute when the theme changes, not on every render.

### `components/LineChart.tsx`
SVG-based chart using `react-native-svg`. Props:
- `points: ChartPoint[]` — `{ date: string; value: number }[]`
- `color: string` — line and dot color
- `height?: number` — default 180
- `yFormat?: (v: number) => string` — axis label formatter
- `gridCount?: number` — default 4 horizontal grid lines

Uses `onLayout` to get container width before rendering SVG. Returns `null` if
`points.length < 2`. Padding: `{ top: 16, bottom: 28, left: 38, right: 12 }`.

---

## 14. Key Patterns & Gotchas

### React hooks ordering with Pro gating
`useProContext()` must always be called **before** any conditional return. For full-screen
routes, place the gate after all hooks:
```tsx
const { isPro } = useProContext();
const Colors = useColors();
const [state, setState] = useState(...);
// all hooks above this line
if (!isPro) return <Redirect href="/subscription" />;
```
For tabs, use an inline gate view instead of Redirect.

### `useMemo` for styles
Every screen wraps `makeStyles(Colors)` in `useMemo([Colors])` to avoid StyleSheet
recreation on every render.

### Supabase `.update()` vs `.upsert()`
- `.upsert()` with partial data triggers NOT NULL constraint errors for unspecified columns
  if the row doesn't exist yet. Prefer `.update().eq('id', ...)` when the row is guaranteed
  to exist (e.g., profile updates mid-onboarding).
- Weight logs use `.upsert({ onConflict: 'user_id,date' })` which is safe because all
  fields are supplied.

### Progress screen: join filtering
`workout_sets` joined to `workouts` via foreign key does not automatically apply user-level
RLS in cross-user scenarios. After fetching joined data, always re-filter:
```ts
const userRows = rows.filter(r => r.workouts?.user_id === user.id);
```

### Expo Go limitations
- `react-native-purchases` (RevenueCat) — not available in Expo Go. All RC calls wrapped
  in try/catch in `ProContextProvider`.
- `expo-notifications` push token registration — fails in Expo Go SDK 53+. Wrapped in
  try/catch in `registerPushToken()`.
- Local notification scheduling still works in Expo Go.
- Requires a **development build** (EAS build with `development` profile) for full
  functionality.

### Deno / TypeScript exclusion
`tsconfig.json` excludes `supabase/functions` to prevent Deno globals (`Deno.serve`,
`Deno.env`) from causing TypeScript errors in the React Native build.

### RevenueCat enum names
```ts
// Correct — static props on the Purchases class
const { PACKAGE_TYPE, PURCHASES_ERROR_CODE } = Purchases;
pkg.packageType === PACKAGE_TYPE.ANNUAL
error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
// Wrong — these named exports do not exist
import { PackageType, PurchasesErrorCode } from 'react-native-purchases';
```

### Date handling
Always use `parseLocal(iso)` pattern (split ISO string, construct `new Date(y, m-1, d)`)
to avoid UTC midnight timezone offset issues:
```ts
const [y, m, d] = iso.split('-').map(Number);
const date = new Date(y, m - 1, d);
```

### `ProContextProvider` key
Keyed by `session?.user?.id ?? 'no-user'` in `_layout.tsx` so it fully remounts (and
re-initialises RevenueCat + re-fetches `is_pro`) when the user logs in or out.

---

## 15. Open Items & Known State

| Item | Status |
|---|---|
| Sentry DSN | Not yet configured — user needs to create Sentry project and set `SENTRY_DSN` in EAS Secrets |
| `REVENUECAT_WEBHOOK_SECRET` | Set to a placeholder in EAS Secrets; real secret must be set in Supabase Edge Function dashboard and EAS |
| pg_cron bodyweight reminder | Step 1 (enable extensions) done; Step 2 (paste SQL + replace service role key) and Step 3 (verify with `SELECT * FROM cron.job`) pending |
| RevenueCat API key | Test key `test_nvpeGAnBJgESZptnnvafWtVBvjd` set in EAS Secrets |
| `DEV_PRO_UNLOCKED` | `false` in `lib/proAccess.ts` — set to `true` locally to skip RC during development |
| Email confirmation | Disabled in Supabase dashboard (Gmail link-wrapping breaks `bodybuilderapp://` deep links) |
