# 05 — Search, Discovery and Matching

## 1. Surfaces

| Surface | Purpose | Eligibility | Limit |
|---|---|---|---|
| Home recommendations | Daily curated matches | Approved, complete profile | 9 per day |
| Reverse matches | Candidates whose preferences match the viewer | Approved | Cursor feed |
| New matches | Recently joined, matching preferences | Approved | Cursor feed |
| Online now | Members active in the last 15 minutes | Approved; respects online visibility | Cursor feed |
| Who viewed me | Members who opened the viewer's profile | Prime/Elite | 30-day window |
| Search | Explicit filters | Approved | Cursor feed |
| Profile ID search | Direct lookup | Approved | Single result |
| Shortlists | Saved candidates | Approved | Private |
| Viewed recently | Viewer's own history | Approved | Private |

## 2. Search filters

| Filter | Type | Semantics |
|---|---|---|
| Age min/max | integer | Inclusive; derived from DOB |
| Height min/max | integer (cm) | Inclusive |
| Marital status | multi-select | OR within the group |
| Religion | multi-select | OR |
| Community | multi-select | OR |
| Sub-caste | multi-select | OR; ignored when candidate is open to any |
| Mother tongue | multi-select | OR |
| Languages known | multi-select | OR |
| Country / state / city | multi-select | OR within each level; hierarchical |
| Citizenship | multi-select | OR |
| Education level | multi-select | OR |
| Education degree | multi-select | OR |
| Employment type | multi-select | OR |
| Occupation | multi-select | OR |
| Annual income range | range | Candidate's range overlaps the selected range |
| Diet | multi-select | OR |
| Smoking | multi-select | OR |
| Drinking | multi-select | OR |
| Manglik | multi-select | OR |
| Horoscope available | boolean | Has birth time/chart |
| Photo available | boolean | Has at least one approved photo |
| Verified only | boolean | ID + photo verified |
| Profile created by | multi-select | OR |
| Last active | enum | Today, this week, this month |
| Keyword | string | Name, about, prompts (trigram, max 100 chars) |
| Profile ID | string | Exact public ID |

**Rules:**

- Empty filter groups mean "no constraint", not "match nothing".
- Contradictory ranges (min > max) are rejected at the API boundary.
- Hard filters always exclude: self, blocked (both directions), hidden (both directions), under-age, non-approved, deleted, suspended.
- Privacy filters exclude profiles whose visibility excludes the viewer.
- Search never returns contact details; only display-safe fields.

## 3. Result card

Each card includes:

- primary photo (or privacy placeholder);
- display name and profile ID;
- age, height, city;
- community/sub-caste, education, occupation;
- marital status, mother tongue;
- verification badges (ID, photo);
- last-seen/online indicator subject to privacy;
- shortlist and interest actions;
- "Why this match" summary (one line, expandable).

Cards are rendered with fixed aspect ratios and no layout shift. Images use responsive variants and lazy loading.

## 4. Profile detail

Sections, in order:

1. Header: photo carousel, verification badges, name, profile ID, last seen, summary pills.
2. Personal: age, height, weight, body type, marital status, languages, created by, lives in, diet, religion, sub-caste, gotra, manglik, resident status.
3. Premium-locked: exact DOB, birth time, star, rashi, kundli score, horoscope (unless the owner made them public).
4. Professional: employment, income range, education, occupation.
5. Contact: masked; reveal action if entitled.
6. About me.
7. What I am looking for.
8. Lifestyle: cuisine, hobbies, interests, music, smoking, drinking, movies, books.
9. Partner preferences with a "You match X/21" counter.
10. "Both of you like" shared interests.
11. Sticky actions: Don't show, Skip, Send interest.
12. Report/block menu.

## 5. Compatibility engine

### 5.1 Two-sided score

For a viewer `V` and candidate `C`:

- `scoreVC` = how well `C` satisfies `V`'s preferences.
- `scoreCV` = how well `V` satisfies `C`'s preferences.
- `reciprocal` = min(scoreVC, scoreCV) × 1.2, capped at 100.
- `average` = (scoreVC + scoreCV) / 2.
- `final` = 0.65 × reciprocal + 0.35 × average.

The lower side is weighted more heavily so a profile that ignores the candidate's dealbreakers does not rank highly.

### 5.2 Component weights (viewer side)

| Component | Weight | Notes |
|---|---|---|
| Age | 18 | Distance from preferred range |
| Height | 12 | Distance from preferred range |
| Marital status | 10 | Hard if listed as a dealbreaker |
| Religion / community | 15 | Split 10 religion, 5 community |
| Sub-caste | 5 | Ignored if either side is open |
| Location | 10 | Country > state > city |
| Mother tongue / languages | 8 | Shared language bonus |
| Education | 8 | Level and degree overlap |
| Employment / occupation | 7 | Category overlap |
| Income | 4 | Range overlap; "prefer not to say" is neutral |
| Lifestyle (diet, smoking, drinking) | 8 | Each equally weighted |
| Horoscope | 5 | Only when both have data |

Weights sum to 110 before normalisation; the implementation normalises to 0–100. All weights are configuration values.

### 5.3 Scoring rules

