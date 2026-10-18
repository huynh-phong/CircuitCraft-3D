import React, { useState } from 'react';
import { Users, GraduationCap, School, Cpu, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface PersonasSectionProps {
  onStartDesigning: () => void;
  onExploreLessons: () => void;
  onExploreMarketplace?: () => void;
}

export const PersonasSection: React.FC<PersonasSectionProps> = ({
  onStartDesigning,
  onExploreLessons,
  onExploreMarketplace,
}) => {
  const { language } = useI18n();
  const [activePersona, setActivePersona] = useState<string>('students');

  const personas = [
    {
      id: 'students',
      icon: GraduationCap,
      labelVi: 'Sinh viên & Người mới',
      labelEn: 'Students & Beginners',
      badgeVi: 'Học tập không rủi ro',
      badgeEn: 'Risk-Free Learning',
      titleVi: 'Học điện tử từ con số 0 với trải nghiệm trực quan',
      titleEn: 'Master Hardware from Scratch with Visual 3D Labs',
      descVi: 'Không còn sợ cháy chip hay cắm nhầm chân. Bạn được tự do thử nghiệm, đo đạc điện áp, quan sát bóng LED sáng theo công thức vật lý và có trợ lý Minibot hướng dẫn 24/7.',
      descEn: 'Never fear burning physical parts. Experiment freely, inspect live voltages, watch LEDs react to Ohm’s Law, and get 24/7 guidance from Minibot AI.',
      pointsVi: [
        'Không mất tiền mua linh kiện và kit thực hành đắt đỏ',
        'Mô phỏng DC thời gian thực phản ánh chính xác kết quả',
        'Lộ trình khóa học bài bản từ nguyên lý cơ bản đến vi điều khiển',
      ],
      pointsEn: [
        'Zero upfront cost for expensive electronics kits',
        'Real-time DC simulation mirrors real circuit behavior',
        'Structured curriculum from basics to microcontrollers',
      ],
      ctaVi: 'Bắt đầu học ngay',
      ctaEn: 'Start Learning Now',
      action: onExploreLessons,
    },
    {
      id: 'educators',
      icon: School,
      labelVi: 'Giảng viên & Giáo viên STEM',
      labelEn: 'Educators & STEM Teachers',
      badgeVi: 'Giảng dạy trực quan',
      badgeEn: 'Classroom Ready',
      titleVi: 'Công cụ trực quan hóa bài giảng điện tử sinh động',
      titleEn: 'Bring Electronics Lectures to Life in Full 3D',
      descVi: 'Dễ dàng chiếu không gian 3D lên màn hình máy chiếu lớp học, xoay 360 độ giải thích từng chân cắm Arduino và giao bài tập thực hành để sinh viên tự cắm dây nộp bài.',
      descEn: 'Project interactive 3D circuits onto lecture screens, orbit 360° to highlight pin mappings, and assign hands-on labs with automated DRC checks.',
      pointsVi: [
        'Góc nhìn 3D rõ nét thay thế hoàn toàn máy quay cận cảnh',
        'Chế độ Trình chiếu (Presentation Mode) phóng to chi tiết',
        'Tiết kiệm 100% chi phí hao hụt linh kiện phòng lab',
      ],
      pointsEn: [
        'Crystal-clear 3D views replace clunky document cameras',
        'Dedicated Presentation Mode for high-contrast viewing',
        'Eliminates 100% of lab component replenishment costs',
      ],
      ctaVi: 'Khám phá phòng Lab',
      ctaEn: 'Explore 3D Lab',
      action: onStartDesigning,
    },
    {
      id: 'makers',
      icon: Cpu,
      labelVi: 'Kỹ sư & Makers',
      labelEn: 'Makers & Hardware Engineers',
      badgeVi: 'Thử nghiệm thần tốc',
      badgeEn: 'Rapid Prototyping',
      titleVi: 'Phác thảo ý tưởng mạch trước khi hàn chì thật',
      titleEn: 'Prototype & Verify Ideas Before Physical Soldering',
      descVi: 'Kiểm tra tính logic của mạch phân cực, thử nghiệm các giá trị điện trở và công tắc khác nhau trên breadboard 3D trước khi đặt mua linh kiện hoặc đặt mạch in PCB.',
      descEn: 'Verify biasing circuits, test resistor values and switch behaviors on 3D breadboards before ordering physical parts or printing custom PCBs.',
      pointsVi: [
        'Kiểm tra luật DRC phát hiện đoản mạch tức thì',
        'Xuất file thiết kế JSON tương thích đa nền tảng',
        'Tiết kiệm thời gian sửa lỗi hàn linh kiện vật lý',
      ],
      pointsEn: [
        'Automated DRC rule checks detect shorts immediately',
        'Export standard JSON schematic documents anytime',
        'Save precious hours troubleshooting desoldering issues',
      ],
      ctaVi: 'Mở không gian 3D',
      ctaEn: 'Launch Workspace',
      action: onStartDesigning,
    },
    {
      id: 'creators',
      icon: Sparkles,
      labelVi: 'Tác giả & Nhà sáng tạo',
      labelEn: 'Creators & Authors',
      badgeVi: 'Chia sẻ & Doanh thu',
      badgeEn: 'Publish & Monetize',
      titleVi: 'Xuất bản mạch mẫu & xây dựng khóa học của bạn',
      titleEn: 'Publish Hardware Templates & Monetize Courses',
      descVi: 'Đóng gói các dự án mạch điện 3D độc đáo lên Marketplace, mở quyền truy cập miễn phí hoặc trả phí qua cổng VietQR tự động, xây dựng danh tiếng kỹ sư STEM.',
      descEn: 'Package distinctive 3D circuit projects onto the Marketplace, set prices with automated VietQR checkout, and build your engineering reputation.',
      pointsVi: [
        'Studio sáng tạo dành riêng cho tác giả',
        'Cổng thanh toán tự động VietQR nhận tiền tức thì',
        'Cộng đồng kỹ sư và người học tích cực',
      ],
      pointsEn: [
        'Dedicated Creator Dashboard with analytics',
        'Instant automated VietQR bank transfer payouts',
        'Access to an engaged community of STEM learners',
      ],
      ctaVi: 'Ghé thăm Cửa hàng',
      ctaEn: 'Visit Marketplace',
      action: onExploreMarketplace || onStartDesigning,
    },
  ];

  const current = personas.find((p) => p.id === activePersona) || personas[0];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Users className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Dành cho mọi đối tượng' : 'Built for Everyone'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Thiết kế cho ' : 'Built For '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'mọi người yêu thích công nghệ.' : 'Every Creator & Learner.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Dù bạn mới bắt đầu học điện tử hay là kỹ sư phần cứng giàu kinh nghiệm, CircuitCraft 3D đều mang đến công cụ trực quan phù hợp nhất.'
            : 'Whether you are just beginning your hardware journey or prototyping advanced embedded systems, CircuitCraft 3D is crafted for you.'}
        </p>

        {/* Persona Tabs Selector */}
        <div className="pt-6 flex items-center justify-center gap-2.5 flex-wrap">
          {personas.map((p) => {
            const Icon = p.icon;
            const isSelected = p.id === activePersona;

            return (
              <button
                key={p.id}
                onClick={() => setActivePersona(p.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30 scale-105'
                    : 'bg-white dark:bg-[#07172b] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-cyan-900/60 hover:bg-slate-50 dark:hover:bg-[#0a203a]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{language === 'vi' ? p.labelVi : p.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Persona Card */}
      <div className="rounded-[30px] overflow-hidden border border-[#bfe3f7] dark:border-cyan-500/40 bg-white/95 dark:bg-[#061224]/95 shadow-[0_20px_60px_rgba(6,182,212,0.15)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.8),_0_0_30px_rgba(6,182,212,0.18)] p-6 sm:p-10 backdrop-blur-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider border border-cyan-200 dark:border-cyan-800">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? current.badgeVi : current.badgeEn}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {language === 'vi' ? current.titleVi : current.titleEn}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {language === 'vi' ? current.descVi : current.descEn}
            </p>

            <div className="space-y-2 pt-2">
              {(language === 'vi' ? current.pointsVi : current.pointsEn).map((pt, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <button
                onClick={current.action}
                className="tech-btn-3d px-6 py-3 rounded-2xl text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>{language === 'vi' ? current.ctaVi : current.ctaEn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 flex items-center justify-center">
            <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-sky-400/10 to-teal-400/20 border-2 border-cyan-400/40 flex items-center justify-center shadow-xl shadow-cyan-500/10">
              {React.createElement(current.icon, {
                className: 'w-24 h-24 sm:w-28 sm:h-28 text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]',
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
