import React from 'react';
import { ShoppingBag, Star, Download, Box, ArrowRight, UserCheck } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { CATALOG_PRODUCTS } from '../../marketplace/catalogData';
import { fetchProductDesign } from '../../marketplace/designService';

export interface MarketplaceShowcaseSectionProps {
  onExploreMarketplace?: () => void;
  onOpenProject?: (doc: any) => void;
}

export const MarketplaceShowcaseSection: React.FC<MarketplaceShowcaseSectionProps> = ({
  onExploreMarketplace,
  onOpenProject,
}) => {
  const { language } = useI18n();

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <ShoppingBag className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Chợ dự án & Cộng đồng' : 'Community & Marketplace'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Khám phá ý tưởng. ' : 'Explore Ideas. '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'Chia sẻ sáng tạo của bạn.' : 'Share What You Build.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Khám phá hàng chục mạch điện mẫu được thiết kế chuẩn xác từ cộng đồng kỹ sư. Tải về và mở trực tiếp trong phòng thực hành 3D chỉ với 1 click.'
            : 'Explore community-tested 3D circuit schematics. Clone and launch directly into your 3D workspace with a single click.'}
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {CATALOG_PRODUCTS.slice(0, 3).map((prod) => (
          <div
            key={prod.id}
            className="group rounded-[28px] overflow-hidden bg-white/95 dark:bg-[#071628]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-xl shadow-cyan-500/5 hover:shadow-2xl hover:shadow-cyan-500/15 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div className="p-6 space-y-4">
              {/* Category & Rating */}
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold border border-cyan-200 dark:border-cyan-800 uppercase tracking-wider">
                  {prod.category}
                </span>

                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{prod.rating}</span>
                  <span className="text-slate-400 font-normal">({prod.reviewsCount})</span>
                </div>
              </div>

              {/* Title & Tagline */}
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {prod.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {prod.tagline}
                </p>
              </div>

              {/* Component summary pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {prod.componentsSummary.slice(0, 3).map((comp, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium"
                  >
                    {comp}
                  </span>
                ))}
              </div>

              {/* Author Info */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="font-semibold">{prod.author.name}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                  <Download className="w-3 h-3" />
                  <span>{prod.downloadsCount} lượt tải</span>
                </div>
              </div>
            </div>

            {/* Footer with Price & Open CTA */}
            <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">
                  {prod.isFree ? (language === 'vi' ? 'Bản quyền' : 'License') : (language === 'vi' ? 'Giá bán' : 'Price')}
                </span>
                <span className="text-base font-black font-mono text-cyan-600 dark:text-cyan-400">
                  {prod.isFree
                    ? language === 'vi' ? 'Miễn phí' : 'Free'
                    : `${prod.price.toLocaleString('vi-VN')} ₫`}
                </span>
              </div>

              <button
                onClick={async () => {
                  // Paid designs are only delivered after purchase: those go to the Marketplace
                  if (onOpenProject && prod.isFree) {
                    try {
                      onOpenProject(await fetchProductDesign(prod.id));
                      return;
                    } catch (err) {
                      console.warn('Could not load design:', err);
                    }
                  }
                  onExploreMarketplace?.();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer"
              >
                <Box className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Mở trong 3D' : 'Open in 3D'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Explore Marketplace CTA Button */}
      <div className="text-center pt-10">
        <button
          onClick={onExploreMarketplace}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white dark:bg-[#0c1e33] hover:bg-cyan-50 dark:hover:bg-[#0f2640] border border-[#bfe3f7] dark:border-cyan-700/60 text-slate-900 dark:text-white font-extrabold text-sm shadow-md transition cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4 text-cyan-500" />
          <span>{language === 'vi' ? 'Khám phá toàn bộ Cửa hàng & Dự án mẫu' : 'Explore All Community Projects in Marketplace'}</span>
          <ArrowRight className="w-4 h-4 text-cyan-500" />
        </button>
      </div>
    </section>
  );
};
