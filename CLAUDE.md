# CLAUDE.md

## Project

**Seghan** is a two-sided web app built as an internship project. Its project title is the Yerevan Restaurant Reservation Platform.

- **Customers** browse, search and filter Yerevan restaurants, then pick a date, time and number of guests. They see which tables are free, book or cancel, and review places they visited.
- **Restaurant owners** get a private dashboard. There they manage restaurant information and photos, tables and capacity, opening hours, and blocked tables or dates. They also confirm or cancel bookings and mark guests as arrived or no-show.
- **After the core works:** reviews, favorites, email confirmations, Google Maps, an admin panel and basic analytics, then deployment.
- **Non-negotiable:** a table can never be double-booked. PostgreSQL enforces this with an exclusion constraint, and bookings, blocks and table changes lock the table's row first (PROJECT_PLAN.md §5.4).
- **Public name:** everything users can see says `Seghan`, and the logo says lowercase `seghan`. Internal identifiers such as `yerevan-reservations` and `yerevan_dev` stay unchanged (PROJECT_PLAN.md §1).

## Where to go next

- **[ASSIGNMENT.md](.claude/plans/ASSIGNMENT.md)** is the Team Lead's assignment, word for word, and the source of truth for requirements. It stays on this machine and is never committed.
- **[PROJECT_PLAN.md](.claude/plans/PROJECT_PLAN.md)** says what we build: the requirements, booking rules, data model and roadmap. The current task is the first unticked box in §7.
- **[general-rules.md](.claude/rules/general-rules.md)** says how we work: the workflow, tech stack, commands, and the security, database, testing and design rules. Claude Code loads it automatically.
