import Image from 'next/image';
import { bodyFont } from '@/app/fonts';
import { categories } from '@/data/content';

export function CategoryLinks() {
  return (
    <div className="flex flex-nowrap overflow-x-auto md:flex-wrap justify-start md:justify-center gap-8 md:gap-16 pb-8 md:pb-0 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {categories.map(c => (
        <div key={c.name} className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden mb-6 relative bg-[#F9F7F2]">
            <Image 
              src={c.image} 
              alt={c.name} 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-105" 
            />
          </div>
          <span className={`${bodyFont.className} text-xs md:text-sm uppercase tracking-widest text-[#1A1A1A] font-semibold text-center max-w-[120px] md:max-w-[140px]`}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
