import Link from 'next/link';
import Image from 'next/image';
import { bodyFont } from '@/app/fonts';
import { brand, navLinks } from '@/data/content';

export function Footer() {
  return (
    <footer className="bg-white pt-24 pb-12 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <Link href="/" className="inline-block relative h-8 w-40 mb-6">
              <Image src="https://static.kite.ai/image/upload/e_trim/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-logo.png" alt={brand.name} fill className="object-contain object-left" />
            </Link>
            <p className={`${bodyFont.className} text-[#1A1A1A]/70 max-w-sm leading-relaxed`}>
              {brand.description}
            </p>
          </div>
          
          <div>
            <h4 className={`${bodyFont.className} uppercase tracking-widest text-xs font-semibold text-[#1A1A1A] mb-6`}>Explore</h4>
            <ul className="space-y-4">
              {navLinks.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className={`${bodyFont.className} text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`${bodyFont.className} uppercase tracking-widest text-xs font-semibold text-[#1A1A1A] mb-6`}>Connect</h4>
            <ul className="space-y-4">
              <li>
                <a href={`mailto:${brand.email}`} className={`${bodyFont.className} text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors`}>
                  {brand.email}
                </a>
              </li>
              <li>
                <a href={brand.social.instagram} className={`${bodyFont.className} text-[#1A1A1A]/70 hover:text-[#1A1A1A] transition-colors`}>
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className={`${bodyFont.className} text-sm text-[#1A1A1A]/50`}>
            &copy; {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className={`${bodyFont.className} text-sm text-[#1A1A1A]/50 hover:text-[#1A1A1A]`}>Privacy Policy</Link>
            <Link href="#" className={`${bodyFont.className} text-sm text-[#1A1A1A]/50 hover:text-[#1A1A1A]`}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
