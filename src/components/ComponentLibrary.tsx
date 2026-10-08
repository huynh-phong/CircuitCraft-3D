import React, { useState } from 'react';
import { COMPONENT_DEFINITIONS } from '../domain/components/definitions';
import { ComponentDefinition } from '../domain/project/types';
import { Search, Plus, Zap, Cpu, Sliders, ToggleLeft, Layers, Volume2, Thermometer, Binary } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ComponentLibraryProps {
  onAddComponent: (def: ComponentDefinition) => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onAddComponent }) => {
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: t('cat.all') },
    { id: 'power', label: t('cat.power') },
    { id: 'passives', label: t('cat.passives') },
    { id: 'switches', label: t('cat.switches') },
    { id: 'opto', label: t('cat.opto') },
    { id: 'semiconductors', label: t('cat.semiconductors') },
    { id: 'sensors', label: t('cat.sensors') },
    { id: 'ics', label: t('cat.ics') },
    { id: 'microcontrollers', label: t('cat.microcontrollers') },
    { id: 'connectors', label: t('cat.connectors') },
  ];

  const filteredComponents = COMPONENT_DEFINITIONS.filter((def) => {
    const matchesSearch =
      def.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      def.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || def.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'power':
        return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'passives':
        return <Sliders className="w-3.5 h-3.5 text-blue-500" />;
      case 'opto':
        return <Volume2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'switches':
        return <ToggleLeft className="w-3.5 h-3.5 text-purple-500" />;
      case 'semiconductors':
        return <Zap className="w-3.5 h-3.5 text-rose-500" />;
      case 'sensors':
        return <Thermometer className="w-3.5 h-3.5 text-orange-500" />;
      case 'ics':
        return <Binary className="w-3.5 h-3.5 text-indigo-500" />;
      case 'microcontrollers':
        return <Cpu className="w-3.5 h-3.5 text-teal-500" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-cyan-500" />;
    }
  };

  return (
    <aside className="w-64 h-full border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col z-20 shrink-0 select-none transition-colors">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
            {t('component.library')}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {filteredComponents.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('component.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2 py-1 rounded text-[11px] whitespace-nowrap transition ${
                selectedCategory === c.id
                  ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-medium'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredComponents.map((def) => (
          <div
            key={def.definitionId}
            className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-100 dark:hover:bg-slate-850/80 transition flex flex-col gap-1.5 group"
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-1.5">
                {getCategoryIcon(def.category)}
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition">
                  {def.name}
                </span>
              </div>
              <button
                onClick={() => onAddComponent(def)}
                className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 transition"
                title={language === 'vi' ? 'Thêm linh kiện vào giữa bo mạch' : 'Add component to center of board'}
                aria-label="Add"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{def.description}</p>

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-900">
              <span>{def.pins.length} {t('component.pins')}</span>
              <span className="font-mono">
                {def.dimensions.x}x{def.dimensions.z}mm
              </span>
            </div>
          </div>
        ))}

        {filteredComponents.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-500">
            {language === 'vi'
              ? `Không tìm thấy linh kiện phù hợp với từ khóa "${searchQuery}"`
              : `No components matching "${searchQuery}"`}
          </div>
        )}
      </div>
    </aside>
  );
};
