# DHOBI MATRIMONY — COMPLETE APPLICATION PLAN
### Tradition • Trust • Togetherness
**Version 2.0 — Full video analysis included**

---

## SECTION A — WHAT WAS ANALYSED

### Brand Images Provided
- **Image 1 (Promo banner):** Dhobi Matrimony brand, maroon + gold color scheme, tagline "Tradition • Trust • Togetherness", trust badges (100% Verified Profiles / Trusted by Thousands / Privacy Assured), desktop website mockup + mobile app mockup side by side.
- **Image 2 (App Icon):** Two-figure + heart logo, maroon background, gold mandala. Use this as the app icon and all screen headers.

### Videos Analysed (Frame by Frame)
Both videos were extracted at high frame-rate and every screen was read. Here is exactly what was seen:

**Video 1 (38 seconds) — Profile Browsing Flow**
Shows the full "Daily Recommendations" card flow and full profile detail page with every field visible.

**Video 2 (7.5 minutes) — Full Registration Flow**
Shows every screen from landing → "Profile created for" → Basic Details → OTP verification → 5-step wizard → Photo upload → Horoscope → Main app home with bottom nav.

---

## SECTION B — EXACT SCREENS & FIELDS FROM VIDEOS

### Screen 1: Landing / Splash
- Background: collage of married couples
- App logo centered
- Tagline below logo
- Button: **Create Profile** (primary, red)
- Text + Button: "Already registered? **Login**"

### Screen 2: Profile Created For (NEW — missed before)
Before any form, user selects WHO this profile is for:
- **Myself** | **Son** | **Daughter** | **Brother** | **Sister** | **Friend** | **Relative**
- Button: **Start Registration**
- This value is stored in DB as `profile_created_by`

### Screen 3: Basic Details (Account Creation)
- Full Name (text field)
- Email (text field)
- Password (text, 8–20 characters, show/hide toggle)
- Country code selector (flag + +91) + Mobile number field
- Helper text: "OTP will be sent to this number"
- Button: **Get OTP** (red, full width)
- Footer: "By registering, I agree to the T&C and Privacy Policy"

### Screen 4: OTP Verification
- Illustration of phone receiving OTP
- Text: "Please enter the 4-digit code sent to +91 XXXXXXXXXX"
- 4 individual digit input boxes (dash-separated)
- Link: "Didn't receive the OTP? **Resend OTP**"
- Link right: "**Verify with Missed call**"
- Button: **Submit**
- Footer: "Facing any difficulty? Please call our customer service +91 8144778866"

### Screen 5: Personal Details (Step 1/5)
- **Gender** — toggle chips: Male / Female
- **Date of birth** — 3 dropdowns: Day / Month (Jan–Dec) / Year (scrollable)
- **Height** — dropdown: "5 ft 3 in (160 cm)" through "6 ft 6 in (198 cm)" in exact steps
- **Physical Status** — chips: Normal / Physically Challenged
- **Marital Status** — chips: Never Married / Widower / Awaiting Divorce / Divorced
- Bottom: **Next** button + "Need help? Call 8144-77-88-66"

### Screen 6: Religious Details (Step 2/5)
- **Religion** — dropdown (Hindu shown)
- **Caste** — searchable dropdown. Full list seen:
  - Brahmin - Gurukkal, Brahmin - Iyengar, Brahmin - Iyer, Patnaick, Viswabrahmin,
  - Brahmin - Bhumihar, Brahmin - Kanyakubj, Brahmin - Gaur, Brahmin - Maithil,
  - Brahmin - Saryuparin, Brahmin - Garhwali, Brahmin - Pandit, Brahmin - Sanadya,
  - Brahmin - Kumoani, Brahmin - Tyagi, Brahmin - Barendra, Brahmin - Kulin,
  - Brahmin - Rarhi, Brahmin - Rudrai, Brahmin - Audichya *(→ for Dhobi Matrimony, replace this list with Dhobi community sub-groups)*
- **Subcaste** — searchable dropdown. List seen: Agiyarase, Gadhiya, Gohilwadi, Gorwal, Kharedi, Sadacharso, Sahastra, Tolak, Zalawadi, Others, Don't wish to specify, Don't know my subcaste
- Checkbox: **Open to marry from any subcaste**
- **Gothra(m)** — searchable dropdown. Full alphabetical list seen: Aatharvas, Agasthi, Ahabhunasa, Alampayana, Angiras, Arrishinimi, Athreyasya/Athreyasa, Atri, Attarishi, Aukshanas, Aushanas, Babrahvya, Badarayana, Baijvayas, Bashan, Bharadwaj, Bhargava/Bhargav, Bhasyan, Bhrigu, Birthare, Bodhaaynas, Chandratri, Lokaakhyas, Lomasha, Madelia, Maitraya, Manava, Mandavya, Marica, Markendeya, Maudlas, Maunas, Mihir, Moudgalya, Mouna Bhargava, Munish, Mythravaruna...
- **Do you have any dosh?** (Optional) — chips: No / Yes / Don't know
- Button: **Next**

### Screen 7: Location Details (Step 3/5)
- **Residing Country** — searchable dropdown with "Frequently selected countries" group at top:
  - India, United States of America, United Arab Emirates, Saudi Arabia, United Kingdom, Malaysia, Singapore, Australia, Canada
  - Then "All countries" alphabetically
- **Residing State** — searchable dropdown (all Indian states + UTs listed)
- **Residing City** — searchable dropdown
- Button: **Next**

### Screen 8: Professional Details (Step 4/5)
- **Education** — searchable dropdown (LLM - Master of Laws shown, full degree list)
- **Employment Type** — dropdown: Private / Business / Defence / Government/PSU / Not Working / Self Employed
- **Occupation** — searchable dropdown with groups:
  - Frequently selected: Software Professional, Teaching/Academician, Executive, Doctor, Manager, Professor/Lecturer, Officer, Human Resources Professional
  - By category: Administration (Manager, Supervisor, Officer, Administrative Professional...), Airline (Pilot, Air Hostess/Flight Attendant, Airline Professional), Architecture & Design (Architect, Interior Designer), Banking & Finance (Chartered Accountant, Company Secretary, Accounts/Finance Professional, Banking Professional, Auditor, Financial Accountant, Financial Analyst/Planning, Investment Professional), Agriculture (Horticulturalist)...
