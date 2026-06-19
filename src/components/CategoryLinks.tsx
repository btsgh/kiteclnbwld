import Image from 'next/image';
import { bodyFont } from '@/app/fonts';
import { categories } from '@/data/content';

export function CategoryLinks() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {categories.map(c => (
        <div key={c.name} className="flex flex-col items-center cursor-pointer group">
          <div className="w-full aspect-square max-w-[280px] rounded-full overflow-hidden mb-6 relative bg-[#EDCABF]">
            <Image 
              src={c.image} 
              alt={c.name} 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-105" 
            />
          </div>
          <span className={`${bodyFont.className} text-xs md:text-sm uppercase tracking-widest text-[#1A1A1A] font-semibold text-center max-w-[180px]`}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
