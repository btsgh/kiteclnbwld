import { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { CategoryLinks } from '@/components/CategoryLinks';
import { ProductGrid } from '@/components/ProductGrid';
import { ValueProps } from '@/components/ValueProps';
import { FeatureSplit } from '@/components/FeatureSplit';
import { TrustSection } from '@/components/TrustSection';
import { ContactCTA } from '@/components/ContactCTA';
import { heroFont, bodyFont } from '@/app/fonts';

export const metadata: Metadata = {
  title: 'CleanBowled | Elevated Vegetarian Nutrition',
  description: 'Thoughtfully crafted vegetarian nutrition for everyday wellness, athletic performance, and mindful recovery.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'CleanBowled | Elevated Vegetarian Nutrition',
    description: 'Thoughtfully crafted vegetarian nutrition for everyday wellness, athletic performance, and mindful recovery.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1200/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-hero-main.png']
  }
};

export default function Home() {
  return (
    <main className="bg-white min-h-screen">
      <Hero />
      <section className="py-24 md:py-32 max-w-7xl mx-auto px-6">
        <CategoryLinks />
      </section>
      <section className="py-24 md:py-32 max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <h2 className={`${heroFont.className} text-4xl md:text-5xl text-[#1A1A1A]`}>Best Sellers</h2>
          <a href="/menu" className={`${bodyFont.className} uppercase tracking-widest text-sm text-[#1A1A1A] font-semibold hover:opacity-70 transition-opacity`}>View Full Menu</a>
        </div>
        <ProductGrid />
      </section>
      <section className="py-24 md:py-32 max-w-7xl mx-auto px-6">
        <ValueProps />
      </section>
      <FeatureSplit />
      <TrustSection />
      <ContactCTA />
    </main>
  );
}