- A satisfied preference scores 1.0; a near miss (within a tolerance band) scores 0.5–0.9; a miss scores 0.
- Missing candidate data scores neutral (0.5) for that component, not zero, to avoid penalising incomplete profiles unfairly.
- A failed **dealbreaker** caps the final score at 40 and flags the reason.
- `openToAnyCaste`, `openToAnySubcaste`, `openToInterCaste` and `openToInterReligion` suppress the relevant constraints.
- The same calculation runs for reverse matches by swapping `V` and `C`.

### 5.4 Explainability

The API returns:

```json
{
  "score": 82,
  "reasons": [
    "Within your preferred age range",
    "Same mother tongue",
    "Both vegetarian",
    "Lives in your preferred city"
  ],
  "mismatches": [
    "Height is below your preferred range"
  ],
  "dealbreakerFailed": false
}
```

The UI shows the top 3 reasons and a "Why this match?" expander. Reasons are localized.

## 6. Recommendations

### 6.1 Daily recommendations

- Generated per member per day by a scheduled job.
- Candidate pool: approved, complete, not blocked/hidden, not recently actioned.
- Hard filters applied first; then score; then diversity (city, community, age band).
- Cap: 9 per day (configurable).
- Exclude profiles shown in the last 7 days unless the pool is exhausted.
- Store in `DailyRecommendations` with a `shown` flag; regenerate on profile/preference change.
- Cold start: use demographics and broad preferences; explain that recommendations improve as the profile fills.

### 6.2 Reverse matches

- Candidates whose preferences match the viewer, regardless of the viewer's preferences.
- Sorted by reciprocal score.
- Useful for members who want to know who is likely to accept them.

### 6.3 New matches

- Profiles created in the last 30 days that match the viewer's preferences.
- Sorted by recency and score.

### 6.4 Online now

- `lastSeenAt` within 15 minutes.
- Respects `onlineStatusVisibility`; members who hide it are excluded.
- Capped and paginated.

### 6.5 Who viewed me

- Profile views in the last 30 days, de-duplicated by viewer.
- Prime/Elite only.
- Respects the viewer's visibility and block rules.
- The viewed member can see the viewer's card, not their contact details.

## 7. Ranking

Default ordering blends:

| Signal | Weight |
|---|---|
| Compatibility score | 45% |
| Profile completeness | 15% |
| Verification (ID + photo) | 10% |
| Recent activity | 10% |
| Membership boost (Prime/Elite) | 10% |
| Recency of joining | 5% |
| Response likelihood (historical) | 5% |

- Membership boost is capped and disclosed in the UI as "Prime" / "Elite"; it never overrides hard filters or dealbreakers.
- Ranking weights are configuration; A/B tests require a feature flag.
- Search results can be sorted by relevance, newest, last active or compatibility; the chosen sort is explicit.

## 8. Search implementation

- Start with indexed SQL predicates on `ProfilePersonal`, `ProfileReligious`, `ProfileLocations`, `ProfileProfessional`, `ProfileFamilyBio`, `ProfileLifestyle`.
- Use `pg_trgm` for name/about/prompt keyword search.
- Bound the candidate set (e.g., 2,000) before expensive scoring; page with a stable cursor (score + ID).
- Cache facets and common filter counts in Redis for 5 minutes.
- Materialise daily recommendations in a table; refresh per member on preference/profile change.
- Measure p95 query time; add indexes or denormalised columns when the budget is exceeded.
- Never run unbounded `%LIKE%` scans on large tables.

## 9. Privacy and visibility enforcement

- Blocked: mutual exclusion from search, recommendations, profile view and chat.
- Hidden/ignored: excluded from the hider's discovery only.
- `profileVisibility`:
  - `all` — visible to approved members.
  - `prime` — visible to Prime/Elite only.
  - `matches` — visible only to accepted matches.
  - `hidden` — not discoverable; direct link shows a private notice.
- `photoVisibility` and `contactVisibility` are enforced per field.
- Suspended/rejected/deleted profiles are never returned.
- The API applies authorization before building the response; the client never receives fields it cannot show.

## 10. Pagination and performance

- Cursor pagination: opaque cursor encodes sort key + ID; no offset for feeds.
- Page size: 20 default, 50 max.
- Total counts are approximate and cached; do not run `COUNT(*)` on every request.
- Images lazy-load; the first card image is prioritised.
- Empty states suggest relaxing filters or completing the profile.

## 11. Acceptance criteria

- [ ] Hard filters (self, blocked, hidden, under-age, non-approved) are always applied.
- [ ] Reciprocal scoring weights the lower side more heavily.
- [ ] A failed dealbreaker caps the score and is explained.
- [ ] Daily recommendations are capped, deduplicated and stable for the day.
- [ ] Reverse matches return candidates who match the viewer, not just the reverse.
- [ ] Who-viewed-me is Prime-only and respects privacy.
- [ ] Search supports every filter in §2 and rejects contradictory ranges.
- [ ] Profile-ID search returns exactly one profile or a clear not-found state.
- [ ] Contact and premium fields are never returned without entitlement.
- [ ] Cursor pagination is stable when new profiles are added.
- [ ] p95 search latency stays within budget under load.
- [ ] Matching reasons are localized and match the returned score.