- **Annual Income Currency** — dropdown (INR - India shown)
- **Annual Income Range** — dropdown: ₹1 Lakh & below, ₹1-2 Lakhs, ₹2-3 Lakhs, ₹3-4 Lakhs, ₹4-5 Lakhs, ₹5-6 Lakhs, ₹6-7 Lakhs, ₹7-8 Lakhs, ₹8-9 Lakhs, ₹9-10 Lakhs, ₹10-12 Lakhs, ₹12-14 Lakhs, ₹14-16 Lakhs, ₹16-18 Lakhs, ₹18-20 Lakhs, ₹20-25 Lakhs (and continues)
- Button: **Next**

### Screen 9: Additional Details (Step 5/5)
- **Family Status** — chips: Middle Class / Upper Middle Class / Rich / Affluent (Elite)
- **A few words about myself** — multiline free text field
- Button: **Submit**
- Footer: "Need help? Call 8144-77-88-66"

### Screen 10: Profile Created Success
- Green checkmark animation with sparkles
- Title: **"Congratulations! Your profile has been created!"**
- Subtitle: "Just a few more details to complete! Add them to make your profile better and find your perfect match faster."
- (Auto-navigates to next step)

### Screen 11: Manage Photos
- Header text: "Photos are the first thing members look in your profile. Add multiple photos to get more matches"
- Drag-to-reorder grid of photo tiles
- First tile labelled "Profile Photo" — badge shows **"Under Validation"** after upload
- "+" tile: Add Photo (opens Google Photos / Camera / Gallery picker)
- Toast on upload: "uploaded successfully"
- First photo = primary display photo; drag to reorder

### Screen 12: Add Horoscope Details (Optional)
- Planet/ring icon
- Title: "Add horoscope details"
- **Date of birth** — pre-filled from Step 1 (e.g. 27-Sep-2000)
- **Time of birth** — dropdown (e.g. 01:45 PM)
- **Place of birth** — searchable country dropdown (same "Frequently selected options" list as Location step)
- Button: **Submit** (greyed until time/place filled)
- Skip link: "**I will do this later >**"

### Screen 13: Home Dashboard (after approval)
- Top bar: **Regular | PRIME** toggle (membership tier)
- User avatar + name + "Free Member" badge + "Upgrade" button
- Notification bell + hamburger menu
- Sections on scroll:
  - Assisted Service banner (dark green): "Find your match 3X Faster with a Dedicated Relationship Manager" with features list and "Get Your Relationship Manager" CTA
  - "Lakhs of Happy Marriages!" + Limca Book of Records badge
  - Couple success story photos

### Screen 14: Daily Recommendations Card View
- Header: "Daily Recommendations (X/9)" — up to 9 per day
- Large profile photo (swipeable — swipe right = send interest, shows "Interested" overlay)
- Photo counter "1/2" if multiple photos
- Badges: "Photo Verified" (green), "ID Verified" (blue)
- Name (bold)
- Profile ID (e.g. BRH4268559) + "Last seen few hours/days ago"
- Info row icons: Age+Height / Education+Occupation / Location
- Action buttons row: **✕ Don't Show** | **» Skip** | **♥ Send Interest**
- Bookmark icon top-right: **Shortlist**
- Three-dot menu top-right
- Toast at bottom: "Interest sent to [Name]" after swiping/tapping Send Interest
- After interest sent: buttons change to **Call Now** | **Send Message**

### Screen 15: Full Profile Detail Page
Accessed by tapping the recommendation card. Sections in exact order:

**Header Section:**
- Full-width photo carousel (swipeable, shows 1/2 etc)
- "Photo Verified" badge on photo (bottom-left, green)
- "ID Verified" badge below photo (blue tick)
- "Verified" badge (blue tick)
- Three-dot menu, bookmark icon, phone icon, back arrow
- Name + WhatsApp icon + Phone icon (call buttons inline)
- Profile ID + "Last seen X ago"
- Summary pills: Never Married • Profile created by Parents • 25 Yrs • 5'6" • Brahmin-Audichya • M.A. • Professor/Lecturer • Surat

**Section 1 — Personal Information**
| Field | Example |
|---|---|
| Age | 25 Years and 9 months |
| Height | 5'6" |
| Weight | 90 Kg |
| Body Type | Heavy |
| Spoken Languages | Gujarati (Mother Tongue), Hindi |
| Profile created by | Parents |
| Marital Status | Never married |
| Lives In | Surat, Gujarat |
| Eating Habits | Vegetarian |
| Religion | Hindu |
| Subcaste | Tolak |
| Gothra(m) | Kashyapa / Kaashyapa |
| Manglik | No |
| Date Of Birth | 🔒 Upgrade to view |
| Time Of Birth | 🔒 Upgrade to view |
| Star | 🔒 Upgrade to view |
| Raasi | 🔒 Upgrade to view |
| Kundli Score | 🔒 Upgrade to view |
| Horoscope | 🔒 Upgrade to view |
| Resident Status | Student Visa (if applicable) |

**Section 2 — Professional**
| Field | Example |
|---|---|
| Employment | Works in Private Sector |
| Annual Income | ₹6–7 Lakhs |
| Education | M.A. |
| Occupation | Professor / Lecturer |

**Section 3 — Contact Information**
- Mobile Number: +91 94\*\*\*\*\*\*\*\* (partially masked)
- "Upgrade to view >" link to reveal full number

**Section 4 — About Myself**
Free text bio paragraph.

**Section 5 — What we are looking for**
Free text partner expectations paragraph.

**Section 6 — Lifestyle**
| Field | Example |
|---|---|
| Cuisine | Chinese, Fast food |
| Hobbies | Dancing, Astronomy |
| Interests | Book Clubs, Writing |
| Music | Latest film songs, Devotional, Film Songs, Ghazals |
| Smoking Habits | Never Smokes |
| Drinking Habits | Never Drinks |
| Movies | Documentaries, Drama, Epics, Horror, Romantic, Sci-Fi & Fantasy |
| Books | Business/Occupational, Philosophy/Spiritual, Poetry, Science Fiction, Self-help |

**Section 7 — Her/His Partner Preferences**
"You match X/21 of her preferences" counter with your photo vs their photo.

