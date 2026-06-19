import { Leaf, Truck, Store } from 'lucide-react';
import { bodyFont } from '@/app/fonts';
import { valueProps } from '@/data/content';

const iconMap = {
  Leaf,
  Truck,
  Store
};

export function ValueProps() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {valueProps.map(v => {
        const Icon = iconMap[v.icon as keyof typeof iconMap];
        return (
          <div key={v.title} className="p-10 border border-gray-200 rounded-3xl bg-transparent flex flex-col items-start">
            <Icon className="w-8 h-8 text-[#1A1A1A] mb-8 stroke-[1.5]" />
            <h3 className={`${bodyFont.className} text-xl font-semibold text-[#1A1A1A] mb-4`}>{v.title}</h3>
            <p className={`${bodyFont.className} text-[#1A1A1A]/70 leading-relaxed`}>{v.description}</p>
          </div>
        );
      })}
    </div>
  );
}
