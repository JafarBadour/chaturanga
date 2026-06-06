import { useEffect, useState } from "react";

const DEFAULT_MIN = 8;
const DEFAULT_MAX = 50;

/**
 * Fit list page size to the visible scroll area height.
 */
export function useDynamicPageSize(
  containerRef,
  { min = DEFAULT_MIN, max = DEFAULT_MAX, rowHeight = 46, headerHeight = 44 } = {}
) {
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const height = el.clientHeight - headerHeight;
      if (height < rowHeight) return;
      const rows = Math.max(min, Math.min(max, Math.floor(height / rowHeight)));
      setPageSize((prev) => (prev === rows ? prev : rows));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, min, max, rowHeight, headerHeight]);

  return pageSize;
}
