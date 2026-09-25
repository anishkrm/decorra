"use client";

import { useEffect, useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

type BeforeAfterSliderProps = {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
};

export default function BeforeAfterSlider({ before, after, beforeAlt, afterAlt }: BeforeAfterSliderProps) {
  // react-compare-slider computes its root element's inline style (touch-action, user-select,
  // display, --rcs-* custom properties, etc.) differently between the server-rendered markup
  // and its own first client render, which React flags as a hydration mismatch — a bug in the
  // library, not this code. Mounting it only after hydration sidesteps the mismatch entirely,
  // since there's then no server-rendered version of it to compare against.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="relative aspect-[4/3] overflow-hidden">
      {mounted ? (
        <ReactCompareSlider
          className="absolute inset-0 h-full w-full"
          itemOne={<ReactCompareSliderImage src={before} alt={beforeAlt} style={{ objectFit: "cover" }} />}
          itemTwo={<ReactCompareSliderImage src={after} alt={afterAlt} style={{ objectFit: "cover" }} />}
          defaultPosition={48}
        />
      ) : (
        // Static "after" image for the server-rendered shell and the first client paint.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={after} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <span className="glass-overlay pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px]">Before</span>
      <span className="glass-overlay pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px]">After</span>
    </div>
  );
}
