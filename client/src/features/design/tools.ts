/** Reads a token's real value from the page, so what's shown can't drift from index.css. */
export function tokenValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio of two #rrggbb colors. */
export function contrastRatio(first: string, second: string): number {
  const [lighter = 0, darker = 0] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// A state in a selector looks like `:hover`. The lookbehind skips `\:hover`, which is part of a
// class name, as in `.hover\:bg-accent:hover`. Changing that would write a selector that's invalid.
const states: [RegExp, string][] = [
  [/(?<!\\):hover/g, '[data-force~="hover"]'],
  [/(?<!\\):focus(-visible)?(?![-\w])/g, '[data-force~="focus"]'],
  [/(?<!\\):active/g, '[data-force~="active"]'],
];

/** The same selector, matching a data-force attribute instead of the real state. */
export function forcedSelector(selector: string): string {
  return states.reduce((text, [pattern, marker]) => text.replace(pattern, marker), selector);
}

function copyRules(parent: CSSStyleSheet | CSSGroupingRule): void {
  // Backwards, because each copy goes right after its original and would shift later rules.
  for (let index = parent.cssRules.length - 1; index >= 0; index -= 1) {
    const rule = parent.cssRules[index];
    if (rule instanceof CSSStyleRule) {
      const selector = forcedSelector(rule.selectorText);
      if (selector !== rule.selectorText) {
        parent.insertRule(`${selector} { ${rule.style.cssText} }`, index + 1);
      }
    } else if (rule instanceof CSSGroupingRule) {
      copyRules(rule);
    }
  }
}

const copied = new WeakSet<CSSStyleSheet>();

/**
 * Hover, focus and pressed normally need a mouse or keyboard, so only one can be seen at a time.
 * This copies those CSS rules so that they also apply to an element with data-force="hover", and
 * so on. They're copies of the real rules, so a frozen example can't drift from the real state.
 *
 * Only inline sheets are read, because browsers block reading the Google Fonts sheet from another
 * site. The app's CSS is inline in development, which is the only place this page exists.
 */
export function forceStates(): void {
  for (const sheet of document.styleSheets) {
    if (sheet.href !== null || copied.has(sheet)) continue;
    copied.add(sheet);
    copyRules(sheet);
  }
}
