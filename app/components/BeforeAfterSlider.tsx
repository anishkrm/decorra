"use client";

import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

type BeforeAfterSliderProps = {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
};

export default function BeforeAfterSlider({ before, after, beforeAlt, afterAlt }: BeforeAfterSliderProps) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden">
      <ReactCompareSlider
        className="absolute inset-0 h-full w-full"
        itemOne={<ReactCompareSliderImage src={before} alt={beforeAlt} style={{ objectFit: "cover" }} />}
        itemTwo={<ReactCompareSliderImage src={after} alt={afterAlt} style={{ objectFit: "cover" }} />}
        defaultPosition={48}
      />
      <span className="glass-overlay pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px]">Before</span>
      <span className="glass-overlay pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px]">After</span>
    </div>
  );
}
