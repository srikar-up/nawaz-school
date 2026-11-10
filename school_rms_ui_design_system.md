# School RMS --- UI/UX Design System

## Separate design specifications for the Teacher App and Principal App

**Document purpose:** Define the visual language, interaction patterns,
navigation, and screen-level design principles for the two school RMS
applications.

------------------------------------------------------------------------

# 1. Product design philosophy

The RMS has two distinct user groups with different needs:

-   **Teachers:** Use the system frequently, often while moving around
    school or between classes. Their experience must be mobile-first,
    fast, and action-oriented.
-   **Principal / Admin:** May not be comfortable with technology. The
    experience must be immediately understandable, highly visual, and
    forgiving. Pictograms, plain language, and obvious actions are
    essential.

The two applications should feel like parts of the same product family,
but **they must not be forced into the same interface layout**.

## Core principles

1.  Make the next action obvious.
2.  Prefer familiar words over technical terminology.
3.  Use icons with visible text labels; never rely on icons alone for
    important actions.
4.  Keep frequent tasks close to the home screen.
5.  Show only the information relevant to the current role.
6.  Use consistent colors and component behavior across both apps.
7.  Provide clear feedback after every important action.
8.  Prevent mistakes where possible, and make recovery easy.
9.  Design for real school conditions: busy users, small screens,
    interruptions, and varying digital confidence.
10. Accessibility is part of the design, not a later enhancement.

------------------------------------------------------------------------

# 2. Shared visual identity

Both apps share a recognizable visual foundation.

## 2.1 Color palette

  Purpose             Color            Hex
  ------------------- ---------------- -----------
  Primary brand       Indigo           `#4338CA`
  Primary dark        Deep indigo      `#312E81`
  Secondary accent    Teal             `#0D9488`
  Main background     Cool off-white   `#F8FAFC`
  Surface / cards     White            `#FFFFFF`
  Main text           Slate            `#1E293B`
  Secondary text      Muted slate      `#64748B`
  Borders             Light slate      `#E2E8F0`
  Success / present   Green            `#15803D`
  Warning / pending   Amber            `#B45309`
  Error / absent      Red              `#B91C1C`
  Informational       Blue             `#1D4ED8`

**Color rules**

-   Indigo identifies the RMS brand and primary actions.
-   Teal is a secondary accent, not a competing primary color.
-   Green, amber, and red communicate status consistently.
-   Never communicate attendance status using color alone. Include a
    word and/or pictogram.
-   Maintain readable contrast, especially for small labels.

## 2.2 Typography

Recommended typefaces:

-   **Primary:** Inter
-   **Alternative:** Plus Jakarta Sans
-   Use a consistent font family within each app.
-   Use clear, medium-to-bold headings and comfortably readable body
    text.
-   Avoid tiny labels, thin weights, and decorative typefaces.

Suggested hierarchy:

  Element                     Suggested size
  ------------------------- ----------------
  Main page heading                24--30 px
  Section heading                  18--22 px
  Card heading                     16--18 px
  Body text                        14--16 px
  Supporting label                 12--14 px
  Important mobile action          16--18 px

These are starting points, not rigid limits. Principal-facing text and
touch targets should be comfortably large.

## 2.3 Shared components

Both apps should share:

-   Brand logo and identity
-   Color tokens
-   Typography tokens
-   Status colors and labels
-   Icon family and illustration style
-   Buttons and form field styles
-   Confirmation and error patterns
-   Notification styling
-   Loading, empty, and offline states

Recommended visual characteristics:

-   Rounded cards: 12--16 px radius
-   Buttons: 10--12 px radius
-   Subtle borders instead of heavy shadows
-   Generous spacing
-   Simple line icons with consistent stroke weight
-   Restrained animation used only to clarify state changes

------------------------------------------------------------------------

# 3. Teacher App --- Mobile-first design system

## 3.1 Design goal

The Teacher app is a daily working tool. Teachers should be able to
complete routine tasks in a few taps without navigating through
unnecessary screens.

