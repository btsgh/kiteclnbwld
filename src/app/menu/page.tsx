import { Metadata } from 'next';
import { heroFont, bodyFont } from '@/app/fonts';
import { ProductGrid } from '@/components/ProductGrid';
import { ContactCTA } from '@/components/ContactCTA';

export const metadata: Metadata = {
  title: 'Menu | CleanBowled',
  description: 'Explore our curated menu of healthy, vegetarian bowls designed for everyday wellness and athletic performance.',
  alternates: { canonical: '/menu' },
  openGraph: {
    url: '/menu',
    title: 'Menu | CleanBowled',
    description: 'Explore our curated menu of healthy, vegetarian bowls designed for everyday wellness and athletic performance.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1200/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-product-bowl-1.png']
  }
};

export default function MenuPage() {
  return (
    <main className="bg-white min-h-screen pt-20">
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A] block`}>
          OUR MENU
        </span>
        <h1 className={`${heroFont.className} text-5xl md:text-7xl leading-tight mb-8 text-[#1A1A1A]`}>
          Curated for performance and healing.
        </h1>
        <p className={`${bodyFont.className} text-lg text-[#1A1A1A]/80 max-w-2xl mx-auto`}>
          Every bowl is crafted with intention, balancing macronutrients and utilizing the freshest organic ingredients to support your unique lifestyle.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-32">
        <ProductGrid />
      </section>

      <ContactCTA />
    </main>
  );
}
