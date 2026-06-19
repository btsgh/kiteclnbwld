'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ShoppingCart, Search } from 'lucide-react';
import { bodyFont } from '@/app/fonts';
import { navLinks, brand } from '@/data/content';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-[60] transition-colors duration-300 ${isScrolled || mobileMenuOpen ? 'bg-white shadow-sm' : 'bg-white/90 backdrop-blur-sm'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex-shrink-0 relative h-8 w-40" onClick={() => setMobileMenuOpen(false)}>
            <Image src="https://static.kite.ai/image/upload/e_trim/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-logo.png" alt={brand.name} fill className="object-contain object-left" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} className={`${bodyFont.className} text-sm uppercase tracking-widest text-[#1A1A1A] font-medium hover:opacity-70 transition-opacity`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <button className="text-[#1A1A1A] hover:opacity-70 transition-opacity hidden md:block" aria-label="Search">
              <Search className="w-5 h-5 stroke-[1.5]" />
            </button>
            <button className="text-[#1A1A1A] hover:opacity-70 transition-opacity" aria-label="Cart">
              <ShoppingCart className="w-5 h-5 stroke-[1.5]" />
            </button>
            <button className="text-[#1A1A1A] hover:opacity-70 transition-opacity md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
              {mobileMenuOpen ? <X className="w-6 h-6 stroke-[1.5]" /> : <Menu className="w-6 h-6 stroke-[1.5]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
        <div className={`absolute top-0 right-0 w-4/5 max-w-sm bg-white h-full shadow-xl transition-transform duration-300 flex flex-col pt-24 px-6 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <nav className="flex flex-col gap-6">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className={`${bodyFont.className} text-lg uppercase tracking-widest text-[#1A1A1A] font-medium`}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