Basic Preferences (each item shows ✓ match or ✗ no match):
- Preferred Groom/Bride Age (e.g. 25–32 Yrs)
- Preferred Height (e.g. 5'7"–6'6")
- Preferred Marital Status
- Preferred Mother Tongue
- Preferred Physical Status
- Preferred Eating Habits
- Preferred Smoking Habits
- Preferred Drinking Habits

Religious Preferences:
- Preferred Religion
- Preferred Residing State
- Preferred Residing City
- Preferred Citizenship

**Section 8 — Both of you like**
Auto-computed shared interests: Cuisine / Movies / Books in common.

**Bottom Promo Banners (scrollable):**
- Assisted Service card (dark green)
- Venue booking partner ad card

**Sticky Footer Actions:**
- ✕ Don't Show | » Skip | ♥ Send Interest

### Screen 16: Interests Tab
- Sub-tabs: **Interests Received** | **Interests Sent**
- Filter chips: All / Pending / Accepted-Replied / Declined
- Empty state illustration + "You have no pending interests."

### Screen 17: Regular vs PRIME Toggle
Visible on home + matches + interests screens. Prime features:
- 100% ID verified, high-quality profiles
- Finest profiles with photos and complete information
- Better visibility and responses with Prime tag

---

## SECTION C — COMPLETE DATABASE SCHEMA (PostgreSQL)

**Database: PostgreSQL. No MongoDB.**
Real-time features (chat, notifications, last-seen) use WebSockets (Socket.IO or built-in NestJS WebSocket gateway) with data stored in PostgreSQL. Redis used only for caching/session, not as primary store.

### Table 1: users
```sql
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(150) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  mobile              VARCHAR(15) UNIQUE NOT NULL,
  mobile_verified     BOOLEAN DEFAULT false,
  email_verified      BOOLEAN DEFAULT false,
  role                VARCHAR(10) DEFAULT 'user',  -- 'user' | 'admin'
  membership_type     VARCHAR(10) DEFAULT 'regular', -- 'regular' | 'prime'
  account_status      VARCHAR(20) DEFAULT 'pending', -- 'pending'|'active'|'rejected'|'blocked'
  rejection_reason    TEXT,
  profile_created_by  VARCHAR(20),  -- 'myself'|'son'|'daughter'|'brother'|'sister'|'friend'|'relative'
  gender              VARCHAR(10),  -- 'male' | 'female'
  last_seen           TIMESTAMP,
  otp_code            VARCHAR(6),
  otp_expires_at      TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

### Table 2: profiles
```sql
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_uid         VARCHAR(15) UNIQUE,  -- e.g. DHB1234567 (auto-generated)

  -- Step 1: Personal Details
  date_of_birth       DATE NOT NULL,
  height_cm           INTEGER,           -- stored in cm, displayed in ft/in
  weight_kg           INTEGER,
  body_type           VARCHAR(20),       -- 'normal'|'athletic'|'heavy'|'slim'
  physical_status     VARCHAR(30),       -- 'normal'|'physically_challenged'
  marital_status      VARCHAR(30),       -- 'never_married'|'widower'|'awaiting_divorce'|'divorced'
  spoken_languages    TEXT[],            -- array: ['Gujarati','Hindi']
  eating_habits       VARCHAR(30),       -- 'vegetarian'|'non_vegetarian'|'eggetarian'
  resident_status     VARCHAR(30),       -- 'citizen'|'student_visa'|'work_visa'|'pr'

  -- Step 2: Religious Details
  religion            VARCHAR(50),
  caste               VARCHAR(100),
  subcaste            VARCHAR(100),
  open_to_any_subcaste BOOLEAN DEFAULT false,
  gothra              VARCHAR(100),
  dosh                VARCHAR(20),       -- 'no'|'yes'|'dont_know'
  manglik             VARCHAR(20),       -- 'no'|'yes'|'dont_know'

  -- Step 3: Location
  country             VARCHAR(100),
  state               VARCHAR(100),
  city                VARCHAR(100),

  -- Step 4: Professional
  education           VARCHAR(150),
  employment_type     VARCHAR(30),       -- 'private'|'business'|'defence'|'government_psu'|'not_working'|'self_employed'
  occupation          VARCHAR(150),
  income_currency     VARCHAR(10) DEFAULT 'INR',
  annual_income_range VARCHAR(50),       -- '6-7 Lakhs' etc.

  -- Step 5: Additional
  family_status       VARCHAR(30),       -- 'middle_class'|'upper_middle_class'|'rich_affluent'
  about_myself        TEXT,
  looking_for         TEXT,

  -- Lifestyle (filled later in profile edit)
  cuisine             TEXT[],
  hobbies             TEXT[],
  interests           TEXT[],
  music               TEXT[],
  smoking_habits      VARCHAR(30),
  drinking_habits     VARCHAR(30),
  movies              TEXT[],
  books               TEXT[],

  -- Horoscope (optional)
  birth_time          TIME,
  birth_place_country VARCHAR(100),
  star                VARCHAR(50),
  raasi               VARCHAR(50),
  kundli_score        INTEGER,
  horoscope_file_url  TEXT,             -- uploaded horoscope PDF/image

  -- Status flags
  photo_verified      BOOLEAN DEFAULT false,
  id_verified         BOOLEAN DEFAULT false,
  profile_complete    INTEGER DEFAULT 0, -- percentage 0-100

  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

### Table 3: partner_preferences
```sql
CREATE TABLE partner_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Preferences
  pref_age_min        INTEGER,
  pref_age_max        INTEGER,
  pref_height_min_cm  INTEGER,
  pref_height_max_cm  INTEGER,
  pref_marital_status TEXT[],
  pref_mother_tongue  TEXT[],
  pref_physical_status TEXT[],
  pref_eating_habits  TEXT[],
  pref_smoking_habits TEXT[],
  pref_drinking_habits TEXT[],

  -- Religious Preferences
  pref_religion       TEXT[],
  pref_caste          TEXT[],
  pref_subcaste       TEXT[],
  open_to_any_caste   BOOLEAN DEFAULT false,

  -- Location Preferences
  pref_country        TEXT[],
  pref_state          TEXT[],
  pref_city           TEXT[],
  pref_citizenship    TEXT[],

  -- Professional Preferences
  pref_education      TEXT[],
  pref_employment_type TEXT[],
  pref_occupation     TEXT[],
  pref_income_min     INTEGER,
  pref_income_max     INTEGER,

  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);
```

### Table 4: profile_photos
```sql
CREATE TABLE profile_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  thumbnail_url   TEXT,
  is_primary      BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending'|'approved'|'rejected'
  uploaded_at     TIMESTAMP DEFAULT NOW()
);
```

### Table 5: id_verifications
```sql
CREATE TABLE id_verifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type     VARCHAR(30),  -- 'aadhaar'|'pan'|'driving_licence'|'voter_id'|'other'
  document_number   TEXT,         -- encrypted
  front_image_url   TEXT,         -- stored in private S3 bucket
  back_image_url    TEXT,
  selfie_url        TEXT,
  ocr_name          TEXT,
  ocr_dob           DATE,
  ocr_confidence    FLOAT,
  face_match_score  FLOAT,        -- 0.0 to 1.0
  age_verified      BOOLEAN,
  status            VARCHAR(20) DEFAULT 'pending', -- 'pending'|'approved'|'rejected'
  admin_note        TEXT,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMP,
  submitted_at      TIMESTAMP DEFAULT NOW()
);
```

### Table 6: interests (Send Interest feature)
```sql
CREATE TABLE interests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) DEFAULT 'pending', -- 'pending'|'accepted'|'declined'
  sent_via        VARCHAR(20),  -- 'button'|'swipe'
  responded_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);
```

### Table 7: shortlists
```sql
CREATE TABLE shortlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, target_id)
);
```

### Table 8: hidden_profiles (Don't Show)
```sql
CREATE TABLE hidden_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  hidden_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, hidden_id)
);
```

### Table 9: messages (Real-time chat)
```sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,  -- FK to conversations
  sender_id       UUID REFERENCES users(id),
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMP,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id        UUID REFERENCES users(id),
  user2_id        UUID REFERENCES users(id),
  last_message    TEXT,
  last_message_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);
```

### Table 10: notifications
```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50),   -- 'interest_received'|'interest_accepted'|'profile_approved'|'new_message'|'profile_viewed'
  title       TEXT,
  body        TEXT,
  data        JSONB,         -- extra context (sender_id, profile_id, etc.)
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Table 11: daily_recommendations
```sql
CREATE TABLE daily_recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  recommended_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  date            DATE DEFAULT CURRENT_DATE,
  shown           BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, recommended_id, date)
);
```

### Table 12: profile_views
```sql
CREATE TABLE profile_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id   UUID REFERENCES users(id),
  viewed_id   UUID REFERENCES users(id),
  viewed_at   TIMESTAMP DEFAULT NOW()
);
```

### Table 13: app_versions
```sql
CREATE TABLE app_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code    INTEGER NOT NULL,
  version_name    VARCHAR(20) NOT NULL,  -- '1.0.0'
  apk_url         TEXT NOT NULL,
  release_notes   TEXT,
  is_force_update BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### Table 14: admin_audit_log
