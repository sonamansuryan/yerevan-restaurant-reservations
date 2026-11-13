import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

// Icons are decorative by default: aria-hidden keeps screen readers on the text beside them.
function Icon(props: IconProps): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function AlertIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

/** Blocked: a circle struck through. */
export function BanIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Icon>
  );
}

/** Numbers over time: three bars on a baseline. */
export function ChartIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M5 20V11M11 20V5M17 20v-7M3 20h18" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

/** Saved or not: the heart is outlined, and filled once it's saved, with `fill="currentColor"`. */
export function HeartIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
    </Icon>
  );
}

/** A photo: a frame with a hill and the sun. */
export function ImageIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-4.5-4.5-8.5 8" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

/** A restaurant's own details: a house front with its door. */
/** A minus sign, as on the guests' stepper. */
export function MinusIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

/** A pencil, for editing. */
export function PencilIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z" />
      <path d="M13 7l4 4" />
    </Icon>
  );
}

/** A pin on a map, for directions. */
export function PinIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

/** A plus sign, as on the guests' stepper. */
export function PlusIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** A filled star, for a rating. It's drawn in the star's own color, and the number says the rest. */
export function StarIcon(props: IconProps): ReactElement {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.7 6.6 19.7l1.2-6-4.5-4.2 6.1-.7z" />
    </Icon>
  );
}

export function StoreIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M4 20.5V9.5l8-5 8 5v11z" />
      <path d="M9.5 20.5v-6h5v6" />
    </Icon>
  );
}

/** A table: its top and two legs. */
export function TableIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <rect x="3.5" y="7.5" width="17" height="5" rx="1" />
      <path d="M7 12.5v7M17 12.5v7" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2" />
    </Icon>
  );
}
