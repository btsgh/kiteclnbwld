import Link from 'next/link';
import { heroFont, bodyFont } from '@/app/fonts';

export function ContactCTA() {
  return (
    <section className="py-24 md:py-32 bg-[#EDCABF] text-center px-6">
      <div className="max-w-3xl mx-auto">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A] block`}>
          GET IN TOUCH
        </span>
        <h2 className={`${heroFont.className} text-4xl md:text-5xl leading-tight mb-8 text-[#1A1A1A]`}>
          Ready to elevate your everyday nutrition?
        </h2>
        <p className={`${bodyFont.className} text-lg text-[#1A1A1A]/80 mb-10 leading-relaxed`}>
          Whether you have a question about our ingredients, need help with a delivery, or want to partner for a pop-up event, we'd love to hear from you.
        </p>
        <Link href="/contact" className={`${bodyFont.className} rounded-full bg-[#1A1A1A] text-white px-8 py-4 uppercase tracking-wider text-sm hover:bg-[#1A1A1A]/90 transition-colors inline-block`}>
          Contact Us
        </Link>
      </div>
    </section>
  );
}
