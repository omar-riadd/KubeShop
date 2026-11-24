import React from 'react';
import { Check } from 'lucide-react';
import type { Product } from '../../api/types';
import { Dialog } from '../ui/Dialog';
import { Money } from '../ui/Money';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';

interface SpecComparisonModalProps {
  open: boolean;
  onClose: () => void;
  currentProduct: Product;
  allProducts: Product[];
}

interface SpecRow {
  label: string;
  getter: (product: Product) => string | React.ReactNode;
}

export const SpecComparisonModal: React.FC<SpecComparisonModalProps> = ({
  open,
  onClose,
  currentProduct,
  allProducts,
}) => {
  // Filter products in the same category (limit to 3 for side-by-side view)
  const categoryProducts = allProducts.filter((p) => p.category === currentProduct.category);
  const productsToCompare = [
    currentProduct,
    ...categoryProducts.filter((p) => p.id !== currentProduct.id),
  ].slice(0, 3);

  const getSpecsForCategory = (category: string): SpecRow[] => {
    switch (category) {
      case 'keyboards':
        return [
          {
            label: 'Form Factor',
            getter: (p) =>
              p.id === 'kb-001'
                ? '75% Compact'
                : p.id === 'kb-002'
                  ? '60% Ultra-Compact'
                  : 'TKL Low-Profile',
          },
          {
            label: 'Connectivity',
            getter: (p) =>
              p.id === 'kb-002' ? 'Tri-Mode (2.4G / BT 5.2 / USB-C)' : 'Detachable USB-C (Braided)',
          },
          {
            label: 'Mounting Style',
            getter: (p) =>
              p.id === 'kb-001'
                ? 'Gasket Mount (Silicone)'
                : p.id === 'kb-002'
                  ? 'Tray Mount (Damped)'
                  : 'Integrated Aluminum Top Plate',
          },
          {
            label: 'Polling Rate',
            getter: () => '1,000 Hz (1ms latency)',
          },
          {
            label: 'Firmware Support',
            getter: () => 'QMK / VIA / Linux Native',
          },
          {
            label: 'Keycap Material',
            getter: () => 'Double-shot PBT (No shine)',
          },
          {
            label: 'Hot-Swappable',
            getter: () => (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5" /> 5-Pin &amp; 3-Pin
              </span>
            ),
          },
        ];
      case 'mice':
        return [
          {
            label: 'Form Factor',
            getter: (p) =>
              p.id === 'ms-001'
                ? 'Sculpted Ergonomic'
                : p.id === 'ms-002'
                  ? '57° Natural Vertical'
                  : 'Ultralight Compact Travel',
          },
          {
            label: 'Sensor',
            getter: (p) =>
              p.id === 'ms-001'
                ? 'PAW3395 (26,000 DPI)'
                : p.id === 'ms-002'
                  ? 'ErgoTrack Precision (4,000 DPI)'
                  : 'Optical Mobile (3,200 DPI)',
          },
          {
            label: 'Connectivity',
            getter: () => '2.4 GHz + Bluetooth 5.3',
          },
          {
            label: 'Battery Life',
            getter: (p) =>
              p.id === 'ms-001'
                ? 'Up to 90 hours'
                : p.id === 'ms-002'
                  ? 'Up to 120 hours'
                  : 'Up to 60 hours',
          },
          {
            label: 'Switch Lifespan',
            getter: () => '80 Million Clicks (Silent)',
          },
        ];
      case 'audio':
        return [
          {
            label: 'Acoustic Principle',
            getter: (p) =>
              p.id === 'au-001'
                ? 'Closed-Back Dynamic (45mm)'
                : p.id === 'au-002'
                  ? 'Hybrid ANC In-Ear (11mm)'
                  : 'Cardioid 24-bit/96kHz Condenser',
          },
          {
            label: 'Frequency Range',
            getter: (p) =>
              p.id === 'au-001'
                ? '15 Hz – 28,000 Hz'
                : p.id === 'au-002'
                  ? '20 Hz – 20,000 Hz'
                  : '20 Hz – 20,000 Hz',
          },
          {
            label: 'Latency Profile',
            getter: () => 'Sub-5ms Zero-Latency Monitoring',
          },
          {
            label: 'Noise Isolation',
            getter: (p) =>
              p.id === 'au-002' ? 'Hybrid ANC (-42dB)' : 'Passive Studio Acoustic Seal',
          },
        ];
      default:
        return [
          {
            label: 'Form Factor',
            getter: (p) => (p.id === 'ac-002' ? '8-in-1 Aluminum Enclosure' : 'Desk Ergonomic'),
          },
          {
            label: 'Power Delivery',
            getter: (p) => (p.id === 'ac-002' ? '100W Pass-Through PD' : 'Standard 5V/2A USB'),
          },
          {
            label: 'Materials',
            getter: () => 'Anodized Aircraft Aluminum & Felt',
          },
          {
            label: 'Warranty',
            getter: () => '2-Year Full Hardware Replacement',
          },
        ];
    }
  };

  const specRows = getSpecsForCategory(currentProduct.category);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Compare ${currentProduct.category.toUpperCase()} Specifications`}
      description="Apple Store style side-by-side technical evaluation across hardware revisions."
    >
      <div className="overflow-x-auto -mx-6 px-6 py-2 max-h-[70vh]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 pr-4 font-semibold text-text-muted w-1/4">Specification</th>
              {productsToCompare.map((prod) => (
                <th key={prod.id} className="py-3 px-3 text-center align-top min-w-36">
                  <div className="flex flex-col items-center space-y-1.5">
                    <div className="w-16 h-16 rounded-md bg-surface-muted p-1 border border-border flex items-center justify-center">
                      <img src={prod.imageUrl} alt="" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-bold text-text text-xs leading-tight line-clamp-2">
                      {prod.name}
                    </span>
                    <Money
                      cents={prod.priceCents}
                      currency={prod.currency}
                      className="font-bold text-primary font-mono"
                    />
                    {prod.id === currentProduct.id ? (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Viewing Now
                      </span>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="text-[11px] h-7 px-2">
                        <Link to={`/products/${prod.id}`} onClick={onClose}>
                          View Product
                        </Link>
                      </Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {specRows.map((row, i) => (
              <tr key={i} className="hover:bg-surface-muted/30">
                <td className="py-3 pr-4 font-semibold text-text-muted">{row.label}</td>
                {productsToCompare.map((prod) => (
                  <td key={prod.id} className="py-3 px-3 text-center text-text leading-tight">
                    {row.getter(prod)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 pt-3 border-t border-border flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          Close Comparison
        </Button>
      </div>
    </Dialog>
  );
};
