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
  title: 'CleanBowled | Elevated Vegetarian Nutrition Delivered',
  description: 'CleanBowled delivers thoughtfully crafted vegetarian bowls for everyday wellness, athletic recovery, and postpartum care — fresh, organic, and delivered to your door in Los Angeles.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    type: 'website',
    title: 'CleanBowled | Elevated Vegetarian Nutrition Delivered',
    description: 'CleanBowled delivers thoughtfully crafted vegetarian bowls for everyday wellness, athletic recovery, and postpartum care — fresh, organic, and delivered to your door in Los Angeles.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1200/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-hero-main.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CleanBowled | Elevated Vegetarian Nutrition Delivered',
    description: 'Plant-based bowls for wellness, athletic performance, and mindful recovery. Fresh, organic, delivered to Los Angeles.',
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'CleanBowled',
  description: 'Organic, plant-based bowls for everyday wellness, athletic recovery, and postpartum care — delivered fresh in Los Angeles.',
  url: 'https://cleanbowled.vercel.app',
  email: 'hello@cleanbowled.com',
  servesCuisine: 'Vegetarian',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1200 Wellness Avenue, Suite 100',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    postalCode: '90015',
    addressCountry: 'US',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday'],
      opens: '09:00',
      closes: '15:00',
    },
  ],
};

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CleanBowled',
  url: 'https://cleanbowled.vercel.app',
  description: 'Organic, plant-based bowls for everyday wellness, athletic recovery, and postpartum care — delivered fresh in Los Angeles.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://cleanbowled.vercel.app/menu?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function Home() {
  return (
    <main className="bg-[#F9E0D5] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <Hero />
      <section className="py-16 md:py-20 max-w-7xl mx-auto px-6">
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
