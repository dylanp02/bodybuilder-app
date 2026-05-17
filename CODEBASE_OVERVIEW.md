# LiftLedger — Codebase Overview

> **Authored by Claude Code** via direct file system access to `C:\Users\dylan\BodybuilderApp`.
> Every detail below reflects the actual source files at the time of writing. This document is
> intended for use as Claude Project context alongside a higher-level planning document written
> by Claude.ai. Together they give Claude a complete picture of the project: this file covers
> the implementation; the planning document covers roadmap and strategy.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Configuration & Build](#4-configuration--build)
5. [Database Schema & Supabase](#5-database-schema--supabase)
6. [Authentication & Session Management](#6-authentication--session-management)
7. [Onboarding Flow](#7-onboarding-flow)
8. [Tab Navigation & Core Screens](#8-tab-navigation--core-screens)
9. [Workout Logger](#9-workout-logger)
10. [Training Planner](#10-training-planner)
11. [Progress Tracking](#11-progress-tracking)
12. [Subscription & Pro Gating](#12-subscription--pro-gating)
13. [Notifications](#13-notifications)
14. [Theme System](#14-theme-system)
15. [Shared Types](#15-shared-types)
16. [Component Library](#16-component-library)
17. [Key Code Patterns](#17-key-code-patterns)
18. [Developer Flags & Testing Utilities](#18-developer-flags--testing-utilities)
19. [Pending / In-Progress Work](#19-pending--in-progress-work)

---

## 1. Project Identity

| Field | Value |
|---|---|
| App name (brand) | LiftLedger |
| App name (internal) | BodybuilderApp |
| Bundle ID (iOS) | `com.dylanpalmer.liftledger` |
| Package (Android) | `com.dylanpalmer.liftledger` |
| EAS Project ID | `0104b35d-80bc-4fe0-9b21-b3a12c58a26a` |
| Deep link scheme | `bodybuilderapp://` |
| Developer | Dylan Palmer |

The app is a **React Native fitness tracker** targeting gym athletes. Core loop: log workouts, build training plans, track progress over time. Monetization is a Pro subscription gating premium features.

---

## 2. Tech Stack

| Layer | Library / Service | Version |
|---|---|---|
| Framework | Expo | 54 |
| Runtime | React Native | 0.81.5 |
| Language | TypeScript | 5.9 |
| Router | Expo Router | 6.0 |
| Backend / Auth | Supabase | `@supabase/supabase-js` 2.x |
| Session storage | AsyncStorage | `@react-native-async-storage/async-storage` |
| Monetization | RevenueCat | `react-native-purchases` |
| Error tracking | Sentry | `@sentry/react-native` |
| Notifications | Expo Notifications | `expo-notifications` |
| State | React Context | (no Redux/Zustand) |
| Styling | React Native StyleSheet | theme factory pattern |

Dependencies are declared in `package.json`. No Redux, no Zustand — all global state flows through Context providers defined in `lib/`.

---

## 3. Directory Structure

```
BodybuilderApp/
├── app/
│   ├── _layout.tsx                  # Root layout: auth gate, Sentry init, deep link handler
│   ├── auth.tsx                     # Sign in / Sign up screen
│   ├── account.tsx                  # Email + password management
│   ├── settings.tsx                 # App preferences (theme, units, notifications)
│   ├── goals.tsx                    # User goal & experience editing
│   ├── measurements.tsx             # Body measurements log + LineChart
│   ├── subscription.tsx             # RevenueCat paywall screen
│   ├── workout-template.tsx         # Custom workout template builder (Pro)
│   ├── debug.tsx                    # Dev-only diagnostics screen
│   ├── (tabs)/
│   │   ├── _layout.tsx              # Tab bar configuration (4 tabs, custom PNG icons)
│   │   ├── index.tsx                # Home / Today screen
│   │   ├── workout.tsx              # Active workout logger
│   │   ├── planner.tsx              # Training plan builder (Pro)
│   │   └── progress.tsx             # Calendar + exercise progress charts
│   ├── onboarding/
│   │   ├── step-name.tsx            # Step 1: full name & username
│   │   ├── step-stats.tsx           # Step 2: height, weight, units
│   │   ├── step-goals.tsx           # Step 3: training goal & experience
│   │   └── step-plan.tsx            # Step 4: completion + CTA
│   └── workout/
│       └── [id].tsx                 # Workout detail view (sets grouped by exercise)
│
├── components/
│   ├── LineChart.tsx                # Reusable SVG line chart
│   └── ProBanner.tsx                # "Go Pro" CTA or Pro badge
│
├── lib/
│   ├── supabase.ts                  # Supabase client + getCurrentUser()
│   ├── types.ts                     # All TypeScript interfaces (mirrors DB schema)
│   ├── ThemeContext.tsx             # Dark/light + imperial/metric Context
│   ├── ProContext.tsx               # RevenueCat Pro status Context
│   ├── constants.ts                 # Muscle groups & equipment enums
│   ├── utils.ts                     # Date helpers (isoDate, formatShortDate, etc.)
│   ├── proAccess.ts                 # DEV_PRO_UNLOCKED flag
│   ├── notifications.ts             # Scheduling, push token registration
│   ├── notifPrefs.ts                # AsyncStorage-backed notification preferences
│   └── planProjection.ts           # Projects future training days from a plan
│
├── constants/
│   └── theme.ts                     # Design tokens: Colors, Spacing, FontSize, Radius
│
├── assets/
│   ├── LiftLedger.png               # App icon
│   └── splash.image.LiftLedger.png  # Splash screen
│
├── supabase/
│   ├── add_is_pro_column.sql        # Migration: adds is_pro to profiles
│   ├── cron_bodyweight_reminder.sql # pg_cron job for push notification triggers
│   └── functions/                   # Edge Functions (if present)
│
├── app.config.ts                    # Expo config (env vars, plugins, EAS)
├── tsconfig.json                    # Extends expo/tsconfig.base, strict mode
├── package.json
└── DEVELOPMENT_BRIEF.md             # Separate brief (authored separately)
```

---

## 4. Configuration & Build

### `app.config.ts`

The Expo config reads secrets from environment variables:

```typescript
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
// Sentry DSN and RevenueCat key embedded as extra fields
```

Plugins configured:
- `expo-router` (scheme: `bodybuilderapp`)
- `expo-notifications` (color, icon)
- `@sentry/react-native/expo`
- `expo-build-properties` (iOS deployment target 16.0)
- `react-native-purchases` (RevenueCat)

### EAS

Build profiles (development / preview / production) are managed via `eas.json`. Dev builds are required for notifications (local scheduling via Expo Notifications) and RevenueCat (native IAP).

### TypeScript

`tsconfig.json` extends `expo/tsconfig.base` with `strict: true`. Path aliases are not currently configured; imports use relative paths.

---

## 5. Database Schema & Supabase

All tables use Row-Level Security (RLS) with `auth.uid()` matching `user_id`. The client is initialized in `lib/supabase.ts` with `autoRefreshToken: true` and `persistSession: true` via AsyncStorage.

### Tables (from `lib/types.ts`)

#### `profiles`
```typescript
{
  id: string;                   // = auth.uid()
  full_name: string | null;
  username: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  goal: 'aesthetics' | 'strength' | 'endurance' | 'general' | null;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | null;
  onboarding_complete: boolean;
  is_pro: boolean;              // source of truth for subscription status
  expo_push_token: string | null;
}
```

#### `exercises`
```typescript
{
  id: string;
  name: string;
  muscle_group: string;         // e.g. 'Chest', 'Back', 'Legs'
  equipment: string;            // e.g. 'Barbell', 'Dumbbell', 'Machine'
  is_compound: boolean;
  is_user_created: boolean;
  user_id: string | null;       // null = global exercise
}
```

#### `workouts`
```typescript
{
  id: string;
  user_id: string;
  name: string;
  date: string;                 // ISO date 'YYYY-MM-DD'
  notes: string | null;
  created_at: string;
}
```

#### `workout_sets`
```typescript
{
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;           // working set index (warmups excluded)
  reps: number | null;
  weight_lbs: number | null;
  is_warmup: boolean;
}
```

#### `workout_templates`
```typescript
{
  id: string;
  user_id: string;
  name: string;
  exercises: TemplateExercise[]; // JSONB array
  created_at: string;
}
// TemplateExercise: { exercise_id, exercise_name, sets: TemplateSet[] }
// TemplateSet: { reps, weight_lbs }
```

#### `weight_logs`
```typescript
{
  id: string;
  user_id: string;
  date: string;
  weight_lbs: number;
}
```

#### `measurements`
```typescript
{
  id: string;
  user_id: string;
  date: string;
  neck_inches: number | null;
  chest_inches: number | null;
  left_bicep_inches: number | null;
  right_bicep_inches: number | null;
  waist_inches: number | null;
  hips_inches: number | null;
  left_thigh_inches: number | null;
  right_thigh_inches: number | null;
  left_calf_inches: number | null;
  right_calf_inches: number | null;
}
```

#### `training_plans`
```typescript
{
  id: string;
  user_id: string;
  name: string;
  type: 'weekly' | 'cycle';
  schedule: WeeklySchedule | CycleSchedule; // JSONB
  duration_weeks: number;
  start_date: string;
  is_active: boolean;
  created_at: string;
}
// WeeklySchedule: { monday: DayCard[], tuesday: DayCard[], ... }
// CycleSchedule: { cycleDays: number, days: { [dayIndex: string]: DayCard[] } }
```

#### `daily_logs`
```typescript
{
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number | null;
  calories: number | null;
  protein_grams: number | null;
  energy_level: number | null;  // 1–5
}
```

### Supabase Edge Functions

Located in `supabase/functions/`. The `cron_bodyweight_reminder.sql` file sets up a `pg_cron` job to trigger push notifications server-side for bodyweight reminders (complementing the client-side scheduling logic).

---

## 6. Authentication & Session Management

**File:** `app/_layout.tsx`

### Boot Sequence

1. **Sentry init** — first thing before any render
2. **AsyncStorage read** — checks `keep_logged_in` preference
3. **Session check** — `supabase.auth.getSession()`
   - If `keep_logged_in: false` → `supabase.auth.signOut()` before rendering
4. **Auth state listener** — `supabase.auth.onAuthStateChange` drives routing:
   - `SIGNED_OUT` → push to `/auth`
   - `SIGNED_IN` + `onboarding_complete: false` → push to `/onboarding/step-name`
   - `SIGNED_IN` + `onboarding_complete: true` → push to `/(tabs)`
5. **Post-login setup** — fetch active training plan, call `rescheduleNotifications()`
6. **Push token registration** — `registerPushToken()` on every authenticated launch

### Deep Link / OAuth Handling

```typescript
// PKCE flow (modern Supabase):
bodybuilderapp://?code=XXXX
// → exchangeCodeForSession(code)

// Implicit flow (fallback):
bodybuilderapp://#access_token=...&refresh_token=...
// → setSession({ access_token, refresh_token })
```

Handled via `Linking.addEventListener('url', ...)` in `_layout.tsx`.

---

## 7. Onboarding Flow

Four sequential screens under `app/onboarding/`. Each step upserts to `profiles` immediately so progress is not lost if the app is backgrounded. Routing between steps uses `router.push()`.

| Screen | Route | Data Collected | Table Write |
|---|---|---|---|
| step-name | `/onboarding/step-name` | full_name, username | `profiles` upsert |
| step-stats | `/onboarding/step-stats` | height (ft+in or cm), weight (lbs or kg), unit pref | `profiles` upsert + `weight_logs` insert |
| step-goals | `/onboarding/step-goals` | goal enum, experience_level enum | `profiles` upsert |
| step-plan | `/onboarding/step-plan` | — | `profiles.onboarding_complete = true` |

**Unit handling:** Height stored as inches, weight stored as lbs. Conversion at write time. `isMetric` preference persisted in AsyncStorage via `ThemeContext`.

**Username validation:** `/^[a-zA-Z0-9_]{3,20}$/`

---

## 8. Tab Navigation & Core Screens

**File:** `app/(tabs)/_layout.tsx`

Four tabs with custom PNG icon assets:

| Tab | Route | Icon | Pro Gated? |
|---|---|---|---|
| Today | `index` | home icon | No |
| Workout | `workout` | dumbbell icon | No |
| Planner | `planner` | calendar icon | Yes |
| Progress | `progress` | chart icon | No |

Tab bar styled to match the app theme (primary color active state).

### Home / Today (`index.tsx`)

- Greeting based on time of day (Good morning / afternoon / evening)
- Lists workouts logged today
- Lists recent 7-day workout history (grouped by date)
- Profile dropdown (top-right avatar): Account, Settings, Goals, Pro Plan, Sign Out
- Data refreshed on every `useFocusEffect` mount

### Account (`account.tsx`)

- Displays and edits: full name, username, email, password
- Email change triggers Supabase confirmation email
- Password change: validates 6+ chars and match before calling `supabase.auth.updateUser()`
- Avatar circle shows user initials

### Settings (`settings.tsx`)

- Theme toggle (Dark / Light)
- Unit toggle (Imperial / Metric)
- Notification preferences (bodyweight reminders, training day notifications)
- After preference change, calls `forceRescheduleNotifications()`

### Goals (`goals.tsx`)

- Editable goal and experience_level dropdowns
- Updates `profiles` row on save

### Measurements (`measurements.tsx`)

- Log up to 10 body measurements per entry
- Stores in `measurements` table
- Renders LineChart per measurement site (last 30 entries)

---

## 9. Workout Logger

**File:** `app/(tabs)/workout.tsx`

This is the most complex screen in the app.

### Start Options

1. **Blank workout** — empty slate
2. **Predefined templates** — Push Day, Pull Day, Leg Day (hardcoded exercise lists)
3. **User templates** — loaded from `workout_templates` table (Pro feature)

### State Shape (in-memory during active workout)

```typescript
type ExerciseCard = {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: SetEntry[];
  historicSets: SetEntry[]; // last logged sets for reference
};

type SetEntry = {
  reps: string;
  weight: string;
  isWarmup: boolean;
};
```

### Exercise Picker Modal

- Filter by muscle group (from `lib/constants.ts`)
- Filter by equipment
- Search by name
- "Add custom exercise" → creates row in `exercises` with `is_user_created: true`
- Loads global exercises + user-created exercises via join

### Historic Sets

On adding an exercise, the app queries `workout_sets` joined to `workouts` for the user's most recent logged workout containing that exercise. These show as greyed reference rows above the active input rows.

### Plate Calculator Modal

```
Input: target weight (lbs), bar weight (lbs), enabled plates
Output: plates per side

Algorithm:
  remainder = (target - bar) / 2
  for each plate size (descending):
    count = floor(remainder / plate)
    remainder -= count * plate
```

Preset bar weights: Standard (45 lb), Women's (35 lb), Leg Press (105 lb). Plate sizes: 45, 35, 25, 10, 5, 2.5 lb toggleable.

### Warmup Sets

- Separate modal UI for warmup sets per exercise
- Warmup sets are not counted in `set_number`; they are stored with `is_warmup: true`
- UI displays warmup sets in a distinct visual style (lighter color, "W" label)

### Save Logic

```
1. Validate: workout name is non-empty
2. Validate: at least one non-warmup set exists
3. INSERT into workouts → get workout_id
4. For each exercise, for each set:
   - if !is_warmup: increment working_set_counter
   - INSERT into workout_sets
5. Navigate to /workout/[id] on success
```

### Workout Detail View (`app/workout/[id].tsx`)

- Fetches workout metadata + all sets via:
  ```sql
  SELECT workout_sets.*, exercises.name, exercises.muscle_group
  FROM workout_sets
  JOIN exercises ON workout_sets.exercise_id = exercises.id
  WHERE workout_sets.workout_id = $id
  ORDER BY exercises.name, workout_sets.set_number
  ```
- Renders a card per exercise with a 3-column table: Set #, Reps, Weight

### Workout Templates (`app/workout-template.tsx`)

Pro-gated screen. Users can:
- Create a named template with exercises and default reps/weight per set
- Save to `workout_templates` (JSONB stores the exercise array)
- Load / delete existing templates
- Start a workout pre-populated from a template

---

## 10. Training Planner

**File:** `app/(tabs)/planner.tsx`

Pro-gated. Gating check: `if (!isPro) return <ProBanner />`.

### Plan Types

**Weekly** — Assigns `DayCard[]` to each day of the week (Mon–Sun). Repeats identically every week for `duration_weeks`.

**Cycle** — A repeating N-day sequence (e.g., 4 training days + 1 rest = 5-day cycle). Loops continuously regardless of calendar days.

### DayCard Library

Cards are grouped into three categories:

| Category | Cards |
|---|---|
| Muscle | Push, Pull, Legs, Upper Body, Lower Body, Full Body, Arms, Core |
| Cardio | LISS, HIIT, Zone 2, Sprints, Cycling, Swimming |
| Rest | Rest Day, Active Recovery, Deload |

Each card has a `name`, `subtitle`, and `color` for visual distinction.

### Builder (4 Steps in Modal)

1. **Type selection** — Weekly or Cycle radio
2. **Plan metadata** — name (text input), start date (date picker), duration weeks (number input)
3. **Schedule builder** — drag-and-drop style card assignment to days/cycle slots
4. **Review & Launch** — summary + INSERT to `training_plans` with `is_active: true`
   - Before insert, sets all other user plans to `is_active: false`

### Active Plan View

Shown when `is_active = true` plan exists:

- **Weekly:** Progress bar showing current week position + day-of-week card grid
- **Cycle:** Cycle position indicator + upcoming days
- **Upcoming 7 days:** Projects next 7 days via `lib/planProjection.ts`
- **Cancel Plan** button: sets `is_active: false`, clears scheduled training notifications

### `lib/planProjection.ts`

```typescript
// Given a training plan and a target date, returns the DayCard[]
// that should be assigned to that date.
// Weekly: use day-of-week key
// Cycle: compute ((date - start_date) % cycle_length) index
function getCardsForDate(plan: TrainingPlan, date: Date): DayCard[]

// Returns projected dates/cards for the next N days
function getUpcomingDays(plan: TrainingPlan, n: number): { date: string, cards: DayCard[] }[]
```

---

## 11. Progress Tracking

**File:** `app/(tabs)/progress.tsx`

### Calendar Component

- Month navigation (prev/next arrows)
- Days with logged workouts: filled circle in primary color
- Days with planned training (from active plan): secondary color circle
- Tap a day: modal shows workouts logged that day + planned cards

### Exercise Progress Charts

Users add exercises to a personal tracking list (stored in component state + AsyncStorage).

- **Add exercise:** modal with muscle group filter + search
- Per tracked exercise:
  - LineChart of max weight per workout session (last 30 days of data)
  - PR (personal record) displayed prominently
  - Collapsible workout history list (date + sets)
- Data query:
  ```sql
  SELECT workouts.date, workout_sets.weight_lbs, workout_sets.reps
  FROM workout_sets
  JOIN workouts ON workout_sets.workout_id = workouts.id
  WHERE workouts.user_id = $uid
    AND workout_sets.exercise_id = $exerciseId
    AND workout_sets.is_warmup = false
  ORDER BY workouts.date DESC
  LIMIT ~90 days
  ```

---

## 12. Subscription & Pro Gating

### RevenueCat Integration (`lib/ProContext.tsx`)

```typescript
// Initialized with Supabase user ID as RevenueCat appUserID
await Purchases.configure({ apiKey: RC_API_KEY, appUserID: supabaseUserId });

// Customer info fetched on foreground transition
AppState.addEventListener('change', state => {
  if (state === 'active') refreshProStatus();
});
```

`isPro` is derived from:
1. `DEV_PRO_UNLOCKED` flag (dev bypass)
2. `profiles.is_pro` from Supabase (source of truth)
3. RevenueCat active entitlements (secondary check)

### Paywall (`app/subscription.tsx`)

- Fetches available packages from RevenueCat: Weekly, Monthly, 3-month, 6-month, Annual
- Highlights annual plan ("BEST VALUE") with monthly equivalent price display
- `Purchases.purchasePackage(pkg)` → on success, updates `profiles.is_pro = true` via Supabase
- "Restore Purchases" button (App Store requirement)

### Pro-Gated Features

| Feature | Gate Location |
|---|---|
| Training Planner | `planner.tsx` render guard |
| Workout Templates | `workout-template.tsx` render guard |
| Body Measurements | `measurements.tsx` render guard |
| Progress Photos | Planned (not yet implemented) |

Gating pattern:
```typescript
const { isPro } = useProContext();
if (!isPro) return <ProBanner message="Unlock with Pro" />;
```

### `lib/proAccess.ts`

```typescript
export const DEV_PRO_UNLOCKED = false; // set true for dev testing
```

Imported by `ProContext.tsx` and checked before RevenueCat queries.

### `components/ProBanner.tsx`

If `isPro`: renders a small "Pro Plan" badge (green pill).
If not: renders "Go Pro!" CTA button linking to `/subscription`.

---

## 13. Notifications

**File:** `lib/notifications.ts`

Requires a **development build** (not Expo Go) for local notification scheduling.

### Permission & Token

```typescript
requestNotificationPermission()  // iOS: requestPermissionsAsync(); Android: auto-granted
registerPushToken()               // getExpoPushTokenAsync() → store in profiles.expo_push_token
```

### Notification Types

**Bodyweight Reminder:**
- Triggered if: 5+ days since last `weight_logs` entry
- Schedule: weekly recurring (every 7 days)
- Content: "Time to log your weight" style message

**Training Day Notifications (if active plan):**
- **Morning** (user-configurable 6–10 AM): "Today is a [Push/Pull/Legs] day"
- **Afternoon** (user-configurable 1–6 PM, only on training days): "Still time to train today"
- **Rest days:** Morning only with generic recovery message
- Scheduled for the next 14 days from current date

### Throttling

`rescheduleNotifications()` checks AsyncStorage for a timestamp; re-schedules only if 24+ hours have elapsed. `forceRescheduleNotifications()` bypasses this.

### `lib/notifPrefs.ts`

AsyncStorage keys:
```
@notif_bodyweight_enabled
@notif_training_enabled
@notif_morning_hour       (6–10)
@notif_afternoon_hour     (1–6 PM as 13–18)
@notif_mute_until         (ISO timestamp for timed muting)
```

### Supabase Cron (`supabase/cron_bodyweight_reminder.sql`)

Server-side `pg_cron` job that can trigger push notifications for users who haven't logged weight recently — complements client-side scheduling for users who haven't opened the app.

---

## 14. Theme System

**Files:** `constants/theme.ts`, `lib/ThemeContext.tsx`

### Design Tokens (`constants/theme.ts`)

```typescript
const DarkColors = {
  primary: '#6C47FF',     // purple
  secondary: '#FF6B35',   // orange
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceAlt: '#222222',
  border: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#48484A',
};

const LightColors = { /* complementary light palette */ };

const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
const FontSize = { xs: 11, sm: 13, md: 15, lg: 17, xl: 22, xxl: 32 };
const Radius = { sm: 6, md: 10, lg: 16, full: 999 };
```

### ThemeContext (`lib/ThemeContext.tsx`)

```typescript
// Hooks
useTheme()  → { isDark, isMetric, colors, toggleTheme, setMetric }
useColors() → Colors object (DarkColors | LightColors)
```

Persisted to AsyncStorage:
- `@app_isDark` — boolean string
- `@app_isMetric` — boolean string

### Style Pattern

Every screen uses the factory pattern to get theme-aware styles:

```typescript
const Colors = useColors();
const styles = makeStyles(Colors);

// Bottom of file:
const makeStyles = (C: typeof DarkColors) => StyleSheet.create({
  container: { backgroundColor: C.background },
  title: { color: C.text },
  // ...
});
```

This avoids re-computing styles unless colors change and keeps style logic co-located with the component.

---

## 15. Shared Types

**File:** `lib/types.ts`

Single source of truth for all TypeScript interfaces. Every interface mirrors a Supabase table or a JSONB sub-structure. Key exports used across the app:

```typescript
Profile, Exercise, Workout, WorkoutSet, WorkoutTemplate,
WeightLog, Measurement, TrainingPlan, DayCard,
WeeklySchedule, CycleSchedule, DailyLog,
TemplateExercise, TemplateSet
```

No generated Supabase types are used; types are hand-authored and manually kept in sync with the DB schema.

---

## 16. Component Library

### `components/LineChart.tsx`

Reusable SVG line chart built with React Native's `<Svg>` primitives.

**Props:**
```typescript
{
  points: { date: string; value: number }[];
  color: string;
  height?: number;           // default 180
  yFormat?: (v: number) => string;  // default 1 decimal
  gridCount?: number;        // default 4
}
```

**Features:**
- Responsive width via `onLayout`
- Auto Y-axis min/max scaling
- Grid lines + X-axis date labels (first & last)
- Y-axis labels (min & max values)
- Polyline path + circle markers at each data point

Used on: `measurements.tsx` (per body site), `progress.tsx` (per tracked exercise).

### `components/ProBanner.tsx`

Context-aware banner:
- Reads `isPro` from `useProContext()`
- Pro: renders a green pill badge ("Pro Plan")
- Free: renders an orange CTA button → navigates to `/subscription`

Placed at the top of Pro-gated screens to provide a clear upgrade path.

---

## 17. Key Code Patterns

### Data Loading

```typescript
useFocusEffect(
  useCallback(() => {
    loadData();
  }, [])
);

async function loadData() {
  const [a, b] = await Promise.all([
    supabase.from('table_a').select('*').eq('user_id', uid),
    supabase.from('table_b').select('*').eq('user_id', uid),
  ]);
}
```

`useFocusEffect` ensures data is fresh on every tab focus (not just mount), which matters because users navigate between tabs without unmounting.

### Date Handling (`lib/utils.ts`)

```typescript
isoDate(date?: Date): string        // 'YYYY-MM-DD' in local timezone
formatShortDate(iso: string): string // 'May 15'
formatLongDate(iso: string): string  // 'Thursday, May 15'
```

All dates stored as ISO strings. Parsing avoids `new Date(isoString)` directly (which interprets as UTC midnight); instead parses year/month/day components to construct a local date.

### Form Validation Pattern

Inline validation before any DB write:
```typescript
if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
if (password !== confirm) { Alert.alert('Error', 'Passwords do not match'); return; }
```

No form library (no Formik, no react-hook-form).

### Set Numbering

Working set index is computed per-exercise during save, incrementing past warmup rows:
```typescript
let workingSetNum = 0;
for (const set of exercise.sets) {
  if (!set.isWarmup) workingSetNum++;
  await supabase.from('workout_sets').insert({
    set_number: set.isWarmup ? 0 : workingSetNum,
    is_warmup: set.isWarmup,
    // ...
  });
}
```

### Unit Conversion

All values stored in imperial (inches, lbs). Conversion happens at display time:
```typescript
// Display weight
const displayWeight = isMetric ? (lbs * 0.453592).toFixed(1) + ' kg' : lbs + ' lbs';

// Store weight from metric input
const storedLbs = isMetric ? kg / 0.453592 : lbs;
```

---

## 18. Developer Flags & Testing Utilities

### `lib/proAccess.ts`

```typescript
export const DEV_PRO_UNLOCKED = false;
```

Set to `true` to bypass all RevenueCat and Supabase subscription checks. Grants full Pro access in development without a purchase.

### `app/debug.tsx`

Dev-only diagnostics screen (not linked from production navigation). Accessible by navigating directly to `/debug`. Contents not fully documented — used for ad-hoc testing during development.

### Email Confirmation

Supabase email confirmation is **disabled** in the development environment. The Gmail link-wrapping feature breaks `bodybuilderapp://` deep links in confirmation emails, so magic links/OTP are not used.

---

## 19. Pending / In-Progress Work

Based on the codebase state at time of writing:

### Partially Implemented / Stubs

| Feature | Status | Notes |
|---|---|---|
| Daily Logs | Schema exists (`daily_logs` table in types.ts) | No UI screen yet |
| Progress Photos | Listed in subscription screen as "Coming Soon" | Not implemented |
| 1RM Calculator | Listed as "Coming Soon" | Not implemented |
| Workout Streaks | Listed as "Coming Soon" | Not implemented |
| Post-workout Notes / RPE | Listed as "Coming Soon" | `workouts.notes` column exists |
| CSV Export | Listed as "Coming Soon" | Not implemented |
| Coach Tab | Was in tabs, now deleted (`app/(tabs)/coach.tsx` in git status as ` D`) | Removed |

### In-Progress

| Item | Evidence |
|---|---|
| Supabase Edge Functions | `supabase/functions/` directory exists (contents not fully explored) |
| Cron push notifications | `supabase/cron_bodyweight_reminder.sql` exists but may not be deployed |
| Plan projection in Progress tab | `planProjection.ts` exists; calendar integration present |

### Known Gaps

- No offline support — all data reads require network
- No data export mechanism yet
- Exercise library is not paginated (could be slow with large user-created sets)
- `workout_templates` JSONB not validated at DB level (no schema constraint)

---

*End of Claude Code Codebase Overview — generated with direct file system access.*
*Companion document: higher-level planning writeup from Claude.ai.*
