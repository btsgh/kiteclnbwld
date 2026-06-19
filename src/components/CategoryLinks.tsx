'use client';

import { useState } from 'react';
import Image from 'next/image';
import { bodyFont } from '@/app/fonts';
import { categories } from '@/data/content';

const VISIBLE = 3;

export function CategoryLinks() {
  const total = categories.length;
  const maxIndex = total - VISIBLE;
  const [index, setIndex] = useState(0);

  const prev = () => setIndex(i => Math.max(i - 1, 0));
  const next = () => setIndex(i => Math.min(i + 1, maxIndex));

  const slidePercent = (100 / VISIBLE) * index;

  return (
    <div className="w-full">
      {/* Slider viewport */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${slidePercent}%)` }}
        >
          {categories.map((c, i) => (
            <div
              key={c.name}
              className="w-1/3 shrink-0 px-3 md:px-4"
              aria-hidden={i < index || i >= index + VISIBLE}
            >
              <div className="flex flex-col group cursor-pointer">
                <div className="w-full aspect-[3/4] rounded-3xl overflow-hidden mb-4 relative bg-[#EDCABF]">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <span className={`${bodyFont.className} text-xs md:text-sm uppercase tracking-widest text-[#1A1A1A] font-semibold`}>
                  {c.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-10 flex items-center justify-between">
        {/* Dot indicators */}
        <div className="flex gap-2">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#1A1A1A]' : 'w-2 bg-[#1A1A1A]/30'}`}
            />
          ))}
        </div>

        {/* Prev / Next arrows */}
        <div className="flex gap-3">
          <button
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous slide"
            className="rounded-full border border-[#1A1A1A] p-2.5 transition-opacity disabled:opacity-25 hover:bg-[#1A1A1A] hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={next}
            disabled={index === maxIndex}
            aria-label="Next slide"
            className="rounded-full border border-[#1A1A1A] p-2.5 transition-opacity disabled:opacity-25 hover:bg-[#1A1A1A] hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
