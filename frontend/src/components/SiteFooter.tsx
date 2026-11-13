import type { ReactElement } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import { explore, forRestaurants, neighborhoods } from "@/components/site-links";

// Read once, because a component must render the same way each time.
const year = new Date().getFullYear();

const footLink =
  "inline-flex min-h-touch items-center text-ui text-ink-secondary underline decoration-line-underline underline-offset-4 transition-[color,text-decoration-color] duration-button hover:text-ink hover:decoration-current md:min-h-0";

/**
 * The foot of every guest page, in one row under a hairline, as the export has it: the year, a few
 * ways around the site, and on the right the name in Armenian with what it means. The export's
 * About, Help, Terms and languages aren't pages Seghan has, so real links stand in their place.
 */
export function SiteFooter(): ReactElement {
  return (
    <footer className="mt-10">
      <PageContainer>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line py-10 text-ui text-ink-secondary">
          <span>© {year} Seghan</span>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-8 gap-y-1">
              {[explore, neighborhoods, forRestaurants].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={footLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* The one place the name appears in Armenian (§1.2). */}
          <span className="md:ml-auto">
            <span lang="hy" className="font-semibold text-ink">
              սեղան
            </span>
            <span className="ml-2">the Armenian word for table</span>
          </span>
        </div>
      </PageContainer>
    </footer>
  );
}