**Personality:** Modern, efficient, friendly, focused.

**Primary device:** Mobile phone.

**Layout approach:** Single-column content, thumb-friendly navigation,
compact information hierarchy, and clear primary actions.

## 3.2 Navigation

Use a bottom navigation bar with approximately five primary
destinations:

1.  **Home** --- Today's overview and shortcuts
2.  **Attendance** --- Mark and review attendance
3.  **Classes** --- Classes, sections, and student lists
4.  **Tasks** --- Create, manage, and review assignments
5.  **More** --- Timetable, announcements, profile, and settings

Keep the navigation labels visible. Do not make users guess what an icon
means.

Secondary destinations can live under More, but important daily actions
must remain easy to reach.

## 3.3 Teacher home screen

The home screen should answer three questions immediately:

-   What do I need to do today?
-   Which class or activity is next?
-   Is anything waiting for my attention?

Suggested content order:

1.  Greeting and current date
2.  Today's schedule or next class
3.  Prominent quick actions
4.  Attendance summary
5.  Pending assignment or review reminders
6.  Recent school announcements

### Quick actions

-   Mark attendance
-   Create assignment
-   View classes
-   View timetable

Use clear icon-plus-label action cards. The most frequently used actions
should receive the strongest visual emphasis.

## 3.4 Attendance flow

Attendance is a high-frequency workflow and should be optimized
carefully.

Suggested flow:

1.  Select class and section.
2.  Select subject or period if required by the school's rules.
3.  Display the student list.
4.  Mark each student present, absent, or late where supported.
5.  Show a visible summary of marked and unmarked students.
6.  Review the summary.
7.  Submit attendance.
8.  Show a clear success confirmation.

### Attendance UI rules

-   Use large, easy-to-tap status controls.
-   Show student names clearly.
-   Keep the attendance state visible in text as well as color.
-   Make unmarked students obvious.
-   Provide a confirmation step before final submission if the action is
    consequential.
-   If edits are allowed after submission, make the correction process
    clear and record changes appropriately.
-   Do not silently discard unsaved attendance.

## 3.5 Assignment flow

Assignment creation should be a guided, uncluttered process.

Suggested fields:

-   Assignment title
-   Instructions
-   Class / section
-   Subject
-   Due date
-   Optional attachment, if supported

After creation, show:

-   Assignment title
-   Assigned class
-   Due date
-   Assignment status

Teachers should be able to distinguish drafts, assigned tasks, and
completed/reviewed work without learning technical status codes.

## 3.6 Teacher visual components

  Component            Design direction
  -------------------- -------------------------------------------------
  Class card           Class name, section, next action
  Student row          Name, optional roll number, clear status
  Attendance control   Large segmented or button-based status selector
  Assignment card      Title, class, due date, status
  Schedule card        Time, subject, class
  Notification         Short message, clear source and date
  Primary action       High-contrast indigo button

## 3.7 Teacher mobile interaction rules

-   Design for one-handed use where practical.
-   Use touch targets around 44--48 px or larger.
-   Keep primary buttons in reachable positions.
-   Avoid wide data tables; use stacked cards or compact lists.
-   Avoid long forms on one screen. Group related fields.
-   Preserve form input when navigating back or recovering from an
    interruption.
-   Use clear progress and save states.
-   Support slower connections and explain when an action has not
    synced.
-   Do not show success until the action has actually succeeded.

------------------------------------------------------------------------

# 4. Principal App --- Pictogram-first, low-complexity design system

## 4.1 Design goal

The Principal app is for school oversight and administration. Its design
must work well for someone who may not be technically confident.

**Personality:** Calm, welcoming, trustworthy, clear.

**Primary device:** Desktop or laptop, with responsive tablet support.

**Layout approach:** Large visual navigation tiles, clear pictograms,
plain-language labels, a small number of choices per screen, and guided
workflows.

### The most important rule

**A principal should understand where to go without needing to read a
manual or understand software terminology.**

Do not imitate a complex corporate analytics dashboard. The principal
needs an approachable school control panel, not a technical reporting
tool.

