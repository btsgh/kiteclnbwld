import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { heroFont, bodyFont } from '@/app/fonts';
import { featureSplit } from '@/data/content';

export function FeatureSplit() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col md:flex-row items-center gap-16 md:gap-24">
      <div className="md:w-1/2 relative w-full aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden">
        <Image src={featureSplit.image} alt="Feature" fill className="object-cover" />
        
        {/* Pulsing Dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 bg-white rounded-full z-10"></div>
            <div className="absolute inset-0 bg-white rounded-full animate-[ping_1.5s_ease-out_infinite] opacity-75"></div>
          </div>
        </div>
      </div>

      <div className="md:w-1/2 flex flex-col items-start">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A]`}>
          {featureSplit.kicker}
        </span>
        <h2 className={`${heroFont.className} text-4xl md:text-5xl leading-tight mb-8 text-[#1A1A1A]`}>
          {featureSplit.headline}
        </h2>
        <p className={`${bodyFont.className} text-lg text-[#1A1A1A]/80 mb-10 leading-relaxed`}>
          {featureSplit.description}
        </p>
        <Link href="/contact" className={`${bodyFont.className} rounded-full bg-[#1A1A1A] text-white px-8 py-4 uppercase tracking-wider text-sm hover:bg-[#1A1A1A]/90 transition-colors inline-flex items-center gap-3`}>
          {featureSplit.cta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
