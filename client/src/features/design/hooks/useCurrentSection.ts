import { useEffect, useState } from "react";

/** The id of the section near the top of the window, so the contents can mark it. */
export function useCurrentSection(ids: string[]): string | undefined {
  const [current, setCurrent] = useState(ids[0]);

  useEffect(() => {
    // The margins shrink the area being watched to a thin band, 10% to 20% of the way down the
    // window, so only one section is in it at a time.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: "-10% 0px -80% 0px" },
    );

    ids.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [ids]);

  return current;
}
