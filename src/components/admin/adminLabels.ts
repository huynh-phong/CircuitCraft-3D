/**
 * Display names for the codes stored in the database (roles, plans, statuses, categories...).
 * The stored values stay unchanged; only what the admin reads is translated.
 */
type Lang = 'vi' | 'en';
type Dict = Record<string, [vi: string, en: string]>;

function make(dict: Dict) {
  return (value: unknown, lang: Lang): string => {
    const key = String(value ?? '').toLowerCase();
    const hit = dict[key];
    if (hit) return lang === 'vi' ? hit[0] : hit[1];
    return String(value ?? '—');
  };
}

export const roleLabel = make({
  admin: ['Quản trị viên', 'Admin'],
  creator: ['Nhà sáng tạo', 'Creator'],
  pro: ['Học viên Pro', 'Student / Pro'],
  user: ['Người dùng', 'User'],
});

export const planLabel = make({
  free: ['Miễn phí (Starter)', 'Starter (Free)'],
  student: ['Học viên (Student Pro)', 'Student Pro'],
  creator: ['Nhà sáng tạo (Creator Pro)', 'Creator Pro'],
});

export const accountStatusLabel = make({
  active: ['Đang hoạt động', 'Active'],
  suspended: ['Tạm khóa', 'Suspended'],
});

export const orderStatusLabel = make({
  all: ['Tất cả', 'All'],
  pending: ['Chờ thanh toán', 'Pending'],
  paid: ['Đã thanh toán', 'Paid'],
  failed: ['Thất bại', 'Failed'],
  expired: ['Hết hạn', 'Expired'],
  cancelled: ['Đã hủy', 'Cancelled'],
  refunded: ['Đã hoàn tiền', 'Refunded'],
});

export const orderKindLabel = make({
  membership: ['Gói thành viên', 'Membership'],
  course: ['Khóa học', 'Course'],
  project: ['Mạch / sản phẩm', 'Circuit / product'],
  product: ['Sản phẩm', 'Product'],
  store: ['Cửa hàng', 'Store'],
});

export const contentStatusLabel = make({
  published: ['Đã xuất bản', 'Published'],
  pending: ['Chờ duyệt', 'Pending review'],
  draft: ['Bản nháp', 'Draft'],
  rejected: ['Bị từ chối', 'Rejected'],
  archived: ['Đã lưu trữ', 'Archived'],
  saved: ['Đã lưu', 'Saved'],
  active: ['Đang hoạt động', 'Active'],
});

export const logLevelLabel = make({
  info: ['Thông tin', 'Info'],
  success: ['Thành công', 'Success'],
  warning: ['Cảnh báo', 'Warning'],
  error: ['Lỗi', 'Error'],
});

export const logCategoryLabel = make({
  auth: ['Đăng nhập', 'Auth'],
  payment: ['Thanh toán', 'Payment'],
  admin: ['Quản trị', 'Admin'],
  project: ['Dự án', 'Project'],
  course: ['Khóa học', 'Course'],
  marketplace: ['Cửa hàng', 'Marketplace'],
  system: ['Hệ thống', 'System'],
});

export const severityLabel = make({
  critical: ['Nghiêm trọng', 'Critical'],
  warning: ['Cảnh báo', 'Warning'],
  info: ['Lưu ý', 'Info'],
});

export const productCategoryLabel = make({
  analog: ['Analog', 'Analog'],
  digital: ['Số (digital)', 'Digital'],
  power: ['Nguồn & công suất', 'Power'],
  iot: ['IoT', 'IoT'],
  sensor: ['Cảm biến', 'Sensor'],
  custom: ['Khác', 'Custom'],
  'khác': ['Khác', 'Other'],
});

export const paymentModeLabel = make({
  mock: ['Mô phỏng (demo)', 'Simulated (demo)'],
  real: ['Thật', 'Real'],
});

export const databaseStateLabel = make({
  ok: ['Đọc được (đồng bộ ngay trước khi trả lời)', 'Reachable'],
  not_migrated: ['Chưa chạy migration', 'Not migrated'],
  unreachable: ['Không kết nối được', 'Unreachable'],
  not_used: ['File cục bộ (không dùng Supabase)', 'Local files'],
});
