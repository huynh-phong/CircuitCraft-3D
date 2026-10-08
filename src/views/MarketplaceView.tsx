import React, { useState } from 'react';
import { Search, Filter, ShoppingBag, ArrowRight, Download, Star, CheckCircle, ShieldCheck } from 'lucide-react';
import { MarketplaceItem, ProjectDocument } from '../types/circuit.ts';
import { Dialog, Button, Badge } from '../components/ui/designSystem.tsx';

interface MarketplaceViewProps {
  onLoadProject: (templateDoc: Partial<ProjectDocument>) => void;
  onNavigateEditor: () => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onLoadProject, onNavigateEditor }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

  const sampleItems: MarketplaceItem[] = [
    {
      id: 'template_basic_led',
      title: 'Mạch LED Cơ Bản Hạn Dòng',
      category: 'Nhập môn',
      tierRequired: 'free',
      difficulty: 'Dễ',
      price: 0,
      author: 'CircuitVerse Academy',
      description: 'Mạch kinh điển kết hợp Nguồn 5V, Điện trở 220Ω và LED đỏ. Thích hợp cho người mới làm quen với không gian 3D.',
      downloads: 1840,
      rating: 4.9,
      circuitData: {
        name: 'Mạch LED Cơ Bản Hạn Dòng',
        components: [
          {
            id: 'c_src',
            type: 'dc_power_supply',
            name: 'Nguồn DC 5V',
            position: { x: -40, y: 0, z: 0 },
            rotation: 0,
            properties: { voltage: 5 },
            pins: [
              { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -14, y: 6, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 14, y: 6, z: 0 } },
            ],
          },
          {
            id: 'c_res',
            type: 'resistor',
            name: 'R1 (220Ω)',
            position: { x: 0, y: 0, z: -20 },
            rotation: 0,
            properties: { resistance: 220 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 'c_led',
            type: 'led',
            name: 'LED Đỏ',
            position: { x: 40, y: 0, z: 0 },
            rotation: 0,
            properties: { color: '#ef4444', forwardVoltage: 2.0, maxCurrent: 25 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
        ],
        connections: [
          { id: 'w1', fromComponentId: 'c_src', fromPinId: 'pin_pos', toComponentId: 'c_res', toPinId: 'pin_1', color: '#ef4444' },
          { id: 'w2', fromComponentId: 'c_res', fromPinId: 'pin_2', toComponentId: 'c_led', toPinId: 'pin_anode', color: '#eab308' },
          { id: 'w3', fromComponentId: 'c_led', fromPinId: 'pin_cathode', toComponentId: 'c_src', toPinId: 'pin_neg', color: '#0284c7' },
        ],
      },
    },
    {
      id: 'template_switch_circuit',
      title: 'Mạch Đóng Ngắt Khóa Điện SPST',
      category: 'Điều khiển',
      tierRequired: 'student',
      difficulty: 'Dễ',
      price: 0,
      author: 'Robotics Lab VN',
      description: 'Điều khiển đóng mở tiếp điểm cơ học để kiểm soát nguồn cấp cho tải LED. Mô phỏng cơ chế công tắc đèn sinh hoạt.',
      downloads: 1220,
      rating: 4.8,
      circuitData: {
        name: 'Mạch Khóa Điện SPST',
        components: [
          {
            id: 's_src',
            type: 'dc_power_supply',
            name: 'Nguồn DC 5V',
            position: { x: -50, y: 0, z: 0 },
            rotation: 0,
            properties: { voltage: 5 },
            pins: [
              { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -14, y: 6, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 14, y: 6, z: 0 } },
            ],
          },
          {
            id: 's_sw',
            type: 'switch_spst',
            name: 'Công tắc S1',
            position: { x: -10, y: 0, z: -30 },
            rotation: 0,
            properties: { isClosed: false },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -14, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 14, y: 5, z: 0 } },
            ],
          },
          {
            id: 's_res',
            type: 'resistor',
            name: 'R1 (330Ω)',
            position: { x: 30, y: 0, z: -30 },
            rotation: 0,
            properties: { resistance: 330 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 's_led',
            type: 'led',
            name: 'LED Xanh',
            position: { x: 50, y: 0, z: 10 },
            rotation: 0,
            properties: { color: '#22c55e', forwardVoltage: 2.1, maxCurrent: 25 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
        ],
        connections: [
          { id: 'sw1', fromComponentId: 's_src', fromPinId: 'pin_pos', toComponentId: 's_sw', toPinId: 'pin_1', color: '#ef4444' },
          { id: 'sw2', fromComponentId: 's_sw', fromPinId: 'pin_2', toComponentId: 's_res', toPinId: 'pin_1', color: '#eab308' },
          { id: 'sw3', fromComponentId: 's_res', fromPinId: 'pin_2', toComponentId: 's_led', toPinId: 'pin_anode', color: '#22c55e' },
          { id: 'sw4', fromComponentId: 's_led', fromPinId: 'pin_cathode', toComponentId: 's_src', toPinId: 'pin_neg', color: '#0284c7' },
        ],
      },
    },
    {
      id: 'template_traffic_light',
      title: 'Mô Phỏng Cụm Đèn Giao Thông 3 Màu',
      category: 'Dự án mẫu',
      tierRequired: 'free',
      difficulty: 'Trung bình',
      price: 0,
      author: 'SmartCity Innovation Lab',
      description: 'Hệ thống đèn báo giao thông 3 màu (Đỏ, Vàng, Xanh) độc lập với các nhánh song song và bộ trở phân áp chuyên dụng.',
      downloads: 1450,
      rating: 5.0,
      circuitData: {
        name: 'Cụm Đèn Giao Thông 3 Màu',
        components: [
          {
            id: 'tf_src',
            type: 'dc_power_supply',
            name: 'Nguồn 5V',
            position: { x: -60, y: 0, z: 0 },
            rotation: 0,
            properties: { voltage: 5 },
            pins: [
              { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -14, y: 6, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 14, y: 6, z: 0 } },
            ],
          },
          {
            id: 'tf_r1',
            type: 'resistor',
            name: 'R Đỏ (220Ω)',
            position: { x: -15, y: 0, z: -25 },
            rotation: 0,
            properties: { resistance: 220 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 'tf_led_red',
            type: 'led',
            name: 'LED Đỏ',
            position: { x: 30, y: 0, z: -25 },
            rotation: 0,
            properties: { color: '#ef4444', forwardVoltage: 2.0, maxCurrent: 25 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
          {
            id: 'tf_r2',
            type: 'resistor',
            name: 'R Vàng (220Ω)',
            position: { x: -15, y: 0, z: 0 },
            rotation: 0,
            properties: { resistance: 220 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 'tf_led_yellow',
            type: 'led',
            name: 'LED Vàng',
            position: { x: 30, y: 0, z: 0 },
            rotation: 0,
            properties: { color: '#eab308', forwardVoltage: 2.1, maxCurrent: 25 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
          {
            id: 'tf_r3',
            type: 'resistor',
            name: 'R Xanh (220Ω)',
            position: { x: -15, y: 0, z: 25 },
            rotation: 0,
            properties: { resistance: 220 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 'tf_led_green',
            type: 'led',
            name: 'LED Xanh',
            position: { x: 30, y: 0, z: 25 },
            rotation: 0,
            properties: { color: '#22c55e', forwardVoltage: 2.2, maxCurrent: 25 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
        ],
        connections: [
          { id: 'tf_w1', fromComponentId: 'tf_src', fromPinId: 'pin_pos', toComponentId: 'tf_r1', toPinId: 'pin_1', color: '#ef4444' },
          { id: 'tf_w2', fromComponentId: 'tf_r1', fromPinId: 'pin_2', toComponentId: 'tf_led_red', toPinId: 'pin_anode', color: '#ef4444' },
          { id: 'tf_w3', fromComponentId: 'tf_led_red', fromPinId: 'pin_cathode', toComponentId: 'tf_src', toPinId: 'pin_neg', color: '#0284c7' },
          { id: 'tf_w4', fromComponentId: 'tf_src', fromPinId: 'pin_pos', toComponentId: 'tf_r2', toPinId: 'pin_1', color: '#eab308' },
          { id: 'tf_w5', fromComponentId: 'tf_r2', fromPinId: 'pin_2', toComponentId: 'tf_led_yellow', toPinId: 'pin_anode', color: '#eab308' },
          { id: 'tf_w6', fromComponentId: 'tf_led_yellow', fromPinId: 'pin_cathode', toComponentId: 'tf_src', toPinId: 'pin_neg', color: '#0284c7' },
          { id: 'tf_w7', fromComponentId: 'tf_src', fromPinId: 'pin_pos', toComponentId: 'tf_r3', toPinId: 'pin_1', color: '#22c55e' },
          { id: 'tf_w8', fromComponentId: 'tf_r3', fromPinId: 'pin_2', toComponentId: 'tf_led_green', toPinId: 'pin_anode', color: '#22c55e' },
          { id: 'tf_w9', fromComponentId: 'tf_led_green', fromPinId: 'pin_cathode', toComponentId: 'tf_src', toPinId: 'pin_neg', color: '#0284c7' },
        ],
      },
    },
    {
      id: 'template_buzzer_alarm',
      title: 'Mạch Còi Báo Động Khẩn Cấp 85dB',
      category: 'Cảnh báo',
      tierRequired: 'free',
      difficulty: 'Cơ bản',
      price: 0,
      author: 'Security Systems VN',
      description: 'Hệ thống âm thanh báo động khẩn cấp với còi Buzzer 5V và nút nhấn tác động tức thì.',
      downloads: 980,
      rating: 4.9,
      circuitData: {
        name: 'Mạch Còi Báo Động Khẩn Cấp',
        components: [
          {
            id: 'bz_src',
            type: 'dc_power_supply',
            name: 'Nguồn DC 5V',
            position: { x: -45, y: 0, z: 0 },
            rotation: 0,
            properties: { voltage: 5 },
            pins: [
              { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -14, y: 6, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 14, y: 6, z: 0 } },
            ],
          },
          {
            id: 'bz_btn',
            type: 'pushbutton',
            name: 'Nút nhấn Báo động',
            position: { x: -10, y: 0, z: 0 },
            rotation: 0,
            properties: { pressed: true },
            pins: [
              { id: 'pin1', label: '1', type: 'passive', relativePosition: { x: -5, y: 2, z: 0 } },
              { id: 'pin2', label: '2', type: 'passive', relativePosition: { x: 5, y: 2, z: 0 } },
            ],
          },
          {
            id: 'bz_c1',
            type: 'buzzer',
            name: 'Còi Buzzer 5V',
            position: { x: 30, y: 0, z: 0 },
            rotation: 0,
            properties: {},
            pins: [
              { id: 'pin_pos', label: '+', type: 'passive', relativePosition: { x: -3, y: 2, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'passive', relativePosition: { x: 3, y: 2, z: 0 } },
            ],
          },
        ],
        connections: [
          { id: 'wbz1', fromComponentId: 'bz_src', fromPinId: 'pin_pos', toComponentId: 'bz_btn', toPinId: 'pin1', color: '#ef4444' },
          { id: 'wbz2', fromComponentId: 'bz_btn', fromPinId: 'pin2', toComponentId: 'bz_c1', toPinId: 'pin_pos', color: '#f59e0b' },
          { id: 'wbz3', fromComponentId: 'bz_c1', fromPinId: 'pin_neg', toComponentId: 'bz_src', toPinId: 'pin_neg', color: '#0284c7' },
        ],
      },
    },
    {
      id: 'template_ldr_nightlight',
      title: 'Đèn Tự Động Trời Tối Cảm Biến LDR',
      category: 'Cảm biến',
      tierRequired: 'free',
      difficulty: 'Trung bình',
      price: 0,
      author: 'Smart Home VN',
      description: 'Mạch cầu phân áp cảm biến quang trở LDR phát hiện bóng tối và tự động thắp sáng đèn LED.',
      downloads: 1120,
      rating: 5.0,
      circuitData: {
        name: 'Đèn Tự Động Cảm Biến LDR',
        components: [
          {
            id: 'ldr_src',
            type: 'dc_power_supply',
            name: 'Nguồn DC 5V',
            position: { x: -50, y: 0, z: 0 },
            rotation: 0,
            properties: { voltage: 5 },
            pins: [
              { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -14, y: 6, z: 0 } },
              { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 14, y: 6, z: 0 } },
            ],
          },
          {
            id: 'ldr_sens',
            type: 'ldr',
            name: 'Quang trở LDR',
            position: { x: -15, y: 0, z: -15 },
            rotation: 0,
            properties: { lux: 80 },
            pins: [
              { id: 'pin1', label: '1', type: 'passive', relativePosition: { x: -4, y: 2, z: 0 } },
              { id: 'pin2', label: '2', type: 'passive', relativePosition: { x: 4, y: 2, z: 0 } },
            ],
          },
          {
            id: 'ldr_res',
            type: 'resistor',
            name: 'R 10kΩ',
            position: { x: 15, y: 0, z: -15 },
            rotation: 0,
            properties: { resistance: 10000 },
            pins: [
              { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -18, y: 5, z: 0 } },
              { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 18, y: 5, z: 0 } },
            ],
          },
          {
            id: 'ldr_led',
            type: 'led',
            name: 'LED Trắng',
            position: { x: 45, y: 0, z: 0 },
            rotation: 0,
            properties: { color: '#ffffff', forwardVoltage: 3.0, maxCurrent: 20 },
            pins: [
              { id: 'pin_anode', label: '+ (A)', type: 'anode', relativePosition: { x: -8, y: 5, z: 0 } },
              { id: 'pin_cathode', label: '- (K)', type: 'cathode', relativePosition: { x: 8, y: 5, z: 0 } },
            ],
          },
        ],
        connections: [
          { id: 'wldr1', fromComponentId: 'ldr_src', fromPinId: 'pin_pos', toComponentId: 'ldr_sens', toPinId: 'pin1', color: '#ef4444' },
          { id: 'wldr2', fromComponentId: 'ldr_sens', fromPinId: 'pin2', toComponentId: 'ldr_res', toPinId: 'pin_1', color: '#f59e0b' },
          { id: 'wldr3', fromComponentId: 'ldr_res', fromPinId: 'pin_2', toComponentId: 'ldr_led', toPinId: 'pin_anode', color: '#10b981' },
          { id: 'wldr4', fromComponentId: 'ldr_led', fromPinId: 'pin_cathode', toComponentId: 'ldr_src', toPinId: 'pin_neg', color: '#0284c7' },
        ],
      },
    },
  ];

  const categories = ['Tất cả', 'Nhập môn', 'Điều khiển', 'Dự án mẫu', 'Cảm biến', 'Cảnh báo'];

  const filtered = sampleItems.filter((item) => {
    const matchCat = selectedCategory === 'Tất cả' || item.category === selectedCategory;
    const matchSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleOpenInEditor = (item: MarketplaceItem) => {
    if (item.circuitData) {
      onLoadProject(item.circuitData);
      onNavigateEditor();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-emerald-400" />
            Circuit Marketplace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Khám phá, sao chép và thí nghiệm các mô hình mạch 3D từ cộng đồng và học viện.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm mạch mẫu..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition duration-200 flex flex-col justify-between group shadow-lg"
          >
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={item.tierRequired === 'free' ? 'emerald' : item.tierRequired === 'student' ? 'blue' : 'amber'}>
                  {item.tierRequired.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{item.rating}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-100 group-hover:text-emerald-400 transition text-base">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                <span>Tác giả: <strong className="text-slate-200">{item.author}</strong></span>
                <span>•</span>
                <span>{item.downloads} lượt dùng</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                {item.price === 0 ? 'Miễn phí' : `${item.price.toLocaleString('vi-VN')} đ`}
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleOpenInEditor(item)}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Mở trong 3D Editor
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
