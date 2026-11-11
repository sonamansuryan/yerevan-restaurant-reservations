// What the /design page shows. Only names and notes live here: every value is read from the page,
// and tokens.test.ts fails if a token or shared component is added without being listed.

export interface ColorToken {
  name: string;
  role: string;
  /** The surface it's shown on, when that isn't the page. */
  on?: string;
}

export interface ColorGroup {
  title: string;
  /** Colors are shown the way they're used: as a fill, as text or as a line. */
  kind: "fill" | "text" | "line";
  tokens: ColorToken[];
}

export const colorGroups: ColorGroup[] = [
  {
    title: "Surfaces",
    kind: "fill",
    tokens: [
      { name: "surface-page", role: "The page" },
      { name: "surface-raised", role: "Cards and modals" },
      { name: "surface-tinted", role: "Tinted bands" },
      { name: "surface-dark", role: "Dark bands" },
    ],
  },
  {
    title: "Text",
    kind: "text",
    tokens: [
      { name: "ink", role: "Primary" },
      { name: "ink-secondary", role: "Secondary" },
      { name: "ink-muted", role: "Muted" },
      { name: "on-dark", role: "On a dark band", on: "surface-dark" },
      { name: "on-dark-secondary", role: "Secondary, on dark", on: "surface-dark" },
      { name: "on-accent", role: "On wine", on: "accent" },
    ],
  },
  {
    title: "Accent",
    kind: "fill",
    tokens: [
      { name: "accent", role: "Wine" },
      { name: "accent-hover", role: "Wine, on hover" },
    ],
  },
  {
    title: "Lines",
    kind: "line",
    tokens: [
      { name: "line-soft", role: "Soft" },
      { name: "line", role: "Default" },
      { name: "line-strong", role: "Strong" },
      { name: "line-control", role: "Form fields" },
      { name: "line-divider", role: "Search divider" },
      { name: "line-underline", role: "Link underline" },
      { name: "line-rule", role: "The double rule" },
      { name: "line-on-dark", role: "On a dark band", on: "surface-dark" },
    ],
  },
  {
    title: "Control fills",
    kind: "fill",
    tokens: [
      { name: "fill-slot", role: "Slot button" },
      { name: "fill-hover", role: "Field hover" },
      { name: "fill-primary-hover", role: "Protected button hover" },
      { name: "fill-overlay", role: "Icon button on a photo", on: "tone-1" },
    ],
  },
  {
    title: "Status",
    kind: "fill",
    tokens: [
      { name: "success", role: "Success" },
      { name: "success-soft", role: "Success, soft" },
      { name: "warning", role: "Warning" },
      { name: "warning-soft", role: "Warning, soft" },
      { name: "error", role: "Error" },
      { name: "error-soft", role: "Error, soft" },
      { name: "info", role: "Info" },
      { name: "info-soft", role: "Info, soft" },
      { name: "neutral-soft", role: "Neutral, soft" },
    ],
  },
  {
    title: "Backdrop",
    kind: "fill",
    tokens: [{ name: "backdrop", role: "Behind an open modal", on: "surface-page" }],
  },
  {
    title: "Photo tones",
    kind: "fill",
    tokens: [
      { name: "tone-1", role: "Clay" },
      { name: "tone-2", role: "Plum" },
      { name: "tone-3", role: "Walnut" },
      { name: "tone-4", role: "Slate" },
      { name: "tone-5", role: "Olive" },
      { name: "tone-6", role: "Char" },
    ],
  },
];

export const displaySizes = [
  { name: "hero", sample: "A table in Yerevan" },
  { name: "feature", sample: "Wine evenings on Saryan Street" },
  { name: "section", sample: "Booking well this week" },
  { name: "masthead", sample: "The logo in the header" },
  { name: "logo", sample: "Modal titles and the phone logo" },
  { name: "logo-sm", sample: "Mobile menu entries" },
  { name: "title", sample: "Tsiran Wine Room" },
  { name: "title-sm", sample: "Lori Smokehouse" },
  { name: "title-xs", sample: "Discover" },
];

export const uiSizes = [
  { name: "lead", sample: "See real availability and book in seconds." },
  { name: "body", sample: "A table for four on Friday at 20:00." },
  { name: "input", sample: "Search-bar text, on desktop" },
  { name: "ui", sample: "Reserve a table" },
  { name: "meta", sample: "Armenian · Kentron · ֏֏֏" },
  { name: "caption", sample: "Footer headings" },
  { name: "eyebrow", sample: "For restaurants", upper: true },
  { name: "label", sample: "Date", upper: true },
];

