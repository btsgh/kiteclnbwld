import Image from 'next/image';
import { heroFont, bodyFont } from '@/app/fonts';
import { trustContent } from '@/data/content';

export function TrustSection() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-24 md:py-32 text-center border-t border-gray-100">
      <div className="mb-16">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A] block`}>
          TESTIMONIALS
        </span>
        <h2 className={`${heroFont.className} text-4xl md:text-5xl text-[#1A1A1A]`}>Stories of Nourishment</h2>
      </div>
      <div className="grid grid-cols-1 gap-12">
        {trustContent.map((t, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-8 relative">
              <Image src={t.image} alt={t.author} fill className="object-cover" />
            </div>
            <blockquote className={`${heroFont.className} text-2xl md:text-3xl text-[#1A1A1A] leading-relaxed mb-8 max-w-2xl`}>
              "{t.quote}"
            </blockquote>
            <cite className={`${bodyFont.className} text-xs md:text-sm uppercase tracking-widest text-[#1A1A1A] not-italic`}>
              <span className="font-semibold">{t.author}</span> — {t.role}
            </cite>
          </div>
        ))}
      </div>
    </section>
  );
}
