# 07 — Horoscope and Biodata

## 1. Scope

1. Horoscope data capture (birth place, date, time, chart upload).
2. Derived astrological attributes (rashi, nakshatra, manglik, dosh).
3. Kundli chart rendering.
4. 36-point Guna Milan compatibility.
5. Biodata PDF generation, templating, localization and sharing.

Horoscope matching is a **Phase 3** engine. Phase 1 captures and displays horoscope data and supports filters; it never blocks discovery.

## 2. Horoscope data capture

### 2.1 Fields

See `03-profile-field-dictionary.md` §11 for the full field table. Key points:

- `birthDate` is prefilled from the verified date of birth and is not separately editable.
- `birthTime` is optional; without it a full chart cannot be computed.
- `birthTimeAccuracy` records whether the time is exact, approximate or unknown. Unknown time disables chart generation and caps Guna Milan confidence.
- `birthPlace` stores country/state/city with coordinates where available. Coordinates are optional but improve accuracy; if absent, the city centroid is used.
- `janampatriFile` accepts a PDF or image up to 10 MB, stored privately with a signed URL.
- `chartStyle` supports North Indian and South Indian formats.
- `horoscopeSource` records `computed`, `manual` or `uploaded` so the UI can be transparent.

### 2.2 Validation

| Rule | Behaviour |
|---|---|
| Birth date must equal verified DOB | Reject with explanation |
| Birth date in the future | Reject |
| Time format invalid | Reject |
| City not resolvable | Allow free text and flag low confidence |
| File > 10 MB or wrong type | Reject with guidance |
| Manual rashi/nakshatra conflicts with computed value | Warn and require confirmation; record both |

### 2.3 Privacy

- Horoscope details are **Premium-visible** by default (exact DOB, time, rashi, nakshatra, chart).
- The member can choose to make them public.
- The janampatri file is available to the owner, entitled members and admins only.
- No horoscope data appears in search result cards beyond a "Horoscope available" badge and the manglik filter value.

## 3. Astrology engine

### 3.1 Interface

```ts
interface AstrologyEngine {
  computeChart(input: {
    date: string;        // ISO date
    time?: string;       // HH:mm
    timezone: string;    // IANA
    latitude: number;
    longitude: number;
    style: 'northIndian' | 'southIndian';
  }): ChartResult;

  computeGunaMilan(a: ChartResult, b: ChartResult): GunaMilanResult;
}
```

- One implementation is selected by configuration. The domain never calls provider-specific code directly.
- A `ReferenceAstrologyEngine` implementation is used in tests with known fixtures.
- All calculations run server-side so the API, PWA and PDF agree.

### 3.2 Chart result

```ts
interface ChartResult {
  rashi: string;            // Moon sign code
  nakshatra: string;        // Birth star code
  nakshatraPada: number;    // 1–4
  manglik: 'yes' | 'no' | 'unknown';
  manglikReason?: string;
  doshas: Array<{ code: string; present: boolean; note?: string }>;
  houses: Array<{ house: number; sign: string; planets: string[] }>;
  moonLongitude: number;
  ascendant: string;
  computedAt: string;
  engineVersion: string;
  confidence: 'high' | 'medium' | 'low';
}
```

### 3.3 Accuracy and disputes

- The engine version is stored with every result.
- Reference charts (a fixture set of at least 20 known birth details with expected outputs) are part of the test suite. Any engine change must pass them or be explicitly re-baselined with a product sign-off.
- Members may override rashi/nakshatra/manglik; the override is recorded with source `manual` and shown alongside the computed value in admin.
- A dispute path lets support trigger a recomputation and, if needed, a manual override.

### 3.4 Manglik rules (configurable)

- Manglik is determined from Mars placement relative to the ascendant, moon and Venus, per the configured tradition.
- Because traditions differ, the rule set is configuration and the UI shows a short explanation rather than an absolute claim.
- "Don't know" is a valid value and is treated as neutral in matching unless a preference says otherwise.

## 4. Guna Milan (36 points)

### 4.1 Kootas

| Koota | Max points | Basis |
|---|---|---|
| Varna | 1 | Moon sign groups |
| Vashya | 2 | Sign compatibility |
| Tara | 3 | Birth star compatibility |
| Yoni | 4 | Animal symbolism of nakshatra |
| Graha Maitri | 5 | Moon sign lord friendship |
| Gana | 6 | Deva/Manushya/Rakshasa |
| Bhakoot | 7 | Moon sign distance |
| Nadi | 8 | Nadi group |
| **Total** | **36** | |

### 4.2 Result

```ts
interface GunaMilanResult {
  total: number;                 // 0–36
  max: 36;
  kootas: Array<{
    code: string;
    name: string;
    points: number;
    max: number;
    verdict: 'good' | 'average' | 'poor';
    explanation: string;         // localized
  }>;
  doshas: {
    manglik: { a: string; b: string; compatible: boolean };
    nadi: { dosha: boolean; note?: string };
    bhakoot: { dosha: boolean; note?: string };
  };
  confidence: 'high' | 'medium' | 'low';
  engineVersion: string;
}
```

### 4.3 Interpretation bands (configurable)

| Score | Label | Guidance |
|---|---|---|
| 28–36 | Excellent | Strong traditional compatibility |
| 22–27 | Good | Above average |
| 18–21 | Average | Acceptable; other factors matter |
| < 18 | Low | Traditional concerns; not a disqualifier |

- The UI always shows the score with its components and an explicit disclaimer that it is a traditional aid, not a decision-maker.
- Nadi dosh and Bhakoot dosh are surfaced separately with plain-language explanations.
- Guna Milan is only shown when both members have sufficient birth data; otherwise the profile shows "Horoscope details incomplete".