```sql
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id),
  action      VARCHAR(100),   -- 'approve_profile'|'reject_profile'|'approve_id'|'block_user' etc.
  target_id   UUID,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## SECTION D — COMPLETE FOLDER STRUCTURE (Every Feature Separate)

```
dhobi-matrimony/
│
├── mobile-app/                          # Flutter Android App (builds APK)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app.dart
│   │   │
│   │   ├── core/
│   │   │   ├── constants/
│   │   │   │   ├── app_colors.dart      # maroon #8B0000, gold #D4AF37
│   │   │   │   ├── app_strings.dart
│   │   │   │   └── api_endpoints.dart
│   │   │   ├── theme/
│   │   │   │   └── app_theme.dart
│   │   │   ├── utils/
│   │   │   │   ├── validators.dart
│   │   │   │   ├── date_utils.dart
│   │   │   │   └── height_converter.dart
│   │   │   └── router/
│   │   │       └── app_router.dart
│   │   │
│   │   ├── models/                      # Data models (one file per entity)
│   │   │   ├── user_model.dart
│   │   │   ├── profile_model.dart
│   │   │   ├── partner_preference_model.dart
│   │   │   ├── interest_model.dart
│   │   │   ├── message_model.dart
│   │   │   ├── conversation_model.dart
│   │   │   └── notification_model.dart
│   │   │
│   │   ├── services/                    # Each service = one API domain
│   │   │   ├── auth_service.dart        # login, OTP, register, logout
│   │   │   ├── profile_service.dart     # create/read/update profile
│   │   │   ├── photo_service.dart       # upload/reorder photos
│   │   │   ├── id_verification_service.dart
│   │   │   ├── matching_service.dart    # daily recs, search
│   │   │   ├── interest_service.dart    # send/accept/decline interest
│   │   │   ├── shortlist_service.dart
│   │   │   ├── chat_service.dart        # real-time messages via WebSocket
│   │   │   ├── notification_service.dart
│   │   │   └── app_update_service.dart
│   │   │
│   │   ├── providers/                   # State management (Riverpod/Provider)
│   │   │   ├── auth_provider.dart
│   │   │   ├── profile_provider.dart
│   │   │   ├── recommendations_provider.dart
│   │   │   ├── interests_provider.dart
│   │   │   ├── chat_provider.dart
│   │   │   └── notification_provider.dart
│   │   │
│   │   ├── screens/
│   │   │   │
│   │   │   ├── splash/
│   │   │   │   └── splash_screen.dart
│   │   │   │
│   │   │   ├── landing/
│   │   │   │   └── landing_screen.dart  # Create Profile / Login buttons
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── login_screen.dart
│   │   │   │   ├── otp_screen.dart
│   │   │   │   └── forgot_password_screen.dart
│   │   │   │
│   │   │   ├── registration/
│   │   │   │   ├── profile_for_screen.dart      # Myself/Son/Daughter...
│   │   │   │   ├── basic_details_screen.dart    # Name/Email/Password/Mobile
│   │   │   │   ├── step1_personal_screen.dart   # Gender/DOB/Height/etc
│   │   │   │   ├── step2_religious_screen.dart  # Religion/Caste/Subcaste/Gothra
│   │   │   │   ├── step3_location_screen.dart   # Country/State/City
│   │   │   │   ├── step4_professional_screen.dart # Education/Job/Income
│   │   │   │   ├── step5_additional_screen.dart # Family status/Bio
│   │   │   │   └── registration_success_screen.dart # Congratulations!
│   │   │   │
│   │   │   ├── photos/
│   │   │   │   └── manage_photos_screen.dart    # Upload/reorder photos
│   │   │   │
│   │   │   ├── horoscope/
│   │   │   │   └── horoscope_screen.dart        # Optional DOB/time/place
│   │   │   │
│   │   │   ├── id_verification/
│   │   │   │   ├── id_type_selection_screen.dart
│   │   │   │   ├── id_upload_screen.dart
│   │   │   │   └── selfie_screen.dart
│   │   │   │
│   │   │   ├── pending_approval/
│   │   │   │   └── pending_screen.dart          # Waiting for admin
│   │   │   │
│   │   │   ├── home/
│   │   │   │   ├── home_screen.dart             # Dashboard with nav
│   │   │   │   └── daily_recommendations/
│   │   │   │       ├── recommendation_card.dart  # Swipeable card
│   │   │   │       └── recommendations_screen.dart
│   │   │   │
│   │   │   ├── profile_detail/
│   │   │   │   ├── profile_detail_screen.dart
│   │   │   │   ├── personal_info_section.dart
│   │   │   │   ├── lifestyle_section.dart
│   │   │   │   └── partner_preferences_section.dart
│   │   │   │
│   │   │   ├── matches/
│   │   │   │   └── matches_screen.dart
│   │   │   │
│   │   │   ├── interests/
│   │   │   │   ├── interests_screen.dart        # Received / Sent tabs
│   │   │   │   └── interest_card.dart
│   │   │   │
│   │   │   ├── messages/
│   │   │   │   ├── conversations_screen.dart    # List of chats
│   │   │   │   └── chat_screen.dart             # Real-time 1:1 chat
│   │   │   │
│   │   │   ├── search/
│   │   │   │   ├── search_screen.dart
│   │   │   │   └── search_filters_screen.dart
│   │   │   │
│   │   │   ├── shortlist/
│   │   │   │   └── shortlist_screen.dart
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   └── notifications_screen.dart
│   │   │   │
│   │   │   ├── my_profile/
│   │   │   │   ├── my_profile_screen.dart
│   │   │   │   └── edit_profile_screen.dart
│   │   │   │
│   │   │   ├── partner_preferences/
│   │   │   │   └── partner_preferences_screen.dart
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── settings_screen.dart
│   │   │       ├── privacy_settings_screen.dart
│   │   │       └── change_password_screen.dart
│   │   │
│   │   └── widgets/                             # Shared reusable widgets
│   │       ├── primary_button.dart
│   │       ├── gender_chip.dart
│   │       ├── searchable_dropdown.dart
│   │       ├── profile_photo_tile.dart
│   │       ├── verified_badge.dart
│   │       ├── interest_action_row.dart
│   │       ├── section_header.dart
│   │       └── upgrade_lock_row.dart            # 🔒 Upgrade to view
│   │
│   ├── android/
│   │   └── app/
│   │       ├── build.gradle
│   │       └── src/main/res/
│   │           └── mipmap*/                     # App icons (Image 2)
│   └── pubspec.yaml
│
│
├── backend-api/                                 # NestJS — One module per feature
│   ├── src/
│   │   ├── app.module.ts
│   │   │
│   │   ├── modules/
│   │   │   │
│   │   │   ├── auth/                            # FEATURE: Authentication
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── otp.service.ts               # Generate + verify OTP
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── dto/
│   │   │   │       ├── register.dto.ts
│   │   │   │       ├── login.dto.ts
│   │   │   │       └── verify-otp.dto.ts
│   │   │   │
│   │   │   ├── users/                           # FEATURE: User account
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── user.entity.ts
│   │   │   │
│   │   │   ├── profiles/                        # FEATURE: Profile wizard
│   │   │   │   ├── profiles.module.ts
│   │   │   │   ├── profiles.controller.ts
│   │   │   │   ├── profiles.service.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── profile.entity.ts
│   │   │   │   └── dto/
│   │   │   │       ├── step1-personal.dto.ts
│   │   │   │       ├── step2-religious.dto.ts
│   │   │   │       ├── step3-location.dto.ts
│   │   │   │       ├── step4-professional.dto.ts
│   │   │   │       └── step5-additional.dto.ts
│   │   │   │
│   │   │   ├── photos/                          # FEATURE: Photo management
│   │   │   │   ├── photos.module.ts
│   │   │   │   ├── photos.controller.ts
│   │   │   │   ├── photos.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── photo.entity.ts
│   │   │   │
│   │   │   ├── id-verification/                 # FEATURE: Gov ID verification
│   │   │   │   ├── id-verification.module.ts
│   │   │   │   ├── id-verification.controller.ts
│   │   │   │   ├── id-verification.service.ts
│   │   │   │   ├── ocr.service.ts               # Text extraction from ID
│   │   │   │   ├── face-match.service.ts        # Selfie vs ID photo
│   │   │   │   └── entities/
│   │   │   │       └── id-verification.entity.ts
│   │   │   │
│   │   │   ├── horoscope/                       # FEATURE: Horoscope details
│   │   │   │   ├── horoscope.module.ts
│   │   │   │   ├── horoscope.controller.ts
│   │   │   │   └── horoscope.service.ts
│   │   │   │
│   │   │   ├── matching/                        # FEATURE: Daily recommendations
│   │   │   │   ├── matching.module.ts
│   │   │   │   ├── matching.controller.ts
│   │   │   │   ├── matching.service.ts          # Gender-rule enforced here
│   │   │   │   └── recommendation.engine.ts     # Scoring algorithm
│   │   │   │
│   │   │   ├── search/                          # FEATURE: Search & filter
│   │   │   │   ├── search.module.ts
│   │   │   │   ├── search.controller.ts
│   │   │   │   ├── search.service.ts
│   │   │   │   └── dto/
│   │   │   │       └── search-filters.dto.ts
│   │   │   │
│   │   │   ├── partner-preferences/             # FEATURE: Save match preferences
│   │   │   │   ├── preferences.module.ts
│   │   │   │   ├── preferences.controller.ts
│   │   │   │   └── preferences.service.ts
│   │   │   │
│   │   │   ├── interests/                       # FEATURE: Send/Accept interest
│   │   │   │   ├── interests.module.ts
│   │   │   │   ├── interests.controller.ts
│   │   │   │   ├── interests.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── interest.entity.ts
│   │   │   │
│   │   │   ├── shortlist/                       # FEATURE: Shortlist profiles
│   │   │   │   ├── shortlist.module.ts
│   │   │   │   ├── shortlist.controller.ts
│   │   │   │   └── shortlist.service.ts
│   │   │   │
│   │   │   ├── hidden/                          # FEATURE: Don't Show
│   │   │   │   ├── hidden.module.ts
│   │   │   │   └── hidden.service.ts
│   │   │   │
│   │   │   ├── chat/                            # FEATURE: Real-time messaging
│   │   │   │   ├── chat.module.ts
│   │   │   │   ├── chat.gateway.ts              # WebSocket gateway
│   │   │   │   ├── chat.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── conversation.entity.ts
│   │   │   │       └── message.entity.ts
│   │   │   │
│   │   │   ├── notifications/                   # FEATURE: Push + in-app notifications
│   │   │   │   ├── notifications.module.ts
│   │   │   │   ├── notifications.service.ts
│   │   │   │   ├── fcm.service.ts               # Firebase Cloud Messaging
│   │   │   │   └── entities/
│   │   │   │       └── notification.entity.ts
│   │   │   │
│   │   │   ├── profile-views/                   # FEATURE: Track who viewed profile
│   │   │   │   ├── views.module.ts
│   │   │   │   └── views.service.ts
│   │   │   │
│   │   │   ├── admin/                           # FEATURE: Admin panel backend
│   │   │   │   ├── admin.module.ts
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   └── admin-guard.ts               # Role check: admin only
│   │   │   │
│   │   │   ├── membership/                      # FEATURE: Regular vs Prime
│   │   │   │   ├── membership.module.ts
│   │   │   │   ├── membership.controller.ts
│   │   │   │   └── membership.service.ts
│   │   │   │
│   │   │   └── app-updates/                     # FEATURE: APK version check
│   │   │       ├── updates.module.ts
│   │   │       ├── updates.controller.ts
│   │   │       └── updates.service.ts
│   │   │
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── gender-visibility.guard.ts   # Blocks male seeing male, etc.
│   │   │   │   └── admin.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   └── transform.interceptor.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── decorators/
│   │   │       └── current-user.decorator.ts
│   │   │
│   │   ├── config/
│   │   │   ├── database.config.ts               # PostgreSQL connection
│   │   │   ├── jwt.config.ts
│   │   │   ├── storage.config.ts                # S3 config
│   │   │   └── firebase.config.ts
│   │   │
│   │   └── database/
│   │       └── migrations/                      # One .sql file per schema change
│   │           ├── 001_create_users.sql
│   │           ├── 002_create_profiles.sql
│   │           ├── 003_create_partner_preferences.sql
│   │           ├── 004_create_photos.sql
│   │           ├── 005_create_id_verifications.sql
│   │           ├── 006_create_interests.sql
│   │           ├── 007_create_shortlists.sql
│   │           ├── 008_create_hidden_profiles.sql
│   │           ├── 009_create_conversations.sql
│   │           ├── 010_create_messages.sql
│   │           ├── 011_create_notifications.sql
│   │           ├── 012_create_daily_recommendations.sql
│   │           ├── 013_create_profile_views.sql
│   │           ├── 014_create_app_versions.sql
│   │           └── 015_create_admin_audit_log.sql
│   │
│   ├── .env.example
│   └── package.json
│
│
├── admin-panel/                                 # React + Tailwind web app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── login/
│   │   │   │   └── AdminLogin.jsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── Dashboard.jsx               # Stats: pending/active/rejected counts
│   │   │   │
│   │   │   ├── pending-profiles/               # FEATURE: Review new registrations
│   │   │   │   ├── PendingList.jsx
│   │   │   │   └── ReviewProfile.jsx           # See all fields + photos + ID
│   │   │   │
│   │   │   ├── id-verification/                # FEATURE: Review ID docs + selfie
│   │   │   │   ├── IDVerificationList.jsx
│   │   │   │   └── IDReviewDetail.jsx          # Side-by-side: ID doc + selfie + OCR result
│   │   │   │
│   │   │   ├── photo-moderation/               # FEATURE: Approve/reject photos
│   │   │   │   └── PhotoModeration.jsx
│   │   │   │
│   │   │   ├── approved-users/
│   │   │   │   └── ApprovedList.jsx
│   │   │   │
│   │   │   ├── rejected-users/
│   │   │   │   └── RejectedList.jsx
│   │   │   │
│   │   │   ├── all-users/
│   │   │   │   ├── AllUsers.jsx
│   │   │   │   └── UserDetail.jsx              # Full profile view from admin side
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   └── ReportsList.jsx
│   │   │   │
│   │   │   ├── membership/                     # FEATURE: Manage Prime members
│   │   │   │   └── MembershipManager.jsx
│   │   │   │
│   │   │   ├── app-versions/                   # FEATURE: Push new APK
│   │   │   │   └── AppVersionManager.jsx
│   │   │   │
│   │   │   └── audit-log/
│   │   │       └── AuditLog.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ProfileCard.jsx
│   │   │   ├── IDComparePanel.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── ConfirmModal.jsx
│   │   │
│   │   └── services/
│   │       └── api.js
│   └── package.json
│
│
├── website/                                     # Next.js public marketing site
│   ├── pages/
│   │   ├── index.jsx                           # Homepage (based on Image 1 design)
│   │   ├── about.jsx
│   │   ├── contact.jsx
│   │   ├── success-stories.jsx
│   │   ├── privacy-policy.jsx
│   │   └── terms.jsx
│   ├── components/
│   │   ├── HeroBanner.jsx                      # "Two hearts united" section
│   │   ├── TrustBadges.jsx                     # 100% Verified / Trusted / Privacy
│   │   ├── HowItWorks.jsx
│   │   ├── Navbar.jsx
│   │   └── Footer.jsx
│   └── public/
│       └── assets/
│           ├── logo.png                        # Image 2
│           └── banner.jpg                      # Image 1
│
│
├── design-assets/
│   ├── app-icon/
│   │   └── dhobi_matrimony_icon.png            # Image 2 in all required sizes
│   ├── banners/
│   │   └── promo_banner.jpg                    # Image 1
│   └── brand-guide.md
│       # Primary: Maroon #8B0000
│       # Accent: Gold #D4AF37
│       # Background: White #FFFFFF
│       # Text: #1A1A1A
│       # Font: Clean sans-serif (Poppins or Inter recommended)
│       # Tagline: Tradition • Trust • Togetherness
│
│
├── shared/
│   └── types/
│       ├── user.types.ts
│       └── api-response.types.ts
│
└── infrastructure/
    ├── docker/
    │   ├── Dockerfile.backend
    │   ├── Dockerfile.admin
    │   └── docker-compose.yml                  # Run everything locally
    ├── nginx/
    │   └── nginx.conf                          # Reverse proxy config
    └── ci-cd/
        └── deploy.yml                          # Auto-deploy on git push
