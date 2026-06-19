import Image from 'next/image';
import { bodyFont } from '@/app/fonts';
import { products } from '@/data/content';

export function ProductGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {products.map(p => (
        <div key={p.id} className="group cursor-pointer">
          <div className="w-full aspect-[3/4] bg-[#EDCABF] rounded-3xl overflow-hidden mb-6 relative">
            <Image 
              src={p.image} 
              alt={p.title} 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-105" 
            />
          </div>
          <div className="flex justify-between items-baseline mb-2">
            <h3 className={`${bodyFont.className} text-[#1A1A1A] font-semibold text-lg`}>{p.title}</h3>
            <span className={`${bodyFont.className} text-[#1A1A1A] font-medium`}>{p.price}</span>
          </div>
          <p className={`${bodyFont.className} text-sm text-[#1A1A1A]/60 uppercase tracking-widest font-medium`}>{p.category}</p>
          <p className={`${bodyFont.className} text-sm text-[#1A1A1A]/70 leading-relaxed mt-2`}>{p.description}</p>
        </div>
      ))}
    </div>
  );
}