### 4.4 Performance and caching

- Results are computed on demand and cached by the ordered pair of chart fingerprints plus engine version.
- Cache TTL: 30 days or until either chart changes.
- The compatibility API returns cached results when available and computes otherwise within the request budget; expensive pairs can be computed asynchronously with a "calculating" state.

### 4.5 Acceptance criteria

- The eight kootas always total 36 maximum.
- The engine passes the reference fixture suite.
- Missing birth time reduces confidence and never fabricates a chart.
- Score components and explanations are localized.
- The same pair returns the same score for both members.
- The disclaimer is always visible with the score.

## 5. Biodata PDF

### 5.1 Purpose

A printable, shareable summary that families can review and forward, matching the expectation set by the reference product.

### 5.2 Availability

- Generated for the owner **only after the profile is approved by an admin**. Submission alone is not enough.
- Always reflects current profile data; regenerate on request or when the profile changes.
- The owner can preview before downloading.
- Contact details are hidden by default with an explicit toggle to include them.

### 5.3 Contents

1. Header: photo, name, profile ID, "Biodata", generated date.
2. Personal: age, height, marital status, mother tongue, languages, religion, community, sub-caste, gotra, manglik, location.
3. Education and career: degrees, institutes, occupation, employer (if public), income range (if public).
4. Family: type, values, status, parents, siblings, family base.
5. Lifestyle: diet, smoking, drinking, hobbies, interests.
6. Horoscope: rashi, nakshatra, manglik, chart image, Guna Milan only if a specific match is chosen (not in the general biodata).
7. Partner preferences.
8. About me and looking for.
9. Contact block (optional, hidden by default).
10. Footer: generated by Dhobi Matrimony, profile ID watermark, disclaimer.

### 5.4 Templates

| Template | Style | Notes |
|---|---|---|
| `classic` | Traditional, ornamental border | Default |
| `modern` | Clean, two-column | |
| `minimal` | Text-first, compact | |

- Templates are HTML/CSS rendered server-side to PDF.
- Members choose a template; the choice is stored.
- Templates support RTL-safe layout even though launch languages are LTR.

### 5.5 Localization and fonts

- The PDF is generated in the member's chosen language (en/hi/gu).
- Fonts: Noto Sans Devanagari, Noto Sans Gujarati and Noto Sans (Latin), embedded as subsets.
- Labels, section headings and disclaimers are translated; user content is not.
- Numeric dates use the member's locale; the underlying data is unchanged.
- Missing translations fall back to English, never to a blank field.

### 5.6 Generation pipeline

1. Member requests preview or download.
2. Server checks entitlement and profile status; the request is rejected unless the profile is `approved`.
3. Server loads the profile snapshot, photos (approved, public), horoscope and preferences.
4. HTML template is rendered with localized labels.
5. Headless Chromium (or a PDF service behind an adapter) renders to A4 PDF.
6. PDF is stamped with the profile ID and a generation timestamp.
7. PDF is stored in a private bucket with a short-lived signed URL.
8. Response returns the URL and an expiry; the client previews or shares it.

- Generation is asynchronous for large profiles; the client polls or receives a ready notification.
- Cached PDFs are invalidated when relevant profile fields change.
- Maximum generation time target: 5 seconds p95.

### 5.7 Sharing

- PWA: Web Share API when available; otherwise download and copy-link fallbacks.
- Shared links are signed and expire (default 7 days).
- The PDF itself contains no direct contact details unless the owner enabled them.
- Forwarded PDFs cannot be revoked; the UI warns the member before sharing.

### 5.8 Acceptance criteria

- The PDF renders correctly in all three languages with no missing glyphs.
- The PDF is unavailable before admin approval.
- Contact details are absent by default.
- The PDF matches the current profile data.
- The watermark includes the profile ID.
- Generation is access-controlled and audited.
- The preview and download use the same content.
- Signed URLs expire and cannot be guessed.

## 6. Admin and support

- Admins can trigger regeneration, change the default availability rule and inspect generation failures.
- Support can override a member's horoscope values with a reason; the override is audited and labelled.
- Admin dashboards show generation volume, failure rate and p95 latency.
- Template changes are versioned; existing PDFs are not retroactively regenerated unless requested.

## 7. Failure modes

| Failure | Behaviour |
|---|---|
| Missing birth time | Chart unavailable; explain and allow the member to add it |
| Unresolvable birth city | Use country centroid; flag low confidence |
| Engine error | Return a clear "temporarily unavailable" state; do not fabricate values |
| PDF renderer down | Queue and retry; notify when ready |
| Font missing | Fail the build/test, not the runtime; fonts are bundled |
| Oversized janampatri file | Reject with guidance |
| Chart image generation fails | PDF renders without the chart and notes it |
| Cached PDF stale | Invalidate on profile change; show generation timestamp |

## 8. Acceptance checklist

- [ ] Horoscope capture validates against verified DOB.
- [ ] Missing time reduces confidence and blocks chart generation.
- [ ] Rashi, nakshatra, manglik and dosh are computed server-side with a recorded source.
- [ ] The engine passes reference charts.
- [ ] Guna Milan totals 36 and explains each koota.
- [ ] Nadi and Bhakoot doshas are surfaced with plain-language notes.
- [ ] The score is symmetric for both members.
- [ ] Biodata is available post-submission (configurable) and reflects current data.
- [ ] Biodata hides contact details by default.
- [ ] PDFs render correctly in English, Hindi and Gujarati.
- [ ] PDFs are watermarked and access-controlled.
- [ ] Sharing uses the platform share sheet with fallbacks.
- [ ] Admin overrides are audited.
"
