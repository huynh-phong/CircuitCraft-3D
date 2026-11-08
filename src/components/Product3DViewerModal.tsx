import React, { Suspense, useState, useEffect, useRef } from 'react';
import { lazyWithReload } from '../appRecovery';
import {
  X,
  Eye,
  Maximize2,
  Minimize2,
  RotateCw,
  Layers,
  Camera,
  Compass,
  Box,
  ShieldCheck,
  Download,
  Info,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { RouteFallback } from './ui/PageTransition';
import { ProjectDocument } from '../domain/project/types';
import { useI18n } from '../i18n/context';
import { fetchProductDesign, ProductDesignError } from '../marketplace/designService';
import { paymentService } from '../billing/paymentService';
import { projectRepositoryManager } from '../persistence/repositoryManager';
import { Portal } from './ui/Portal';

const ThreeScene = lazyWithReload(() => import('../scene/ThreeScene').then((m) => ({ default: m.ThreeScene })));

interface Product3DViewerModalProps {
  productId: string;
  productTitle: string;
  authorName?: string;
  price?: number;
  currency?: string;
  isOpen: boolean;
  fallbackProject?: ProjectDocument;
  onClose: () => void;
  onBuy?: () => void;
  onOpenInEditor?: (doc: ProjectDocument) => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
}

export const Product3DViewerModal: React.FC<Product3DViewerModalProps> = ({
  productId,
  productTitle,
  authorName = 'Nhà sáng tạo',
  price = 0,
  currency = 'VND',
  isOpen,
  fallbackProject,
  onClose,
  onBuy,
  onOpenInEditor,
  currentUser,
  onOpenAuthModal,
}) => {
  const { language, formatCurrency } = useI18n();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExploded, setIsExploded] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versionText, setVersionText] = useState('1.0.0');
  const [isLimitedPreview, setIsLimitedPreview] = useState(false);

  const handleSaveAndOpenInEditor = async () => {
    if (!currentUser && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }
    // What goes to the editor is the complete design from the server, never the public preview
    let docToOpen: ProjectDocument;
    try {
      docToOpen = fallbackProject || (await fetchProductDesign(productId));
    } catch (err) {
      if (err instanceof ProductDesignError && err.code === 'PAYMENT_REQUIRED' && onBuy) {
        onBuy();
      } else {
        setError(err instanceof Error ? err.message : 'Không thể tải bản thiết kế.');
      }
      return;
    }
    try {
      const repo = projectRepositoryManager.getActiveRepository();
      const newDoc: ProjectDocument = {
        ...docToOpen,
        projectId: `proj-${Date.now()}`,
        name: docToOpen.name.replace(/^Bản xem trước:\s*/, ''),
        authorId: currentUser?.id || docToOpen.authorId || 'guest',
        updatedAt: new Date().toISOString(),
      };
      await repo.saveProject(newDoc, { force: true });
      if (onOpenInEditor) {
        onOpenInEditor(newDoc);
      }
      onClose();
    } catch (err) {
      console.warn('Failed to save before opening editor:', err);
      if (onOpenInEditor) {
        onOpenInEditor(docToOpen);
      }
      onClose();
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const isOwned = paymentService.hasEntitlement(productId);

  // Fetch safe public preview snapshot from server or use product's full 3D template
  useEffect(() => {
    if (!isOpen || !productId) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/products/${productId}/preview`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Không thể tải bản xem trước 3D');
        }
        return res.json();
      })
      .then((data) => {
        if (data.preview && Array.isArray(data.preview.components) && data.preview.components.length > 0) {
          setVersionText(data.version || '1.0.0');
          setIsLimitedPreview(Boolean(data.preview.limitedPreview));
          // Format as ProjectDocument for ThreeScene
          const doc: ProjectDocument = {
            projectId: `preview-${productId}`,
            name: data.preview.name || productTitle,
            schemaVersion: 1,
            revision: 1,
            units: 'mm',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            board: data.preview.board ? {
              width: data.preview.board.width || 140,
              depth: data.preview.board.depth || data.preview.board.height || 90,
              thickness: data.preview.board.thickness || 1.6,
              solderMaskColor: data.preview.board.color || data.preview.board.solderMaskColor || '#0f766e',
              copperLayerCount: 2,
              gridSpacing: 2.54,
            } : {
              width: 140,
              depth: 90,
              solderMaskColor: '#0f766e',
              thickness: 1.6,
              copperLayerCount: 2,
              gridSpacing: 2.54,
            },
            components: data.preview.components || [],
            connections: data.preview.connections || [],
            wireRoutes: [],
          };
          setPreviewDoc(doc);
        } else if (fallbackProject) {
          setPreviewDoc(fallbackProject);
        } else {
          throw new Error('Dữ liệu 3D không hợp lệ');
        }
      })
      .catch(() => {
        if (fallbackProject) {
          setPreviewDoc(fallbackProject);
          return;
        }
        // Never show an invented circuit in place of the product
        setPreviewDoc(null);
        setError('Không thể tải bản xem trước 3D của sản phẩm này.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, productId, productTitle, fallbackProject]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in select-none ${
        isFullscreen ? 'p-0' : ''
      }`}
    >
      <div
        ref={modalRef}
        className={`relative w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen ? 'h-full rounded-none' : 'max-w-5xl h-[88vh] max-h-[calc(var(--app-height,100dvh)-1rem)]'
        }`}
      >
        {/* Top bar */}
        <div className="h-14 px-3 sm:px-6 gap-2 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 max-[400px]:hidden">
              <Box className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-white tracking-wide truncate min-w-0 sm:max-w-md">
                  {productTitle}
                </span>
                <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 font-mono">
                  v{versionText}
                </span>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                  {language === 'vi' ? 'Xem trước 3D' : '3D Preview'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {language === 'vi' ? 'Tác giả:' : 'Author:'}{' '}
                <span className="text-slate-200 font-medium">{authorName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsExploded(!isExploded)}
              className={`touch-target flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isExploded
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title={language === 'vi' ? 'Hiệu ứng tách tầng nổ chi tiết' : 'Exploded View'}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isExploded
                  ? language === 'vi'
                    ? 'Thu gọn'
                    : 'Collapse'
                  : language === 'vi'
                  ? 'Tách tầng (Exploded)'
                  : 'Exploded'}
              </span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="touch-target flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="touch-target flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-rose-900/80 hover:text-rose-200 text-slate-400 border border-slate-700 transition"
              title="Đóng"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D Scene Viewport (Read Only Turntable Presentation) */}
        <div className="relative flex-1 bg-slate-950 overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RotateCw className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="text-xs font-medium">
                {language === 'vi' ? 'Đang chuẩn bị mô hình 3D...' : 'Preparing 3D model...'}
              </span>
            </div>
          ) : previewDoc ? (
            <>
            {isLimitedPreview && !isOwned && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none max-w-[90%] text-center px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] text-slate-200">
                {language === 'vi'
                  ? 'Bản xem trước: chỉ hiện vị trí linh kiện. Dây nối và thông số có sau khi mua.'
                  : 'Preview: part placement only. Wiring and values are included after purchase.'}
              </div>
            )}
            <Suspense fallback={<RouteFallback />}>
            <ThreeScene
              document={previewDoc}
              selectedComponentId={null}
              selectedConnectionId={null}
              onSelectComponent={() => {}}
              onSelectConnection={() => {}}
              onMoveComponent={() => {}}
              onConnectPins={() => {}}
              onCancelWiring={() => {}}
              isWiringMode={false}
              wiringStartPin={null}
              simulationResult={null}
              switchStates={{}}
              isPresentationMode={true}
              isExplodedView={isExploded}
              qualityPreset="balanced"
              showGrid={true}
            />
            </Suspense>
            </>
          ) : null}

          {/* Interaction Guidance Banner */}
          <div className="absolute top-14 sm:top-3 left-3 right-3 sm:right-auto pointer-events-none flex flex-col items-start gap-1.5 z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-300 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                {language === 'vi'
                  ? 'Kéo để xoay góc nhìn • Cuộn hoặc chụm 2 ngón để phóng to'
                  : 'Drag to rotate • Scroll or pinch to zoom'}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/70 backdrop-blur-md border border-amber-500/30 text-amber-300 text-[10px] font-mono">
              <Info className="w-3 h-3" />
              <span>
                {language === 'vi'
                  ? 'Chế độ xem trước chỉ đọc (Bảo vệ bản quyền thiết kế)'
                  : 'Read-only preview mode (Protected IP)'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info & Conversion Action */}
        <div className="p-4 bg-slate-950/95 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[11px] text-slate-400">
                {language === 'vi' ? 'Giá sở hữu thiết kế:' : 'Design ownership:'}
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {price === 0 ? (
                  <span className="text-emerald-400">{formatCurrency(0)}</span>
                ) : (
                  <span className="text-cyan-400">{formatCurrency(price)}</span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 border-l border-slate-800 pl-4 hidden sm:block">
              <span className="block font-medium text-slate-200">
                {language === 'vi' ? 'Bao gồm quyền sở hữu trọn đời' : 'Includes lifetime access'}
              </span>
              <span className="text-slate-500">
                {language === 'vi' ? 'Mở mạch trong 3D Editor & mô phỏng' : 'Open in 3D Editor & simulation'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOwned ? (
              <button
                onClick={handleSaveAndOpenInEditor}
                className="tech-btn-3d-green flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold text-white"
              >
                <Download className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Đã sở hữu • Mở trong 3D Editor' : 'Owned • Open in Editor'}</span>
              </button>
            ) : price === 0 ? (
              <button
                onClick={handleSaveAndOpenInEditor}
                className="tech-btn-3d-green flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold text-white"
              >
                <Download className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Mở miễn phí trong 3D Editor' : 'Open free in 3D Editor'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onBuy) onBuy();
                }}
                className="tech-btn-3d flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white"
              >
                <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Thanh toán VietQR & Mở mạch' : 'Pay with VietQR & Unlock'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
