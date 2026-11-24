import React from 'react';
import { Package, Cable, Wrench, ShieldCheck, FileText, Headphones } from 'lucide-react';
import type { Product } from '../../api/types';

interface BoxItem {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  detail: string;
}

export const WhatsInTheBox: React.FC<{ product: Product }> = ({ product }) => {
  const getBoxItems = (category: string, name: string): BoxItem[] => {
    switch (category) {
      case 'keyboards':
        return [
          { icon: Package, name: name, detail: 'Factory-lubed & inspected' },
          { icon: Cable, name: 'Braided USB-C Cable', detail: '1.8m ultra-flexible paracord' },
          { icon: Wrench, name: '2-in-1 Puller Tool', detail: 'Keycap & switch puller' },
          { icon: ShieldCheck, name: '3x Extra Switches', detail: 'Matching tactile switches' },
          { icon: FileText, name: 'Manual & Layout Sheet', detail: 'QMK/VIA keymap guide' },
        ];
      case 'mice':
        return [
          { icon: Package, name: name, detail: 'Precision-calibrated sensor' },
          { icon: Cable, name: 'USB-C Charging Cable', detail: '1.5m lightweight paracord' },
          { icon: ShieldCheck, name: '2.4GHz Nano Receiver', detail: 'Sub-ms wireless latency' },
          { icon: Wrench, name: 'Spare PTFE Glide Feet', detail: 'Zero-friction replacement' },
          { icon: FileText, name: 'Quickstart Guide', detail: 'Linux & macOS setup' },
        ];
      case 'audio':
        return [
          { icon: Headphones, name: name, detail: 'Acoustically tuned drivers' },
          { icon: Cable, name: 'Shielded Audio Cable', detail: 'Oxygen-free copper core' },
          {
            icon: Package,
            name: 'Protective Travel Pouch',
            detail: 'Reinforced travel protection',
          },
          { icon: ShieldCheck, name: 'Gold-Plated 6.35mm Adapter', detail: 'Studio console ready' },
          {
            icon: FileText,
            name: 'Frequency Chart & Manual',
            detail: 'Calibration curve certificate',
          },
        ];
      default:
        return [
          { icon: Package, name: name, detail: 'Production-grade hardware' },
          { icon: Cable, name: 'Host Connection Cable', detail: 'High-bandwidth braided cable' },
          { icon: Wrench, name: 'Mounting Brackets & Screws', detail: 'Precision hardware kit' },
          { icon: ShieldCheck, name: '2-Year Warranty Card', detail: 'Zero-downtime SLA coverage' },
          {
            icon: FileText,
            name: 'Engineering Documentation',
            detail: 'Hardware specification sheet',
          },
        ];
    }
  };

  const items = getBoxItems(product.category, product.name);

  return (
    <section
      aria-labelledby="whats-in-the-box-heading"
      className="border-t border-border pt-8 mt-8 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-primary" />
        <h2 id="whats-in-the-box-heading" className="text-lg font-bold text-text">
          What’s in the Box
        </h2>
      </div>

      <p className="text-xs text-text-muted">
        Everything required for out-of-the-box production deployment.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-surface border border-border rounded-md p-3.5 flex flex-col items-center text-center space-y-2 hover:border-primary/40 transition-colors shadow-2xs"
            >
              <div className="w-9 h-9 rounded-full bg-surface-muted flex items-center justify-center text-primary">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-text truncate">{item.name}</h3>
                <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
