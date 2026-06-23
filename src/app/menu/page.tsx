import { Metadata } from 'next';
import { heroFont, bodyFont } from '@/app/fonts';
import { ProductGrid } from '@/components/ProductGrid';
import { ContactCTA } from '@/components/ContactCTA';

export const metadata: Metadata = {
  title: 'Vegetarian Bowls Menu | CleanBowled – Order Online',
  description: 'Explore CleanBowled\'s curated vegetarian menu — protein-rich, organic bowls designed for athletes, recovery, postpartum care, and everyday healthy eating in Los Angeles.',
  alternates: { canonical: '/menu' },
  openGraph: {
    url: '/menu',
    type: 'website',
    title: 'Vegetarian Bowls Menu | CleanBowled – Order Online',
    description: 'Explore CleanBowled\'s curated vegetarian menu — protein-rich, organic bowls designed for athletes, recovery, postpartum care, and everyday healthy eating in Los Angeles.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1200/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-product-bowl-1.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vegetarian Bowls Menu | CleanBowled – Order Online',
    description: 'Browse organic, plant-based bowls crafted for everyday wellness, athletic performance, injury recovery, and postpartum care.',
  },
};

export default function MenuPage() {
  return (
    <main className="bg-[#F9E0D5] min-h-screen">
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

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="mb-12">
          <h2 className={`${heroFont.className} text-3xl md:text-4xl text-[#1A1A1A] mb-4`}>Everyday Wellness</h2>
          <p className={`${bodyFont.className} text-[#1A1A1A]/70 max-w-2xl leading-relaxed`}>
            Built around wholesome, minimally processed ingredients, our Everyday Wellness bowls deliver steady energy and essential nutrients to keep you feeling your best from morning to evening.
          </p>
        </div>

        <div className="mb-12">
          <h2 className={`${heroFont.className} text-3xl md:text-4xl text-[#1A1A1A] mb-4`}>Athletic Performance</h2>
          <p className={`${bodyFont.className} text-[#1A1A1A]/70 max-w-2xl leading-relaxed`}>
            Our Protein Power bowl combines quinoa, edamame, and roasted chickpeas to deliver 28g of plant-based protein — perfect for post-workout recovery and fuelling peak athletic performance.
          </p>
        </div>

        <div className="mb-12">
          <h2 className={`${heroFont.className} text-3xl md:text-4xl text-[#1A1A1A] mb-4`}>Injury Recovery</h2>
          <p className={`${bodyFont.className} text-[#1A1A1A]/70 max-w-2xl leading-relaxed`}>
            Packed with anti-inflammatory greens, turmeric, and antioxidant-rich vegetables, our Recovery bowls are designed to reduce inflammation and support the body's natural healing process.
          </p>
        </div>

        <div className="mb-16">
          <h2 className={`${heroFont.className} text-3xl md:text-4xl text-[#1A1A1A] mb-4`}>Postpartum Care</h2>
          <p className={`${bodyFont.className} text-[#1A1A1A]/70 max-w-2xl leading-relaxed`}>
            Formulated with iron-rich legumes, calming adaptogens, and nourishing whole grains, our Postpartum Care bowls support new mothers through recovery and the demands of early parenthood.
          </p>
        </div>

        <ProductGrid />
      </section>

      <ContactCTA />
    </main>
  );
}