## 4.2 Pictogram-first navigation

Use a visual home screen with large tiles. Every tile must contain:

-   A recognizable pictogram
-   A short, familiar label
-   Optional one-line explanation
-   A sufficiently large clickable area

Suggested main navigation:

  Pictogram concept      Label             Purpose
  ---------------------- ----------------- ---------------------------------
  School building        School Overview   General school status
  People / students      Students          Find and manage students
  Teacher at board       Teachers          Staff information
  Calendar with check    Attendance        View daily and class attendance
  Clipboard with check   Assignments       View assigned work and progress
  Classroom / books      Classes           Classes, sections, and subjects
  Megaphone              Announcements     Send school-wide messages
  Document / chart       Reports           View and print reports
  Gear                   Settings          School and account settings

Use familiar, consistent pictograms. Avoid abstract icons that require
interpretation.

**Important:** Pictograms support recognition; text labels remain
mandatory. Never make a critical action icon-only.

## 4.3 Principal home screen

The home screen should be a simple launchpad.

Suggested structure:

### Top area

-   School name and logo
-   A clear greeting
-   Today's date
-   Profile / help access

### Main area

Large, well-spaced navigation tiles:

-   Students
-   Teachers
-   Attendance
-   Assignments
-   Classes
-   Announcements
-   Reports

The most important functions should be visible without scrolling on a
typical desktop display.

### Simple school summary

Show only a few understandable summary cards:

-   Total students
-   Total teachers
-   Students present today
-   Students absent today

Use plain-language headings and large numbers. Avoid technical metrics,
dense graphs, and unexplained abbreviations.

## 4.4 Principal attendance screen

The principal should be able to answer:

-   Which classes have submitted attendance?
-   Which classes have not submitted it?
-   How many students are present or absent?
-   Which class needs attention?

Suggested screen:

1.  Page title: **Attendance**
2.  Date selector with a clear current-date default
3.  Simple school-wide present / absent summary
4.  Class-wise list
5.  Clear submission status for each class
6.  Option to open a class for details
7.  Easy report viewing or printing, if supported

Use plain statuses:

-   Attendance completed
-   Waiting for attendance
-   Needs attention

Avoid technical terms such as synchronization state or workflow state in
the principal-facing UI.

## 4.5 Principal reports

Reports should be understandable at a glance.

Prefer:

-   Large numbers
-   Simple bar charts
-   Clearly titled tables
-   Date ranges written in familiar language
-   Plain-language explanations
-   Print and export actions with recognizable icons and labels

Avoid:

-   Dense analytics dashboards
-   Multiple charts competing for attention
-   Technical KPI terminology
-   Unexplained percentages
-   Complex filter panels

A chart should answer one clear question. For example: "How many
students were present this week?"

## 4.6 Principal guided actions

Actions that change school records should be guided.

For example, an announcement flow:

1.  Select "Announcements".
2.  Select "Create announcement".
3.  Enter a short title and message.
4.  Choose who should receive it.
5.  Review the message.
6.  Press a clearly labelled "Send announcement" button.
7.  Show a confirmation.

Use the same guided pattern for other administrative tasks.

## 4.7 Principal usability rules

-   Prefer one clear action per screen.
-   Use familiar language, not technical jargon.
-   Use large pictograms paired with labels.
-   Keep primary buttons large and visually distinct.
-   Avoid hidden navigation and hover-only interactions.
-   Use visible back buttons and breadcrumbs where useful.
-   Confirm consequential actions before execution.
-   Explain errors in plain language and tell the user what to do next.
-   Use consistent positions for common actions.
-   Keep settings and rarely used functions away from the main home
    screen.
-   Provide a visible help option.

------------------------------------------------------------------------

