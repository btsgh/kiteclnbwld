import Image from 'next/image';
import Link from 'next/link';
import { heroFont, bodyFont } from '@/app/fonts';
import { heroContent } from '@/data/content';

export function Hero() {
  return (
    <section className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col md:flex-row items-center gap-16">
      {/* Text Column */}
      <div className="md:w-5/12 flex flex-col items-start z-10">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A]`}>
          {heroContent.kicker}
        </span>
        <h1 className={`${heroFont.className} text-5xl md:text-7xl leading-[1.1] mb-8 text-[#1A1A1A]`}>
          {heroContent.headline}
        </h1>
        <p className={`${bodyFont.className} text-lg text-[#1A1A1A]/80 mb-10 max-w-md leading-relaxed`}>
          {heroContent.description}
        </p>
        <Link href="/menu" className={`${bodyFont.className} rounded-full bg-[#1A1A1A] text-white px-8 py-4 uppercase tracking-wider text-sm hover:bg-[#1A1A1A]/90 transition-colors`}>
          {heroContent.cta}
        </Link>
      </div>

      {/* Image Column */}
      <div className="md:w-7/12 relative w-full aspect-[3/4] md:aspect-[4/5] lg:aspect-[4/4]">
        {/* Architectural Grid Background */}
        <div className="absolute inset-0 -top-12 -right-12 -bottom-12 -left-12 pointer-events-none z-0" 
             style={{ 
               backgroundImage: `
                 linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
               `, 
               backgroundSize: '40px 40px' 
             }}>
        </div>
        
        {/* Rotating Badge */}
        <div className="absolute top-1/2 -left-16 -translate-y-1/2 w-32 h-32 z-20 animate-[spin_20s_linear_infinite] hidden md:block">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#1A1A1A] fill-current">
            <path id="circlePath" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
            <text className={`${bodyFont.className} text-[10.5px] uppercase tracking-[0.25em] font-semibold`}>
              <textPath href="#circlePath">{heroContent.badgeText}</textPath>
            </text>
          </svg>
        </div>

        {/* SVG Clip Path Definition */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <clipPath id="hero-mask" clipPathUnits="objectBoundingBox">
              <path d="M 0 0 L 0.5 0 C 0.8 0, 1 0.2, 1 0.5 L 1 1 L 0 1 Z" />
            </clipPath>
          </defs>
        </svg>

        {/* Image */}
        <div className="relative w-full h-full z-10" style={{ clipPath: 'url(#hero-mask)' }}>
          <Image 
            src={heroContent.image} 
            alt="Hero" 
            fill 
            className="object-cover"
            priority
          />
        </div>
      </div>
    </section>
  );
}
