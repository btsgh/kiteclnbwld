'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { bodyFont } from '@/app/fonts';
import { navLinks, brand } from '@/data/content';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Main navbar — solid dark bar for strong contrast against blush-peach pages */}
      <header className="fixed top-0 left-0 right-0 z-[60] bg-[#1A1A1A] shadow-md">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between" style={{ height: '72px' }}>
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 relative h-9 w-44" onClick={() => setMobileMenuOpen(false)}>
            <Image
              src="https://static.kite.ai/image/upload/e_trim/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-logo.png"
              alt={brand.name}
              fill
              className="object-contain object-left brightness-0 invert"
              priority
            />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className={`${bodyFont.className} text-sm uppercase tracking-widest text-white/90 font-medium hover:text-white transition-colors`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-4">
            <Link
              href="/menu"
              className={`${bodyFont.className} hidden md:inline-flex items-center rounded-full border border-white/30 text-white text-xs uppercase tracking-widest px-5 py-2 hover:bg-white hover:text-[#1A1A1A] transition-colors`}
            >
              Order Now
            </Link>
            <button
              className="text-white md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen
                ? <X className="w-6 h-6 stroke-[1.5]" />
                : <Menu className="w-6 h-6 stroke-[1.5]" />
              }
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-4/5 max-w-sm bg-[#1A1A1A] shadow-2xl transition-transform duration-300 flex flex-col pt-24 px-8 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Close button inside drawer */}
        <button
          className="absolute top-5 right-6 text-white"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-6 h-6 stroke-[1.5]" />
        </button>

        <nav className="flex flex-col gap-7">
          {navLinks.map(link => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`${bodyFont.className} text-xl uppercase tracking-widest text-white font-medium hover:text-white/70 transition-colors`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pb-10">
          <Link
            href="/menu"
            onClick={() => setMobileMenuOpen(false)}
            className={`${bodyFont.className} block text-center rounded-full bg-white text-[#1A1A1A] text-sm uppercase tracking-widest px-6 py-3 hover:bg-white/90 transition-colors`}
          >
            Order Now
          </Link>
        </div>
      </div>

      {/* Spacer so page content clears the fixed navbar height */}
      <div className="h-[72px]" />
    </>
  );
}