```

---

## SECTION E — COMPLETE FEATURE LIST (Each Feature Separate)

### F01 — LANDING SCREEN
- Photo collage background (married couples)
- App logo (Image 2) + tagline
- Two buttons: Create Profile / Login

### F02 — PROFILE FOR SELECTOR
- 7 options: Myself / Son / Daughter / Brother / Sister / Friend / Relative
- Stored in DB, shown on profile detail ("Profile created by: Parents")

### F03 — ACCOUNT CREATION + OTP
- Name, Email, Password (8–20 chars), Mobile with country code
- OTP sent via SMS to mobile
- 4-digit OTP entry screen
- "Resend OTP" + "Verify with Missed Call" options
- T&C + Privacy Policy links

### F04 — REGISTRATION WIZARD (5 STEPS)
Separate screen per step, each independently saveable. Progress shown as "X/5".
- Step 1: Personal (Gender, DOB, Height, Physical Status, Marital Status)
- Step 2: Religious (Religion, Caste, Subcaste, Gothra, Dosh)
- Step 3: Location (Country, State, City) with "Frequently selected" group
- Step 4: Professional (Education, Employment, Occupation, Income)
- Step 5: Additional (Family Status, Bio text)

### F05 — REGISTRATION SUCCESS SCREEN
- Animated green tick with sparkles
- "Congratulations! Your profile has been created!"
- Auto-navigates to photo upload

### F06 — PHOTO MANAGEMENT
- Grid of photo tiles, drag to reorder
- First photo = profile photo (labelled "Profile Photo")
- "Under Validation" badge on uploaded photos until admin approves
- Toast: "uploaded successfully"
- Multiple photo support

### F07 — HOROSCOPE DETAILS (Optional)
- DOB pre-filled from Step 1
- Time of birth (12-hour format picker)
- Place of birth (country search with frequently selected list)
- "I will do this later >" skip link

### F08 — GOVERNMENT ID VERIFICATION
- Choose ID type: Aadhaar / PAN / Driving Licence / Voter ID / Other
- Upload front (and back for Aadhaar/DL)
- Live selfie capture (camera only, no gallery)
- OCR extracts: name, DOB, face photo
- Face match: selfie vs ID face
- Age check: must be 18+ (confirm 18 or 21 for men with client)
- "ID Verified" badge shown on approved profiles
- Admin reviews with side-by-side comparison tool

### F09 — PENDING APPROVAL SCREEN
- Shown after all submission steps done
- "Your profile is under review" message
- User cannot browse until admin approves

### F10 — ADMIN APPROVAL WORKFLOW
- Admin Panel shows pending queue
- Admin sees all profile fields + photos (with Under Validation state) + ID comparison
- Approve → profile goes active, user gets push notification
- Reject → user gets notification with reason, can re-submit

### F11 — DAILY RECOMMENDATIONS
- Up to 9 profiles per day, fresh daily
- Swipeable card stack (swipe right = Send Interest, with confirmation popup)
- Cards show: photo, verified badges, name, ID, last seen, age/height, job, city
- Actions: Don't Show / Skip / Send Interest / Shortlist
- Toast: "Interest sent to [Name]"
- Gender-rule: males only see females and vice versa (server-side enforced)

### F12 — FULL PROFILE DETAIL
- Photo carousel
- Photo Verified + ID Verified badges
- Phone icon + WhatsApp icon (contact buttons, visible after mutual interest)
- All personal fields (age to resident status)
- All professional fields
- Contact info (mobile masked, "Upgrade to view" for free users)
- About Myself bio
- What we are looking for
- Lifestyle (cuisine, hobbies, interests, music, smoking, drinking, movies, books)
- Partner Preferences with "You match X/21" counter and per-item match indicators
- "Both of you like" common interests block
- Sticky action bar: Don't Show / Skip / Send Interest

### F13 — SEND INTEREST
- Via card action button or profile page button
- Via swipe-right gesture on card
- On accept → both see "Call Now" and "Send Message" buttons
- Stored in DB with status: pending / accepted / declined

### F14 — INTERESTS MANAGEMENT
- Two tabs: Interests Received / Interests Sent
- Filter: All / Pending / Accepted-Replied / Declined
- Accept or Decline incoming interests

### F15 — SHORTLIST
- Bookmark icon on every card and profile
- Saved profiles accessible in Shortlist section

### F16 — DON'T SHOW
- Hides a profile permanently from recommendations
- Stored in hidden_profiles table

### F17 — REAL-TIME CHAT (after mutual interest)
- WebSocket-based (NestJS Gateway / Socket.IO)
- 1:1 messaging
- Read receipts (read_at timestamp stored in DB)
- Conversation list screen + individual chat screen
- All messages stored in PostgreSQL (messages table)
- "Send Message" button visible after interest accepted

### F18 — SEARCH & FILTERS
- Filter by: age range, height, caste, subcaste, religion, location, education, occupation, income
- Results sorted by match score
- Search separate from daily recommendations

### F19 — PARTNER PREFERENCES
- User sets their own criteria (mirrors the partner_preferences table)
- Used in matching engine to calculate "You match X/Y of their preferences"

### F20 — PROFILE VIEWS TRACKING
- Records who viewed whose profile
- Paid members can see who viewed their profile

### F21 — NOTIFICATIONS (Real-time)
- Push via Firebase Cloud Messaging (FCM)
- In-app notification bell with unread count
- Types: Interest Received / Interest Accepted / Profile Approved / New Message / Profile Viewed
- Stored in notifications table, read status tracked

### F22 — MEMBERSHIP TIERS (Regular vs Prime)
- Regular (free): limited views, masked contact info, standard visibility
- Prime (paid): unmasked contacts, horoscope visible, better placement in recommendations
- "Upgrade to view" lock icon on premium fields
- "PRIME" badge on profile cards

### F23 — PROFILE COMPLETION %
- Calculated server-side, shown as progress bar
- Encourages users to fill all sections

### F24 — LAST SEEN STATUS
- "Last seen few hours ago" / "few days ago" / "few weeks ago"
- Updated in DB on every app open/activity

### F25 — APK UPDATE MECHANISM
- App checks version endpoint on every launch
- If new version: show prompt with release notes
- Force-update flag for critical updates
- Signed APK download link served from backend

### F26 — ADMIN PANEL — FULL FEATURE SET
- Login (admin accounts only)
- Dashboard: total users, pending count, approvals today, rejections
- Pending Profiles queue (approve / reject with reason)
- ID Verification review (side-by-side: doc + selfie + OCR output)
- Photo Moderation (approve/reject individual photos)
- All Users list (search, filter by status/gender/caste)
- User Detail view (all fields editable by admin)
- Reports & Complaints management
- Membership Manager (upgrade/downgrade users)
- App Version Manager (upload new APK, set version, force-update toggle)
- Audit Log (every admin action recorded)

### F27 — WEBSITE (PUBLIC)
- Homepage using Image 1 design exactly
- Trust badges: 100% Verified / Trusted by Thousands / Privacy Assured
- "Free Register Now" CTA
- Contact: phone, website, social links
- Pages: Home / About / Contact / Success Stories / Privacy Policy / Terms

---

## SECTION F — REAL-TIME FEATURES DETAIL

Real-time is handled by **WebSockets** (NestJS WebSocket Gateway + Socket.IO client in Flutter).
All data is persisted to **PostgreSQL immediately** — WebSocket is only the delivery mechanism, not the store.

| Real-time Feature | How it works | Stored in DB |
|---|---|---|
| Chat messages | Socket event `send_message` → saved to messages table → broadcasted to receiver's socket | messages table |
| Message read receipts | Socket event `mark_read` → updates read_at in messages | messages table |
| Interest notification | When interest sent → saved to interests table → push notification via FCM + socket event | interests + notifications tables |
| Last seen | On socket connect/disconnect → update last_seen in users table | users.last_seen |
| Profile approved | Admin approves → backend fires push notification + socket event to user | notifications table |
| New message badge | Socket updates unread count client-side; source of truth in messages table | messages.is_read |

---

## SECTION G — SECURITY (STRICT)

- All API routes protected by JWT (except login/register/OTP)
- Gender visibility rule in `GenderVisibilityGuard` — runs on EVERY profile-browsing endpoint server-side, cannot be bypassed from app
- ID documents stored in a **private S3 bucket** (no public URL, access via signed URLs only, time-limited)
- OCR results and face-match scores logged but raw document images never exposed via API to any user
- Admin Panel on separate subdomain with separate JWT secret
- All admin actions logged in `admin_audit_log` with timestamp and admin ID
- Rate limiting: max 5 OTP requests per mobile per 10 minutes
- Passwords hashed with bcrypt (salt rounds 12)
- HTTPS enforced everywhere (redirect HTTP → HTTPS in nginx)
- DPDP Act 2023 compliance: users can request data deletion (add `DELETE /account` endpoint)
- APK signed with private keystore; app verifies checksum before installing update

---

## SECTION H — BUILD ORDER (Step by Step)

| Phase | What to Build | Why First |
|---|---|---|
| 1 | PostgreSQL schema + all migrations | Everything depends on this |
| 2 | Backend: auth module (register/OTP/login/JWT) | Needed for all other modules |
| 3 | Backend: profiles module (5-step save) | Core registration |
| 4 | Backend: admin module + approval workflow | Needed to test full flow end to end |
| 5 | Admin Panel: login + pending profiles + approval | Now you can test registrations |
| 6 | Mobile App: landing → registration wizard → OTP → pending screen | Full register flow working |
| 7 | Backend: photo upload + S3 integration | |
| 8 | Mobile App: photo management screen | |
| 9 | Backend: ID verification (upload + OCR + face match) | |
| 10 | Mobile App: ID upload + selfie screen | |
| 11 | Admin Panel: ID review panel | |
| 12 | Backend: matching engine + daily recommendations | |
| 13 | Mobile App: home dashboard + recommendation cards + swipe | |
| 14 | Backend: interests module | |
| 15 | Mobile App: interests screen (received/sent) | |
| 16 | Mobile App: full profile detail screen | |
| 17 | Backend: chat WebSocket gateway + messages table | |
| 18 | Mobile App: conversations list + chat screen | |
| 19 | Backend: notifications (FCM + in-app) | |
| 20 | Mobile App: notifications screen | |
| 21 | Backend: search module | |
| 22 | Mobile App: search screen | |
| 23 | Backend: membership / Prime tier | |
| 24 | Mobile App: upgrade prompts + locked fields | |
| 25 | Backend: app-updates module | |
| 26 | Mobile App: version check on launch | |
| 27 | Website (Next.js) | |
| 28 | Full end-to-end testing + security audit | |
| 29 | APK signing + first release build | |

---

## SECTION I — OPEN DECISIONS (Confirm Before Building)

1. **Caste/subcaste list for Dhobi community** — what exact community names/sub-groups to show in the caste dropdown? (The reference showed Brahmin sub-castes — you need to replace with Dhobi community groups)
2. **Minimum age** — 18 for all, or 18 for women and 21 for men (legal marriage age)?
3. **Free vs Paid** — Is the app fully free, or freemium (Regular free, Prime paid)? If paid, which payment gateway? (Razorpay recommended for India)
4. **Lifestyle fields** — Do you want users to fill in cuisine, hobbies, music, movies, books during registration or as a separate "Edit Profile" step later?
5. **In-app chat** — Full chat system, or just reveal phone number after mutual interest?
6. **Assisted Service** — Do you want a "Relationship Manager" premium tier like in the reference app, or keep it simpler?
7. **APK distribution method** — Direct download link shared privately, or a simple landing page where users can download?