export const fontTokens = [
  { name: "font-display", role: "Names and big moments" },
  { name: "font-sans", role: "Controls and data" },
];

export const typeDetails = [
  { name: "tracking-label", role: "Letter spacing for footer headings" },
  { name: "leading-copy", role: "Line height for intro text" },
];

export const spaceTokens = [
  { name: "spacing-gutter-sm", role: "Side margin on phones" },
  { name: "spacing-gutter", role: "Side margin" },
  { name: "spacing-touch", role: "The smallest tap target" },
  { name: "spacing-header-sm", role: "Header height on phones" },
  { name: "spacing-section-sm", role: "Section padding, small" },
  { name: "spacing-header", role: "Header height" },
  { name: "spacing-section-md", role: "Section padding, medium" },
  { name: "spacing-section-lg", role: "Section padding, large" },
];

export const pageWidthToken = { name: "container-page", role: "The page's full width" };

export const radiusTokens = [
  { name: "radius-check", role: "Checkbox" },
  { name: "radius-slot", role: "Slot" },
  { name: "radius-control", role: "Button" },
  { name: "radius-cta", role: "Search button" },
  { name: "radius-media", role: "Photo" },
  { name: "radius-card", role: "Card and modal" },
  { name: "radius-hero", role: "Hero photo" },
  { name: "radius-band", role: "Dark band" },
  { name: "radius-pill", role: "Pill and dot" },
];

export const shadowTokens = [
  { name: "shadow-search", role: "Search bar" },
  { name: "shadow-float", role: "Floating card and modal" },
];

export const ruleShadowTokens = [
  { name: "shadow-rule-focus", role: "A field in focus", line: "accent" },
  { name: "shadow-rule-error", role: "A field with an error, in focus", line: "error" },
];

export const durationTokens = [
  { name: "transition-duration-button", role: "Buttons" },
  { name: "transition-duration-check", role: "The check mark" },
  { name: "transition-duration-modal", role: "Modal and mobile menu" },
  { name: "transition-duration-image", role: "A photo on hover" },
  { name: "transition-duration-tile", role: "A tile on hover" },
];

export const easingTokens = [
  { name: "default-transition-timing-function", role: "Most changes" },
  { name: "ease-tile", role: "Anything that moves into place" },
];

export const animationToken = { name: "animate-breathe", role: "Page loading" };

export interface ShownComponent {
  name: string;
  /** The file in frontend/src/components it comes from. */
  file: string;
  section: string;
}

/** Every shared component, and the section that shows it. */
export const shownComponents: ShownComponent[] = [
  { name: "Button", file: "Button", section: "actions" },
  { name: "LinkButton", file: "Button", section: "actions" },
  { name: "Input", file: "Input", section: "forms" },
  { name: "Select", file: "Select", section: "forms" },
  { name: "Textarea", file: "Textarea", section: "forms" },
  { name: "Checkbox", file: "Checkbox", section: "forms" },
  { name: "Field", file: "Field", section: "forms" },
  { name: "PasswordField", file: "PasswordField", section: "forms" },
  { name: "ChoiceLines", file: "ChoiceLines", section: "forms" },
  { name: "OrDivider", file: "OrDivider", section: "forms" },
  { name: "Pagination", file: "Pagination", section: "actions" },
  { name: "SectionNav", file: "SectionNav", section: "actions" },
  { name: "Badge", file: "Badge", section: "feedback" },
  { name: "FormNotice", file: "FormNotice", section: "feedback" },
  { name: "Spinner", file: "Spinner", section: "feedback" },
  { name: "Modal", file: "Modal", section: "feedback" },
  { name: "Icons", file: "icons", section: "feedback" },
  { name: "Logo", file: "Logo", section: "brand" },
  { name: "SiteHeader", file: "SiteHeader", section: "brand" },
  { name: "MastheadRow", file: "Masthead", section: "brand" },
  { name: "MobileMenu", file: "MobileMenu", section: "brand" },
  { name: "SiteFooter", file: "SiteFooter", section: "brand" },
  { name: "PageContainer", file: "PageContainer", section: "brand" },
  { name: "AppLayout", file: "AppLayout", section: "brand" },
  { name: "EmptyState", file: "EmptyState", section: "protected" },
  { name: "ErrorState", file: "ErrorState", section: "protected" },
];

