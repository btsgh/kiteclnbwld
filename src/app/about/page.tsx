import { Metadata } from 'next';
import Image from 'next/image';
import { heroFont, bodyFont } from '@/app/fonts';
import { ContactCTA } from '@/components/ContactCTA';

export const metadata: Metadata = {
  title: 'Our Story | CleanBowled',
  description: 'Learn about the origins of CleanBowled and our mission to provide elevated vegetarian nutrition.',
  alternates: { canonical: '/about' },
  openGraph: {
    url: '/about',
    title: 'Our Story | CleanBowled',
    description: 'Learn about the origins of CleanBowled and our mission to provide elevated vegetarian nutrition.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1600/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-feature-availability.png']
  }
};

export default function AboutPage() {
  return (
    <main className="bg-[#F9E0D5] min-h-screen pt-20">
      {/* About Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A] block`}>
          OUR STORY
        </span>
        <h1 className={`${heroFont.className} text-5xl md:text-7xl leading-tight mb-12 text-[#1A1A1A] max-w-4xl mx-auto`}>
          Nourishment rooted in nature, crafted for modern life.
        </h1>
        <div className="w-full aspect-[21/9] relative rounded-3xl overflow-hidden">
          <Image 
            src="https://static.kite.ai/image/upload/f_auto,q_auto,w_2100/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-feature-availability.png" 
            alt="CleanBowled Pop-up" 
            fill 
            className="object-cover"
            priority
          />
        </div>
      </section>

      {/* Story Content */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <div className="prose prose-lg text-[#1A1A1A]/80">
          <p className={`${bodyFont.className} text-xl leading-relaxed mb-8`}>
            CleanBowled began with a simple observation: finding truly nourishing, plant-based food that doesn't compromise on flavor or convenience is incredibly difficult. We wanted to change that.
          </p>
          <p className={`${bodyFont.className} leading-relaxed mb-8`}>
            Whether you are an athlete demanding clean protein, a mother focusing on postpartum recovery, or someone simply looking to maintain a healthy lifestyle, your body deserves ingredients that energize and heal. We source locally, prepare mindfully, and deliver directly to your door.
          </p>
        </div>
      </section>

      {/* Stats Block */}
      <section className="max-w-5xl mx-auto px-6 py-24 border-t border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          <div>
            <div className={`${heroFont.className} text-5xl md:text-6xl text-[#1A1A1A] mb-4`}>100%</div>
            <div className={`${bodyFont.className} text-xs uppercase tracking-widest text-[#1A1A1A]/60 font-semibold`}>Plant-Based</div>
          </div>
          <div>
            <div className={`${heroFont.className} text-5xl md:text-6xl text-[#1A1A1A] mb-4`}>0</div>
            <div className={`${bodyFont.className} text-xs uppercase tracking-widest text-[#1A1A1A]/60 font-semibold`}>Refined Sugars</div>
          </div>
          <div>
            <div className={`${heroFont.className} text-5xl md:text-6xl text-[#1A1A1A] mb-4`}>24h</div>
            <div className={`${bodyFont.className} text-xs uppercase tracking-widest text-[#1A1A1A]/60 font-semibold`}>Farm to Bowl</div>
          </div>
          <div>
            <div className={`${heroFont.className} text-5xl md:text-6xl text-[#1A1A1A] mb-4`}>5k+</div>
            <div className={`${bodyFont.className} text-xs uppercase tracking-widest text-[#1A1A1A]/60 font-semibold`}>Bowls Delivered</div>
          </div>
        </div>
      </section>

      <ContactCTA />
    </main>
  );
}
