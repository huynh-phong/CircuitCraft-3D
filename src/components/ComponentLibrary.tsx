import React, { useState } from 'react';
import { COMPONENT_DEFINITIONS } from '../domain/components/definitions';
import { ComponentDefinition } from '../domain/project/types';
import { Search, Plus, Zap, Cpu, Sliders, ToggleLeft, Layers, Volume2, Thermometer, Binary, PanelLeftClose } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ComponentLibraryProps {
  onAddComponent: (def: ComponentDefinition) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  onAddComponent,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Vietnamese filter categories as explicitly requested
  const filters = [
    { id: 'all', label: language === 'vi' ? 'Tất cả' : 'All' },
    { id: 'breadboard', label: language === 'vi' ? 'Breadboard' : 'Breadboard' },
    { id: 'mcu', label: language === 'vi' ? 'Arduino / MCU' : 'Arduino / MCU' },
    { id: 'led', label: language === 'vi' ? 'Đèn' : 'LED / Light' },
    { id: 'button', label: language === 'vi' ? 'Nút & Công tắc' : 'Buttons & Switches' },
    { id: 'power', label: language === 'vi' ? 'Nguồn' : 'Power' },
    { id: 'resistor', label: language === 'vi' ? 'Điện trở' : 'Resistors' },
    { id: 'sensor', label: language === 'vi' ? 'Cảm biến' : 'Sensors' },
    { id: 'motor', label: language === 'vi' ? 'Động cơ & Còi' : 'Motors & Actuators' },
    { id: 'ic', label: language === 'vi' ? 'IC & Bán dẫn' : 'ICs & Semiconductors' },
    { id: 'connector', label: language === 'vi' ? 'Đầu nối' : 'Connectors' },
  ];

  const filteredComponents = COMPONENT_DEFINITIONS.filter((def) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      def.name.toLowerCase().includes(q) ||
      def.description.toLowerCase().includes(q) ||
      def.category.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (selectedFilter === 'all') return true;

    if (selectedFilter === 'breadboard') {
      return (
        def.definitionId.includes('breadboard') ||
        def.name.toLowerCase().includes('breadboard') ||
        def.name.toLowerCase().includes('bo test')
      );
    }
    if (selectedFilter === 'mcu') {
      return (
        def.category === 'microcontrollers' ||
        def.definitionId.includes('arduino') ||
        def.name.toLowerCase().includes('arduino') ||
        def.name.toLowerCase().includes('vi điều khiển')
      );
    }
    if (selectedFilter === 'led') {
      return (
        def.definitionId.includes('led') ||
        def.category === 'opto' ||
        def.name.toLowerCase().includes('led') ||
        def.name.toLowerCase().includes('đèn')
      );
    }
    if (selectedFilter === 'button') {
      return (
        def.category === 'switches' ||
        def.definitionId.includes('switch') ||
        def.definitionId.includes('pushbutton') ||
        def.definitionId.includes('relay') ||
        def.name.toLowerCase().includes('nút') ||
        def.name.toLowerCase().includes('công tắc')
      );
    }
    if (selectedFilter === 'power') {
      return (
        def.category === 'power' ||
        def.definitionId.includes('dc-source') ||
        def.definitionId.includes('7805') ||
        def.name.toLowerCase().includes('nguồn') ||
        def.name.toLowerCase().includes('pin')
      );
    }
    if (selectedFilter === 'resistor') {
      return (
        def.definitionId.includes('resistor') ||
        def.definitionId.includes('potentiometer') ||
        def.definitionId.includes('capacitor') ||
        def.category === 'passives'
      );
    }
    if (selectedFilter === 'sensor') {
      return (
        def.category === 'sensors' ||
        def.definitionId.includes('sensor') ||
        def.definitionId.includes('ldr') ||
        def.definitionId.includes('sr04') ||
        def.name.toLowerCase().includes('cảm biến') ||
        def.name.toLowerCase().includes('quang trở')
      );
    }
    if (selectedFilter === 'motor') {
      return (
        def.definitionId.includes('motor') ||
        def.definitionId.includes('servo') ||
        def.definitionId.includes('buzzer') ||
        def.name.toLowerCase().includes('động cơ') ||
        def.name.toLowerCase().includes('còi')
      );
    }
    if (selectedFilter === 'ic') {
      return (
        def.category === 'ics' ||
        def.category === 'semiconductors' ||
        def.definitionId.includes('ne555') ||
        def.definitionId.includes('logic') ||
        def.definitionId.includes('transistor') ||
        def.definitionId.includes('diode') ||
        def.definitionId.includes('7805')
      );
    }
    if (selectedFilter === 'connector') {
      return (
        def.category === 'connectors' ||
        def.definitionId.includes('terminal') ||
        def.definitionId.includes('connector') ||
        def.definitionId.includes('breadboard')
      );
    }

    return true;
  });

  const getCategoryIcon = (def: ComponentDefinition) => {
    if (def.category === 'power' || def.definitionId.includes('power')) {
      return <Zap className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (def.category === 'passives' || def.definitionId.includes('resistor')) {
      return <Sliders className="w-3.5 h-3.5 text-blue-500" />;
    }
    if (def.category === 'opto' || def.definitionId.includes('led')) {
      return <Volume2 className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (def.category === 'switches') {
      return <ToggleLeft className="w-3.5 h-3.5 text-purple-500" />;
    }
    if (def.category === 'sensors') {
      return <Thermometer className="w-3.5 h-3.5 text-orange-500" />;
    }
    if (def.category === 'microcontrollers') {
      return <Cpu className="w-3.5 h-3.5 text-teal-500" />;
    }
    if (def.category === 'ics') {
      return <Binary className="w-3.5 h-3.5 text-indigo-500" />;
    }
    return <Layers className="w-3.5 h-3.5 text-cyan-500" />;
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <aside className="absolute top-4 left-4 bottom-14 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 dark:border-cyan-900/60 bg-white/95 dark:bg-[#0c1424]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200 select-none">
      {/* Search & Header */}
      <div className="p-3 border-b border-[#d7e7f0] dark:border-cyan-950/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-xs" />
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              {language === 'vi' ? 'Thư viện linh kiện' : 'Component Library'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 font-mono font-semibold">
              {filteredComponents.length}
            </span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title={language === 'vi' ? 'Thu gọn thư viện linh kiện' : 'Collapse library'}
                aria-label="Collapse library"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              language === 'vi' ? 'Tìm linh kiện (Arduino, Breadboard...)' : 'Search components...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-cyan-950/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Vietnamese Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition cursor-pointer font-medium ${
                selectedFilter === f.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2 Components Per Row Grid List */}
      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="grid grid-cols-2 gap-2">
          {filteredComponents.map((def) => (
            <div
              key={def.definitionId}
              onClick={() => onAddComponent(def)}
              className="p-2 rounded-xl bg-slate-50/90 dark:bg-[#070e1c]/80 border border-slate-200/90 dark:border-cyan-950/50 hover:border-cyan-500 hover:shadow-md hover:bg-white dark:hover:bg-[#0f1b33] transition-all flex flex-col items-center gap-1.5 group cursor-pointer text-center relative"
              title={language === 'vi' ? `Nhấn để thêm ${def.name}` : `Click to add ${def.name}`}
            >
              {/* Quick Add Plus button on top-right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddComponent(def);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-white/90 dark:bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-slate-500 dark:text-slate-300 shadow-xs border border-slate-200/80 dark:border-slate-700/60 opacity-80 group-hover:opacity-100 transition z-10"
                title={language === 'vi' ? 'Thêm linh kiện' : 'Add component'}
              >
                <Plus className="w-3 h-3" />
              </button>

              {/* Small Thumbnail Image (or clean empty slot if no image yet) */}
              <div className="w-full h-16 rounded-lg bg-slate-100/80 dark:bg-[#0a1222] border border-slate-200/60 dark:border-cyan-950/40 overflow-hidden flex items-center justify-center p-1">
                {def.imageUrl ? (
                  <img
                    src={def.imageUrl}
                    alt={def.name}
                    className="w-full h-full object-contain filter group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  /* Empty image placeholder as requested: "linh kiện nào chưa có ảnh có thể để trống tôi sẽ thêm vào sau" */
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                    {getCategoryIcon(def)}
                  </div>
                )}
              </div>

              {/* Component Name only (details & specs moved to Thông tin & chỉ số) */}
              <div className="w-full flex items-center justify-center min-h-[2.2rem] px-0.5">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 leading-snug line-clamp-2">
                  {def.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredComponents.length === 0 && (
          <div className="text-center py-10 text-xs text-slate-500 px-4">
            {language === 'vi'
              ? `Không tìm thấy linh kiện nào trong bộ lọc này.`
              : `No components matching this filter.`}
          </div>
        )}
      </div>
    </aside>
  );
};

