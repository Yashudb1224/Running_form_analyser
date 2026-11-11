# Running Form Analyser

A client-side Next.js 14 demonstration that samples a selected video in the browser, estimates 33 pose landmarks with MediaPipe Pose, and presents 2D landmark-derived motion metrics.

## Run locally

```sh
npm install
npm run dev
```

For validation:

```sh
npm run lint
npm test
npm run build
```

## Analysis flow and limits

The browser samples the first 20 seconds at 30 samples per second (up to 600 frames); a running step lasts about 0.3 s, so lower rates cannot time steps or catch foot strike. MediaPipe Pose (pinned to 0.5.1675469404) and its model assets are loaded from jsDelivr. The app does not upload the selected video or send frames to an analysis API.

Missing detections remain missing. Each frame retains nullable landmarks and tracking visibility; angles and downstream metrics with insufficient inputs are marked unavailable. The pipeline:

- detects the running direction (nose vs. ears, toes vs. heels) so trunk lean and foot-strike angles are signed forward/backward;
- classifies the camera view (side-on, diagonal, front/back) and withholds the overall score unless the view is usable and at least 85% of frames are tracked;
- finds stance events from ankle trajectories with sub-frame peak timing, rejects intervals caused by missed events, and estimates cadence from the median step time;
- estimates foot strike and midstance per event, giving shank angle at foot strike, midstance knee flexion and landing offset for each leg;
- compares legs using matched events (symmetry index), not same-frame angles, because the legs are half a cycle apart.

Ground-contact and flight duration are not calculated. Distances are relative to torso length, not centimetres.

## Reference ranges

There is no official optimal cadence, lean or joint angle. Each scored measure is compared with a research-typical range or clinical video-analysis guidance, defined with its citations in `src/lib/researchReferences.ts` (cadence 160-185 steps/min, forward trunk lean 3-12 deg, midstance knee flexion 35-50 deg, shank angle at foot strike 0-8 deg, symmetry index under 10%, stride-time variation under 5%). Each component scores 100 comfortably inside its band (the middle 60%, or the lowest 60% for variation), 90 at the band edge, then drops steeply outside it down to 0; the overall score is a weighted mean of the available components. It is a screening summary, not a validated assessment or a medical or injury-risk tool.

The Metric guide tab lists every range with its basis and full references. The PDF export contains recording quality, research comparisons, per-leg measurements, kinematic traces and references.

## Sign-in (Clerk) and saved history (Supabase)

Signing in with Google (through Clerk) lets the app save each analysis (date, video name, score and metrics, never the video) to a Supabase database so progress can be tracked over time. Without configuration the app runs as before, with no sign-in or history.

**Clerk (sign-in)**
1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and enable **Google** as the sign-in option (Clerk provides shared Google credentials in development).
2. Copy the publishable and secret keys from **API keys** into `.env.local` (see `.env.example`).

**Supabase (database)**
1. Create a free project at [supabase.com](https://supabase.com).
2. In Clerk, open **Integrations > Supabase** (or the "Connect with Supabase" setup) and activate it; it adds the `role: authenticated` claim Supabase needs and shows your Clerk domain.
3. In Supabase, open **Authentication > Sign In / Providers > Third-party auth**, add **Clerk**, and paste the Clerk domain.
4. In **SQL Editor**, run `supabase/schema.sql`. It creates the `analyses` table with row-level security keyed on the Clerk user ID, so each user can only read and delete their own rows.
5. Copy the project URL and anon key from **Project Settings > API** into `.env.local`, then restart `npm run dev`.

## AI coach (Google Gemini)

The Summary tab has an optional **AI Coach**. When the user clicks "Get AI coaching", the browser sends the measured metrics and the annotated evidence frames (never the video) to the app's `/api/coach` route, which asks Google Gemini for plain-language priorities, running cues and drills. Gemini is instructed to treat the measurements as correct, so its advice stays consistent with the scores.

1. Create a free API key at [aistudio.google.com](https://aistudio.google.com) (**Get API key**).
2. Add `GEMINI_API_KEY=...` to `.env.local` (server-only; never use a `NEXT_PUBLIC_` name for it) and restart `npm run dev`.

When Clerk is configured, only signed-in users can use the coach, and each user is limited to one request every 15 seconds to protect the free quota.
