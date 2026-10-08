import React, { useState, useEffect } from 'react';
import { CATALOG_PRODUCTS } from '../marketplace/catalogData';
import { CatalogProduct } from '../marketplace/types';
import { paymentService } from '../billing/paymentService';
import { projectRepositoryManager } from '../persistence/repositoryManager';
import { ProjectDocument } from '../domain/project/types';
import { Search, ShoppingBag, Star, CheckCircle, ArrowRight, ShieldCheck, Download, X, Box, Eye, Sparkles } from 'lucide-react';
import { PaymentModal, PaymentOrderDetails } from '../components/PaymentModal';
import { Product3DViewerModal } from '../components/Product3DViewerModal';
import { useI18n } from '../i18n/context';

export interface MarketplacePageProps {
  onOpenProject: (doc: ProjectDocument) => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
  onNavigate?: (route: any) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onOpenProject,
  currentUser,
  onOpenAuthModal,
  onNavigate,
}) => {
  const { t, language, formatCurrency } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [viewerProduct, setViewerProduct] = useState<CatalogProduct | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<PaymentOrderDetails | null>(null);
  const [, setRefreshState] = useState(0);
  const [dynamicProducts, setDynamicProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    const unsub = paymentService.subscribe(() => setRefreshState((v) => v + 1));
    return () => unsub();
  }, [currentUser]);

  // Load published creator products from backend
  useEffect(() => {
    fetch('/api/products/catalog')
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => {
        if (data.products && Array.isArray(data.products)) {
          const mapped: CatalogProduct[] = data.products.map((p: any) => ({
            id: p.id,
            name: p.title,
            tagline: p.tagline,
            description: p.description,
            price: p.price,
            isFree: p.price === 0,
            version: p.currentVersionNumber || '1.0.0',
            author: {
              name: p.creatorName,
              role: 'Kỹ sư Sáng tạo CircuitCraft',
              verified: true,
            },
            rating: p.rating || 5.0,
            reviewsCount: p.salesCount || 1,
            componentsSummary: p.componentsSummary || ['Mạch ứng dụng 3D'],
            prerequisites: p.prerequisites || [],
            learningOutcomes: p.deliverables || ['Kỹ năng thiết kế mạch'],
            projectTemplate: () => ({
              projectId: `creator-${p.id}`,
              name: p.title,
              schemaVersion: 1,
              revision: 1,
              units: 'mm',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              board: p.previewSnapshot?.board ? {
                width: p.previewSnapshot.board.width || 140,
                depth: p.previewSnapshot.board.depth || p.previewSnapshot.board.height || 100,
                solderMaskColor: p.previewSnapshot.board.color || p.previewSnapshot.board.solderMaskColor || '#0f766e',
                thickness: 1.6,
                copperLayerCount: 2,
                gridSpacing: 2.54,
              } : {
                width: 140,
                depth: 100,
                solderMaskColor: '#0f766e',
                thickness: 1.6,
                copperLayerCount: 2,
                gridSpacing: 2.54,
              },
              wireRoutes: [],
              components: Array.isArray(p.previewSnapshot?.components) && p.previewSnapshot.components.length > 0
                ? p.previewSnapshot.components
                : [
                    { instanceId: 'cmp-1', definitionId: 'dc-source', name: 'Nguồn DC 5V', position: { x: -30, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5.0 } },
                    { instanceId: 'cmp-2', definitionId: 'resistor', name: 'Điện trở 220Ω', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 220 } },
                    { instanceId: 'cmp-3', definitionId: 'led', name: 'LED Xanh', position: { x: 30, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { color: 'green' } },
                  ],
              connections: Array.isArray(p.previewSnapshot?.connections) && p.previewSnapshot.connections.length > 0
                ? p.previewSnapshot.connections
                : [
                    { id: 'c1', fromComponentId: 'cmp-1', fromPinId: 'vcc', toComponentId: 'cmp-2', toPinId: 'pin1', wireColor: '#ef4444' },
                    { id: 'c2', fromComponentId: 'cmp-2', fromPinId: 'pin2', toComponentId: 'cmp-3', toPinId: 'anode', wireColor: '#ef4444' },
                    { id: 'c3', fromComponentId: 'cmp-1', fromPinId: 'gnd', toComponentId: 'cmp-3', toPinId: 'cathode', wireColor: '#10b981' },
                  ],
            }),
            tags: p.tags || ['Creator', '3D'],
          }));

          // Avoid duplicates with static CATALOG_PRODUCTS
          const staticIds = new Set(CATALOG_PRODUCTS.map((c) => c.id));
          const uniqueNew = mapped.filter((m) => !staticIds.has(m.id));
          setDynamicProducts(uniqueNew);
        }
      })
      .catch((err) => console.warn('Note loading catalog products:', err));
  }, []);

  const allProducts = [...CATALOG_PRODUCTS, ...dynamicProducts];

  const filtered = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAcquireProduct = async (product: CatalogProduct) => {
    if (!currentUser && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }

    if (product.isFree || paymentService.hasEntitlement(product.id)) {
      // Free or owned -> save into repository and open directly
      const doc = product.projectTemplate();
      doc.projectId = `proj-${Date.now()}`;
      doc.authorId = currentUser?.id || 'guest';
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc, { force: true });
      onOpenProject(doc);
      return;
    }

    // Paid -> Create secure backend order and open VietQR Payment Dialog immediately
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productTitle: product.name,
          amount: product.price,
          authorName: product.author?.name || 'Huỳnh Phong',
          userId: currentUser?.id || 'guest',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          setActivePaymentOrder(data.order);
          return;
        }
      }

      // Fallback authoritative VietQR order if backend is slow/offline
      const bankName = 'MB Bank';
      const bankId = '970422';
      const accountNumber = '0988888888';
      const accountName = 'Huỳnh Phong';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanCode = product.id.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
      const orderCode = `CC3D_${cleanCode}_${randomSuffix}`;
      const transferContent = `CC3D ${orderCode}`;
      const qrUrl = `https://api.vietqr.io/image/${bankId}-${accountNumber}-compact.jpg?accountName=${encodeURIComponent(
        accountName
      )}&amount=${product.price}&addInfo=${encodeURIComponent(transferContent)}`;

      const fallbackOrder: PaymentOrderDetails = {
        orderId: `ord-${Date.now()}-${randomSuffix}`,
        orderCode,
        productId: product.id,
        productTitle: product.name,
        amount: product.price,
        currency: 'VND',
        bankDetails: {
          bankName,
          accountNumber,
          accountNumberMasked: '098****888',
          accountName,
          orderCode,
          transferContent,
          qrUrl,
        },
      };

      setActivePaymentOrder(fallbackOrder);
    } catch (err: any) {
      console.warn('Backend order creation note, launching client VietQR order:', err);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanCode = product.id.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
      const orderCode = `CC3D_${cleanCode}_${randomSuffix}`;
      const transferContent = `CC3D ${orderCode}`;
      const qrUrl = `https://api.vietqr.io/image/970422-0988888888-compact.jpg?accountName=Hu%E1%BB%B3nh%20Phong&amount=${product.price}&addInfo=${encodeURIComponent(
        transferContent
      )}`;

      setActivePaymentOrder({
        orderId: `ord-${Date.now()}-${randomSuffix}`,
        orderCode,
        productId: product.id,
        productTitle: product.name,
        amount: product.price,
        currency: 'VND',
        bankDetails: {
          bankName: 'MB Bank',
          accountNumber: '0988888888',
          accountNumberMasked: '098****888',
          accountName: 'Huỳnh Phong',
          orderCode,
          transferContent,
          qrUrl,
        },
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = async (order: PaymentOrderDetails) => {
    paymentService.grantEntitlement(order.productId);
    const prod = allProducts.find((p) => p.id === order.productId);
    if (!prod) {
      setActivePaymentOrder(null);
      return;
    }

    const doc = prod.projectTemplate();
    doc.projectId = `proj-${Date.now()}`;
    if (currentUser?.id) {
      doc.authorId = currentUser.id;
    }
    const repo = projectRepositoryManager.getActiveRepository();
    await repo.saveProject(doc, { force: true });

    setSelectedProduct(null);
    setActivePaymentOrder(null);
    onOpenProject(doc);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Panel */}
        <div className="tech-panel p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-200/90 dark:border-cyan-500/40 text-[11px] font-semibold mb-2 shadow-xs">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Chợ mạch phần cứng & Mẫu thiết kế mở' : 'Hardware Circuits & Open Templates'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('nav.marketplace')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
              {language === 'vi'
                ? 'Khám phá các mẫu mạch chất lượng cao được thiết kế sẵn bởi cộng đồng và kỹ sư.'
                : 'Explore high-quality circuit templates designed by the community and engineers.'}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm theo tên mạch, linh kiện...' : 'Search circuits, components...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="tech-input w-full pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prod) => {
            const isOwned = paymentService.hasEntitlement(prod.id);

            return (
              <div
                key={prod.id}
                className="tech-card flex flex-col justify-between overflow-hidden group transition-all"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        prod.isFree
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30'
                      }`}
                    >
                      {prod.isFree ? (language === 'vi' ? 'Miễn phí' : 'Free') : (language === 'vi' ? 'Thương mại' : 'Commercial')}
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{prod.rating.toFixed(1)}</span>
                      <span className="text-slate-400 font-normal">({prod.reviewsCount})</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition line-clamp-1">
                      {prod.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">{prod.tagline}</p>
                  </div>

                  {/* Components summary */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                      {language === 'vi' ? 'Linh kiện chính:' : 'Key components:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {prod.componentsSummary.map((c, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-md bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200/60 dark:border-slate-700/60 font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/60 space-y-2.5">
                  {/* Row 1: Price on left, Secondary actions (Xem 3D, Chi tiết) on right */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white shrink-0">
                      {prod.isFree ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatCurrency(0)}</span>
                      ) : (
                        <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">{formatCurrency(prod.price)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setViewerProduct(prod)}
                        className="tech-btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-[#cbe6f7] dark:border-cyan-800/60 shadow-xs cursor-pointer"
                        title={language === 'vi' ? 'Xem trước mô hình 3D xoay turntable' : '3D Turntable Preview'}
                      >
                        <Box className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>{language === 'vi' ? 'Xem 3D' : 'Xem 3D'}</span>
                      </button>

                      <button
                        onClick={() => setSelectedProduct(prod)}
                        className="tech-btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-[#cbe6f7] dark:border-cyan-800/60 shadow-xs cursor-pointer"
                      >
                        <span>{language === 'vi' ? 'Chi tiết' : 'Chi tiết'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Primary Action 3D Button matching Login button style */}
                  <div>
                    {isOwned ? (
                      <button
                        onClick={() => handleAcquireProduct(prod)}
                        className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                      >
                        <Download className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                        <span className="tracking-wide">{language === 'vi' ? 'Đã sở hữu • Mở mạch' : 'Owned • Open'}</span>
                      </button>
                    ) : prod.isFree ? (
                      <button
                        onClick={() => handleAcquireProduct(prod)}
                        className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                      >
                        <Download className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                        <span className="tracking-wide">{language === 'vi' ? 'Mở mạch trong 3D Editor' : 'Open in 3D Editor'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAcquireProduct(prod)}
                        className="w-full tech-btn-3d flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                        <span className="tracking-wide">{language === 'vi' ? 'Mua ngay qua VietQR' : 'Buy with VietQR'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-cyan-50 to-slate-100 dark:from-cyan-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                  {language === 'vi' ? `Mẫu thiết kế phần cứng v${selectedProduct.version}` : `Hardware Design Template v${selectedProduct.version}`}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{selectedProduct.name}</h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{selectedProduct.description}</p>

              {/* 3D Preview Quick Action */}
              <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {language === 'vi' ? 'Xem trước mạch 3D tương tác' : 'Interactive 3D Preview'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Xoay 360 độ, zoom và nổ tầng linh kiện (Exploded)' : 'Turntable orbit, zoom, and exploded layers'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewerProduct(selectedProduct)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? 'Xem mạch 3D' : 'Open 3D'}</span>
                </button>
              </div>

              {/* Author badge */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-600/20 dark:bg-cyan-600/30 text-cyan-700 dark:text-cyan-400 font-bold flex items-center justify-center">
                  HN
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {selectedProduct.author.name}
                    {selectedProduct.author.verified && (
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-500" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{selectedProduct.author.role}</div>
                </div>
              </div>

              {/* Outcomes */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {language === 'vi' ? 'Kiến thức đạt được khi thực hành:' : 'Learning Outcomes:'}
                </span>
                <ul className="space-y-1.5">
                  {selectedProduct.learningOutcomes.map((out, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{out}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Giá sở hữu vĩnh viễn:' : 'Lifetime ownership:'}
                </span>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {selectedProduct.isFree ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(0)}</span>
                  ) : (
                    <span>{formatCurrency(selectedProduct.price)}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleAcquireProduct(selectedProduct)}
                disabled={isProcessingPayment}
                className={
                  selectedProduct.isFree || paymentService.hasEntitlement(selectedProduct.id)
                    ? 'tech-btn-3d-green flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white disabled:opacity-50'
                    : 'tech-btn-3d flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white disabled:opacity-50'
                }
              >
                {isProcessingPayment ? (
                  <span>{language === 'vi' ? 'Đang tạo giao dịch VietQR...' : 'Creating VietQR transaction...'}</span>
                ) : paymentService.hasEntitlement(selectedProduct.id) ? (
                  <>
                    <Download className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                    <span className="tracking-wide">{language === 'vi' ? 'Đã sở hữu • Mở mạch' : 'Owned • Open'}</span>
                  </>
                ) : selectedProduct.isFree ? (
                  <>
                    <Download className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                    <span className="tracking-wide">{language === 'vi' ? 'Mở mạch trong 3D Editor' : 'Open in 3D Editor'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                    <span className="tracking-wide">{language === 'vi' ? 'Thanh toán VietQR & Mở mạch' : 'Pay VietQR & Open'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official VietQR Payment Modal */}
      <PaymentModal
        order={activePaymentOrder}
        isOpen={Boolean(activePaymentOrder)}
        onClose={() => setActivePaymentOrder(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Interactive 3D Product Viewer Modal */}
      {viewerProduct && (
        <Product3DViewerModal
          productId={viewerProduct.id}
          productTitle={viewerProduct.name}
          authorName={viewerProduct.author.name}
          price={viewerProduct.price}
          isOpen={Boolean(viewerProduct)}
          fallbackProject={viewerProduct.projectTemplate()}
          currentUser={currentUser}
          onOpenAuthModal={onOpenAuthModal}
          onClose={() => setViewerProduct(null)}
          onBuy={() => {
            const p = viewerProduct;
            setViewerProduct(null);
            handleAcquireProduct(p);
          }}
          onOpenInEditor={async (doc) => {
            const repo = projectRepositoryManager.getActiveRepository();
            const saveDoc: ProjectDocument = {
              ...doc,
              projectId: doc.projectId.startsWith('proj-') ? doc.projectId : `proj-${Date.now()}`,
              name: doc.name.replace(/^Bản xem trước:\s*/, ''),
              authorId: currentUser?.id || doc.authorId,
              updatedAt: new Date().toISOString(),
            };
            await repo.saveProject(saveDoc, { force: true });
            setViewerProduct(null);
            onOpenProject(saveDoc);
          }}
          onSaveToMyProjects={async (doc) => {
            const repo = projectRepositoryManager.getActiveRepository();
            const saveDoc: ProjectDocument = {
              ...doc,
              projectId: doc.projectId.startsWith('proj-') ? doc.projectId : `proj-${Date.now()}`,
              authorId: currentUser?.id || doc.authorId,
              updatedAt: new Date().toISOString(),
            };
            await repo.saveProject(saveDoc, { force: true });
          }}
        />
      )}
    </div>
  );
};