/**
 * The states each screen is shown in, in the Screens section. That section has a specimen for every
 * label here, and TypeScript holds it to that, so the count in the contents stays true.
 */
export const screenStates = {
  signIn: [
    "Ready (live)",
    "Field errors",
    "Sending",
    "Wrong email or password",
    "Too many tries",
    "No connection",
  ],
  signUp: ["A guest (live)", "A restaurant", "Field errors", "Sending", "Email taken"],
  leftPage: ["A guest, before typing", "A guest, with a name", "A long name", "A restaurant"],
  google: [
    "Ready (live)",
    "Loading",
    "Sending",
    "Email taken",
    "Email not verified",
    "Couldn’t sign in",
    "Google can’t load",
  ],
  guard: ["Checking your account", "Not for this account", "Couldn’t check"],
  browseFilters: ["Nothing chosen (live)", "Search and filters chosen"],
  browseResults: [
    "Loading",
    "A page of restaurants",
    "Loading the next list",
    "No matches",
    "Nothing yet",
    "Couldn’t load",
    "Past the last page",
  ],
  restaurantCard: ["Menu cover", "A long Armenian name", "Several cuisines", "No description"],
  home: [
    "Evening over Yerevan, beside the headline",
    "The search",
    "A few places to start",
    "Loading",
    "Nothing yet",
    "Couldn’t load",
  ],
  restaurantPage: [
    "Late nights and a closed day",
    "Split shifts, no description",
    "A long Armenian name, with a website",
    "With reviews",
    "Loading",
    "Couldn’t load",
  ],
  dashboardList: ["Your restaurants", "No restaurants yet", "Loading", "Couldn’t load"],
  dashboardHeader: ["Published", "A draft, with a long Armenian name"],
  dayBookings: [
    "Today, a full book (live)",
    "Another day, no bookings",
    "Loading",
    "Couldn’t load",
  ],
  publishPanel: ["Just added", "A draft", "Published", "Publishing", "Not ready to publish"],
  restaurantForm: ["A new restaurant (live)", "Field errors", "Sending", "Saved", "No connection"],
  openingHours: [
    "Split shifts (live)",
    "Late nights and a closed day",
    "No hours yet",
    "An overlap",
    "An empty week",
    "Sending",
    "Saved",
  ],
  photos: ["A cover and photos (live)", "No photos yet", "Uploading", "The limit", "Upload failed"],
  tables: [
    "Every area (live)",
    "No tables yet",
    "Loading",
    "Couldn’t load",
    "Bookings need the table",
    "The last active table",
  ],
  tableForm: [
    "A new table (live)",
    "Editing T4",
    "Field errors",
    "Sending",
    "The name is taken",
    "Too few seats for a booking",
  ],
  blockedTimes: ["Coming up (live)", "No blocked times", "Loading", "Couldn’t load"],
  blockForm: [
    "A whole day (live)",
    "One table, a time range",
    "Field errors",
    "Sending",
    "Bookings inside it",
  ],
} as const;

function componentsIn(section: string): number {
  return shownComponents.filter((component) => component.section === section).length;
}

/** The page's sections. Counts come from the lists above, so they can't go stale. */
export const contents = [
  { id: "color", title: "Color", items: colorGroups.flatMap((group) => group.tokens).length },
  {
    id: "type",
    title: "Type",
    items: displaySizes.length + uiSizes.length + fontTokens.length + typeDetails.length,
  },
  { id: "space", title: "Space", items: spaceTokens.length + 1 },
  {
    id: "shape",
    title: "Shape",
    items: radiusTokens.length + shadowTokens.length + ruleShadowTokens.length,
  },
  { id: "motion", title: "Motion", items: durationTokens.length + easingTokens.length + 1 },
  { id: "actions", title: "Actions", items: componentsIn("actions") },
  { id: "forms", title: "Forms", items: componentsIn("forms") },
  { id: "feedback", title: "Feedback", items: componentsIn("feedback") },
  { id: "brand", title: "Brand and shell", items: componentsIn("brand") },
  { id: "protected", title: "Protected designs", items: componentsIn("protected") },
  { id: "responsive", title: "Responsive", items: "live" },
  { id: "screens", title: "Screens", items: Object.values(screenStates).flat().length },
];
