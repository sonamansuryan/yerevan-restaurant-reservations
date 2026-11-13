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
      { name: "surface-dark", role: "Dark bands and the dark menu" },
      { name: "surface-dark-raised", role: "The open link in the dark menu", on: "surface-dark" },
      { name: "surface-blush", role: "The owners' band, avatars and tags" },
      { name: "surface-office", role: "The dashboard's and admin's page" },
    ],
  },
  {
    title: "Text",
    kind: "text",
    tokens: [
      { name: "ink", role: "Primary" },
      { name: "ink-body", role: "Long text, such as About" },
      { name: "ink-secondary", role: "Secondary" },
      { name: "ink-muted", role: "Muted" },
      { name: "on-dark", role: "On a dark band", on: "surface-dark" },
      { name: "on-dark-secondary", role: "Secondary, on dark", on: "surface-dark" },
      { name: "on-dark-muted", role: "Small print, on dark", on: "surface-dark" },
      { name: "on-accent", role: "On wine", on: "accent" },
      { name: "accent-on-dark", role: "The home page's eyebrow, on dark", on: "surface-dark" },
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
      { name: "line-danger", role: "A cancelling button's outline" },
    ],
  },
  {
    title: "Control fills",
    kind: "fill",
    tokens: [
      { name: "fill-slot", role: "Slot button" },
      { name: "fill-hover", role: "Field hover, the stepper's buttons" },
      { name: "fill-disabled", role: "A button that waits" },
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
      { name: "success-strong", role: "A green button, and Open now" },
      { name: "warning", role: "Warning" },
      { name: "warning-soft", role: "Warning, soft" },
      { name: "error", role: "Error" },
      { name: "error-soft", role: "Error, soft" },
      { name: "info", role: "Info" },
      { name: "info-soft", role: "Info, soft" },
      { name: "neutral-soft", role: "Neutral, soft" },
      { name: "star", role: "A rating's star" },
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
      { name: "tone-2", role: "Pine" },
      { name: "tone-3", role: "Plum" },
      { name: "tone-4", role: "Slate" },
      { name: "tone-5", role: "Ochre" },
      { name: "tone-6", role: "Olive" },
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

/** Every page's headings, in Bricolage Grotesque. */
export const guestSizes = [
  { name: "headline", sample: "Find a table in Yerevan" },
  { name: "display", sample: "Dolmama" },
  { name: "page-title", sample: "My reservations" },
  { name: "part", sample: "Reservations" },
  { name: "heading", sample: "Available tonight for 2" },
  { name: "subheading", sample: "Opening hours" },
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
  { name: "font-display", role: "The protected states' titles only" },
  { name: "font-sans", role: "Everything you read or press" },
  { name: "font-grotesque", role: "The logo and every heading" },
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
  { name: "radius-chip", role: "A card's time, a row's button" },
  { name: "radius-slot", role: "Slot" },
  { name: "radius-control", role: "Button" },
  { name: "radius-cta", role: "The page's big button" },
  { name: "radius-media", role: "Small photo" },
  { name: "radius-card", role: "Field, time and notice" },
  { name: "radius-hero", role: "Search, choice and day" },
  { name: "radius-band", role: "Card, panel and modal" },
  { name: "radius-sheet", role: "Booking panel and photos" },
  { name: "radius-feature", role: "Owners' band and phone sheet" },
  { name: "radius-pill", role: "Pill and dot" },
];

export const shadowTokens = [
  { name: "shadow-search", role: "Search bar on the page" },
  { name: "shadow-panel", role: "The booking panel" },
  { name: "shadow-tab", role: "The open half of a switch" },
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
  { name: "PillSelect", file: "PillSelect", section: "forms" },
  { name: "Pagination", file: "Pagination", section: "actions" },
  { name: "SectionNav", file: "SectionNav", section: "actions" },
  { name: "SlotButton", file: "SlotButton", section: "actions" },
  { name: "SaveButton", file: "SaveButton", section: "actions" },
  { name: "Badge", file: "Badge", section: "feedback" },
  { name: "FormNotice", file: "FormNotice", section: "feedback" },
  { name: "Spinner", file: "Spinner", section: "feedback" },
  { name: "Modal", file: "Modal", section: "feedback" },
  { name: "Icons", file: "icons", section: "feedback" },
  { name: "Figures", file: "Figures", section: "figures" },
  { name: "BarList", file: "BarList", section: "figures" },
  { name: "Logo", file: "Logo", section: "brand" },
  { name: "SiteHeader", file: "SiteHeader", section: "brand" },
  { name: "MastheadRow", file: "Masthead", section: "brand" },
  { name: "MobileMenu", file: "MobileMenu", section: "brand" },
  { name: "SiteFooter", file: "SiteFooter", section: "brand" },
  { name: "PageContainer", file: "PageContainer", section: "brand" },
  { name: "SideNav", file: "SideNav", section: "brand" },
  { name: "PartHeader", file: "PartHeader", section: "brand" },
  { name: "Panel", file: "Panel", section: "brand" },
  { name: "AppLayout", file: "AppLayout", section: "brand" },
  { name: "OfficeLayout", file: "OfficeLayout", section: "brand" },
  { name: "OfficeAccount", file: "OfficeAccount", section: "brand" },
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
  authPanel: [
    "Sign in",
    "A guest, before typing",
    "A guest, with a name",
    "A long name",
    "A restaurant",
  ],
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
  browseFilters: ["Nothing chosen (live)", "Search and filters chosen", "Highest rated first"],
  browseResults: [
    "Loading",
    "A page of restaurants",
    "Loading the next list",
    "No matches",
    "Nothing yet",
    "Couldn’t load",
    "Past the last page",
    "Highest rated first",
  ],
  restaurantCard: [
    "Menu cover",
    "A long Armenian name",
    "Several cuisines",
    "No description",
    "Rated by guests",
    "Rated by one guest",
    "A demo listing",
    "A cover shown whole",
  ],
  home: [
    "The opening, with the search",
    "Available tonight",
    "Tonight’s times loading",
    "No tables free tonight",
    "Tonight’s times didn’t load",
    "Explore by neighborhood",
    "Neighborhoods, still counting",
    "For restaurant owners",
    "Loading",
    "Nothing yet",
    "Couldn’t load",
  ],
  restaurantPage: [
    "Late nights and a closed day",
    "Split shifts, no description",
    "A long Armenian name, with a website",
    "With reviews",
    "With a map (live)",
    "The map loading",
    "No map: none set up, or it couldn’t load",
    "A demo listing, its photos credited",
    "A demo listing with no photo",
    "A demo listing with details missing",
    "A demo listing, its photos from its own site",
    "A demo listing not in OpenStreetMap",
    "A cover shown whole",
    "Loading",
    "Couldn’t load",
  ],
  dashboardList: [
    "Your restaurants",
    "One hidden by Seghan",
    "No restaurants yet",
    "Loading",
    "Couldn’t load",
  ],
  dashboardHeader: ["Published", "A draft, with a long Armenian name", "Hidden by Seghan"],
  dayBookings: [
    "Today, a full book (live)",
    "Sending a change",
    "Changed",
    "Changed elsewhere first",
    "Another day, no bookings",
    "Loading",
    "Couldn’t load",
  ],
  publishPanel: [
    "Just added",
    "A draft",
    "Published",
    "Publishing",
    "Not ready to publish",
    "Hidden by Seghan",
  ],
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
  booking: [
    "Choosing (live)",
    "Finding free tables",
    "Couldn’t load the times",
    "No times on this day",
    "Every table taken",
    "Choosing a table",
  ],
  bookingConfirm: [
    "Ready to book",
    "Signed out",
    "An owner’s account",
    "Booking",
    "The table was just taken",
    "The table is no longer free",
    "The time is no longer free",
    "Couldn’t book",
    "Booked",
  ],
  myReservations: [
    "Upcoming (live)",
    "Past, over several pages",
    "Cancelling",
    "Cancelled",
    "Too late to cancel",
    "Couldn’t cancel",
    "No upcoming bookings",
    "No past bookings",
    "Loading",
    "Couldn’t load",
    "Past the last page",
    "A visit to review (live)",
    "Reviewed",
  ],
  reviewForm: [
    "Ready (live)",
    "Field errors",
    "Sending",
    "Already reviewed",
    "Not marked as arrived",
    "No connection",
  ],
  saveRestaurant: [
    "Signed out",
    "Not saved (live)",
    "Checking",
    "Saving",
    "Saved",
    "Couldn’t save",
  ],
  myFavorites: [
    "Saved restaurants (live)",
    "Removing",
    "Removed, with Undo",
    "Back in favorites",
    "Couldn’t remove",
    "No favorites yet",
    "Loading",
    "Couldn’t load",
    "Past the last page",
  ],
  restaurantReviews: [
    "Newest first, with more to show",
    "No reviews yet",
    "Loading",
    "Couldn’t load",
    "Showing more",
    "More couldn’t load",
  ],
  adminHeader: ["Restaurants open"],
  adminRestaurants: [
    "Every restaurant (live)",
    "Hiding",
    "Hidden",
    "Shown again",
    "Shown again, a draft",
    "Couldn’t change",
    "Only the hidden ones",
    "With a demo listing",
    "No restaurants match",
    "No restaurants yet",
    "Loading",
    "Couldn’t load",
    "Past the last page",
  ],
  adminReservations: [
    "Every booking",
    "One day’s no-shows",
    "No reservations match",
    "No reservations yet",
    "Loading",
    "Couldn’t load",
  ],
  adminUsers: ["Everyone", "Owners only", "No users match", "Loading", "Couldn’t load"],
  analytics: [
    "The last 30 days (live)",
    "The next period loading",
    "No reviews yet",
    "No bookings in these days",
    "No bookings, even in 90 days",
    "Loading",
    "Couldn’t load",
  ],
  adminAnalytics: [
    "All of Seghan, the last 30 days",
    "A long Armenian name",
    "No bookings in these days",
    "Loading",
    "Couldn’t load",
  ],
} as const;

/** The journeys the Flows section shows, one screen after another. */
export const flows = ["Book a table", "Handle a reservation"] as const;

function componentsIn(section: string): number {
  return shownComponents.filter((component) => component.section === section).length;
}

/** The page's sections. Counts come from the lists above, so they can't go stale. */
export const contents = [
  { id: "color", title: "Color", items: colorGroups.flatMap((group) => group.tokens).length },
  {
    id: "type",
    title: "Type",
    items:
      displaySizes.length +
      guestSizes.length +
      uiSizes.length +
      fontTokens.length +
      typeDetails.length,
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
  { id: "figures", title: "Figures", items: componentsIn("figures") },
  { id: "brand", title: "Brand and shell", items: componentsIn("brand") },
  { id: "protected", title: "Protected designs", items: componentsIn("protected") },
  { id: "responsive", title: "Responsive", items: "live" },
  { id: "screens", title: "Screens", items: Object.values(screenStates).flat().length },
  { id: "flows", title: "Flows", items: flows.length },
];