# 5. Separate design identities, shared brand

  -----------------------------------------------------------------------
  Design area             Teacher app             Principal app
  ----------------------- ----------------------- -----------------------
  Primary device          Mobile                  Desktop / laptop

  Main layout             Bottom navigation       Visual dashboard /
                                                  sidebar

  Navigation              Five clear destinations Large pictogram tiles

  Interaction             Fast, frequent actions  Guided, deliberate
                                                  actions

  Information density     Moderate                Low

  Icons                   Supporting visual cues  Main navigation cues

  Text                    Concise and functional  Plain language,
                                                  descriptive

  Data presentation       Lists and cards         Large summaries and
                                                  simple reports

  Main priority           Speed                   Understandability

  Visual tone             Modern and energetic    Calm and approachable
  -----------------------------------------------------------------------

Both apps share the same brand colors, typography family, icon style,
status meanings, and component behavior.

They should not necessarily share the same component arrangement or
navigation structure.

------------------------------------------------------------------------

# 6. Accessibility and usability standards

These requirements apply to both apps.

-   Use readable text sizes and sufficient contrast.
-   Do not communicate status using color alone.
-   Give icons accessible names and visible labels where appropriate.
-   Make keyboard focus visible in the desktop app.
-   Support keyboard navigation for important desktop workflows.
-   Make touch targets comfortably large.
-   Use plain-language error messages.
-   Show loading, success, and failure states.
-   Avoid unexpected screen changes.
-   Keep important actions consistent.
-   Do not rely on hover to reveal essential information.
-   Test with users who have different levels of digital confidence.

For the Principal app in particular, test whether a first-time user can
find Attendance, Students, and Announcements without assistance.

------------------------------------------------------------------------

# 7. Design tokens and component consistency

Implement shared design tokens rather than hardcoding colors and spacing
in individual screens.

Suggested token groups:

-   `color.brand.primary`
-   `color.brand.secondary`
-   `color.surface`
-   `color.background`
-   `color.text.primary`
-   `color.text.secondary`
-   `color.status.success`
-   `color.status.warning`
-   `color.status.danger`
-   `radius.card`
-   `radius.button`
-   `spacing.small`
-   `spacing.medium`
-   `spacing.large`
-   `typography.heading`
-   `typography.body`
-   `typography.label`

The actual implementation should use the token naming conventions of the
chosen frontend stack.

Keep shared components in a common design-system layer where practical,
while allowing app-specific layouts and components.

------------------------------------------------------------------------

# 8. Recommended implementation order

Build and validate the experience in this order:

## Phase 1 --- Foundation

-   Establish brand colors, typography, icon family, spacing, and
    component rules.
-   Create shared buttons, cards, form fields, status indicators, and
    feedback patterns.

## Phase 2 --- Teacher app

-   Home screen
-   Attendance flow
-   Class and student list
-   Assignment creation and management
-   Timetable and announcements

Test the mobile flows with realistic teacher tasks.

## Phase 3 --- Principal app

-   Pictogram-first home screen
-   Student and teacher sections
-   Attendance overview
-   Assignment overview
-   Announcements
-   Simple reports

Test with users who are not comfortable with technology. Observe whether
they can complete common tasks without instruction.

## Phase 4 --- Refinement

-   Improve confusing labels and navigation.
-   Test small screens and different desktop sizes.
-   Verify loading, empty, error, and offline states.
-   Check accessibility and contrast.
-   Remove unnecessary steps and visual clutter.

------------------------------------------------------------------------

# 9. Final design decisions

The product should follow these decisions unless usability testing
reveals a better approach:

1.  **One school RMS brand, two distinct experiences.**
2.  **Teacher app is mobile-first and optimized for speed.**
3.  **Principal app is desktop-first and pictogram-first.**
4.  **Principal-facing language must be familiar and non-technical.**
5.  **Icons always accompany text for important navigation and
    actions.**
6.  **Both apps use the same core colors, typography, and status
    language.**
7.  **The interface should prioritize clarity over visual decoration.**
8.  **No screen should be crowded just to display more information.**

## Design north star

**Teacher app:** "I can get my work done quickly."

**Principal app:** "I can understand and manage my school without
struggling with technology."

That distinction should guide every screen, component, and interaction
in the RMS.
