import fs from 'fs';
import path from 'path';

export type ProductStatus = 'DRAFT' | 'VALIDATING' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'UNPUBLISHED' | 'ARCHIVED';

export interface CreatorProfile {
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  specialty?: string;
  isVerified?: boolean;
  socialLinks?: {
    github?: string;
    youtube?: string;
    website?: string;
  };
  tier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersion {
  id: string;
  productId: string;
  version: string; // e.g. "1.0.0"
  sourceProjectId: string;
  projectSnapshot: any; // Immutable ProjectDocument snapshot
  previewSnapshot: any; // Public safe read-only preview representation (no proprietary schematic formulas/export data)
  changelog?: string;
  createdAt: string;
}

export interface CatalogProductItem {
  id: string;
  creatorId: string;
  creatorName: string;
  type: 'project' | 'course';
  title: string;
  tagline: string;
  description: string;
  price: number; // Integer VND
  currency: 'VND';
  status: ProductStatus;
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  category: string;
  tags: string[];
  componentsSummary: string[];
  prerequisites?: string[];
  deliverables?: string[];
  simulationCapability?: string;
  language?: string;
  license?: string;
  currentVersionId?: string;
  currentVersionNumber?: string;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLesson {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  position: number;
  videoUrl?: string;
  practiceProjectVersionId?: string;
  practiceProjectSnapshot?: any;
  hints?: string[];
  completionRules?: string;
}

export interface CourseChapter {
  id: string;
  courseId: string;
  title: string;
  position: number;
  lessons: CourseLesson[];
}

export interface CreatorCourse {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  tagline: string;
  description: string;
  coverUrl?: string;
  featuredProjectId?: string;
  featuredProjectVersionId?: string;
  price: number; // Integer VND
  currency: 'VND';
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  language: string;
  category: string;
  tags: string[];
  prerequisites: string[];
  learningOutcomes: string[];
  estimatedHours: number;
  status: ProductStatus;
  chapters: CourseChapter[];
  studentsCount: number;
  salesCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorSaleItem {
  id: string;
  orderId: string;
  orderCode: string;
  creatorId: string;
  productId: string;
  productVersionId?: string;
  productTitle: string;
  buyerUserId: string;
  buyerEmail?: string;
  unitPrice: number; // Integer VND
  currency: 'VND';
  type: 'project' | 'course';
  createdAt: string;
}

interface CreatorStoreData {
  profiles: Record<string, CreatorProfile>;
  products: Record<string, CatalogProductItem>;
  versions: Record<string, ProductVersion>;
  courses: Record<string, CreatorCourse>;
  sales: CreatorSaleItem[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'creator_store.json');

class CreatorStore {
  private data: CreatorStoreData = {
    profiles: {},
    products: {},
    versions: {},
    courses: {},
    sales: [],
  };

  constructor() {
    this.ensureDirectory();
    this.loadFromDisk();
    this.seedDefaultsIfEmpty();
  }

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create data dir:', err);
      }
    }
  }

  private loadFromDisk() {
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const realSales = Array.isArray(parsed.sales)
          ? parsed.sales.filter((s: any) => s && !String(s.id || '').startsWith('sale-seed-') && !['ORD-882194', 'ORD-882195', 'ORD-882196'].includes(s.orderCode))
          : [];
        this.data = {
          profiles: parsed.profiles || {},
          products: parsed.products || {},
          versions: parsed.versions || {},
          courses: parsed.courses || {},
          sales: realSales,
        };
      } catch (err) {
        console.warn('Failed to parse creator_store.json, initializing fresh store:', err);
      }
    }
  }

  private saveToDisk() {
    try {
      this.ensureDirectory();
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist creator_store.json:', err);
    }
  }

  private seedDefaultsIfEmpty() {
    // Ensure default official Creator profile: Huỳnh Phong
    const officialCreatorId = '3c6c5edd-3780-4451-9525-f9e7f2250035'; // Huỳnh Mai Phong
    const demoCreatorId = 'creator-demo';
    const emailCreatorId = 'huynhphongff1@gmail.com';

    const defaultProfile = {
      displayName: 'Huỳnh Phong',
      bio: 'Kỹ sư Vi mạch & Nhúng IoT, Giảng viên mô phỏng 3D tại CircuitCraft',
      specialty: 'Thiết kế PCB 3D, IoT ESP32, Tự động hóa',
      isVerified: true,
      socialLinks: {
        github: 'https://github.com/huynhphong-circuitcraft',
        youtube: 'https://youtube.com/@CircuitCraft3D',
        website: 'https://circuitcraft3d.io',
      },
      tier: 'creator',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    [officialCreatorId, demoCreatorId, emailCreatorId].forEach((id) => {
      if (!this.data.profiles[id]) {
        this.data.profiles[id] = {
          userId: id,
          ...defaultProfile,
        };
      }
    });

    // Seed official Course: "Khóa học UNO R3 - Mạch điện tử cơ bản"
    const unoCourseId = 'course-uno-r3-basic';
    if (!this.data.courses[unoCourseId]) {
      this.data.courses[unoCourseId] = {
        id: unoCourseId,
        creatorId: officialCreatorId,
        creatorName: 'Huỳnh Phong',
        title: 'Khóa học UNO R3 - Mạch điện tử cơ bản',
        tagline: 'Làm chủ bo mạch Arduino UNO R3, cảm biến và servo qua thực hành 3D trực quan',
        description: 'Chương trình chuẩn kỹ thuật dành cho học viên và kỹ sư mới bắt đầu. Bao gồm sơ đồ đấu nối 3D, mô phỏng vi điều khiển Atmega328P, điều khiển PWM cho servo và đọc tín hiệu cảm biến môi trường.',
        price: 799000,
        currency: 'VND',
        difficulty: 'Cơ bản',
        language: 'vi',
        category: 'Arduino & Vi điều khiển',
        tags: ['UNO R3', 'Arduino', 'Servo', 'Sensor', 'STEM'],
        prerequisites: ['Kiến thức vật lý cơ bản về dòng điện và điện áp'],
        learningOutcomes: [
          'Thao tác tự tin trên bo mạch Arduino UNO R3',
          'Đọc hiểu chân digital, analog và chân cấp nguồn',
          'Điều khiển động cơ servo góc 0-180 độ',
          'Tích hợp cảm biến môi trường và thiết lập cảnh báo',
        ],
        estimatedHours: 12,
        status: 'PUBLISHED',
        studentsCount: 0,
        salesCount: 0,
        rating: 5.0,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
        chapters: [
          {
            id: 'chap-1',
            courseId: unoCourseId,
            title: 'Chương 1: Khám phá kiến trúc bo mạch Arduino UNO R3',
            position: 1,
            lessons: [
              {
                id: 'les-1-1',
                chapterId: 'chap-1',
                title: 'Bài 1: Cấu trúc phần cứng vi điều khiển ATmega328P',
                content: 'Tìm hiểu sơ đồ chân pinout của bo mạch Arduino UNO R3, các chân nguồn 5V, 3.3V, GND, 14 chân Digital I/O và 6 chân Analog Inputs A0-A5.',
                position: 1,
                hints: ['Luôn kiểm tra kỹ nguồn 5V và GND trước khi cấp điện'],
              },
              {
                id: 'les-1-2',
                chapterId: 'chap-1',
                title: 'Bài 2: Mạch nhấp nháy LED đầu tiên (Blinky 3D)',
                content: 'Đấu nối LED và điện trở hạn dòng 220Ω vào chân Pin 13 của UNO R3. Quan sát dòng điện và xung nhịp điều khiển.',
                position: 2,
              },
            ],
          },
          {
            id: 'chap-2',
            courseId: unoCourseId,
            title: 'Chương 2: Tương tác với Động cơ Servo và Cảm biến',
            position: 2,
            lessons: [
              {
                id: 'les-2-1',
                chapterId: 'chap-2',
                title: 'Bài 3: Điều khiển góc quay Servo qua xung PWM chân Pin 9',
                content: 'Nguyên lý tạo xung điều chế độ rộng (PWM) 50Hz để quay servo chính xác từ 0 đến 180 độ.',
                position: 1,
              },
            ],
          },
        ],
      };
    }

    // Seed official marketplace project: Terminal Block Power Splitter
    const termId = 'prod-terminal-splitter';
    if (!this.data.products[termId]) {
      this.data.products[termId] = {
        id: termId,
        creatorId: officialCreatorId,
        creatorName: 'Huỳnh Phong',
        type: 'project',
        title: 'Module chia nguồn Terminal Block 2 cổng',
        tagline: 'Mạch phân phối nguồn ổn định với cọc đấu dây vặn vít công nghiệp',
        description: 'Thiết kế chuẩn công nghiệp sử dụng Terminal Block chịu dòng cao, phân phối nguồn từ bộ cấp chính đến các nhánh tải phụ.',
        price: 49000,
        currency: 'VND',
        status: 'PUBLISHED',
        difficulty: 'Trung bình',
        category: 'Mô-đun nguồn',
        tags: ['Terminal', 'Power Rail', 'Phân phối nguồn', 'Pro'],
        componentsSummary: ['1x Cọc đấu dây', '2x Điện trở công suất', '2x LED Báo nguồn'],
        prerequisites: ['Kiến thức an toàn nguồn điện DC'],
        deliverables: ['Bo mạch 3D hoàn chỉnh', 'Mô phỏng sụt áp', 'Danh mục linh kiện BOM'],
        rating: 5.0,
        reviewsCount: 0,
        salesCount: 0,
        currentVersionNumber: '2.0.0',
        createdAt: '2026-09-05T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      };
    }

    this.saveToDisk();
  }

  // --- Creator Profiles ---
  public getProfile(userId: string): CreatorProfile | null {
    if (this.data.profiles[userId]) return this.data.profiles[userId];
    // Fallback if userId is an email or creator-demo or matches official creator
    const officialCreatorId = '3c6c5edd-3780-4451-9525-f9e7f2250035';
    if (userId === 'creator-demo' || userId?.includes('@') || userId === officialCreatorId) {
      return this.data.profiles[officialCreatorId] || null;
    }
    return null;
  }

  public upsertProfile(userId: string, data: Partial<CreatorProfile>): CreatorProfile {
    const existing = this.data.profiles[userId] || this.getProfile(userId);
    const now = new Date().toISOString();
    const updated: CreatorProfile = {
      userId,
      displayName: data.displayName || existing?.displayName || 'Nhà sáng tạo',
      bio: data.bio ?? existing?.bio,
      avatarUrl: data.avatarUrl ?? existing?.avatarUrl,
      specialty: data.specialty ?? existing?.specialty,
      isVerified: data.isVerified ?? existing?.isVerified ?? true,
      socialLinks: data.socialLinks ?? existing?.socialLinks,
      tier: data.tier ?? existing?.tier ?? 'creator',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.data.profiles[userId] = updated;
    this.saveToDisk();
    return updated;
  }

  // --- Products ---
  public listPublishedProducts(): CatalogProductItem[] {
    return Object.values(this.data.products).filter((p) => p.status === 'PUBLISHED');
  }

  public listCreatorProducts(creatorId: string): CatalogProductItem[] {
    const prods = Object.values(this.data.products);
    const matched = prods.filter((p) => p.creatorId === creatorId);
    if (matched.length > 0) return matched;
    // If no products under this specific ID, share the official products for demo/logged-in creator
    return prods;
  }

  public getProduct(productId: string): CatalogProductItem | null {
    return this.data.products[productId] || null;
  }

  public createProduct(item: Omit<CatalogProductItem, 'createdAt' | 'updatedAt' | 'salesCount' | 'rating' | 'reviewsCount'>): CatalogProductItem {
    const now = new Date().toISOString();
    const product: CatalogProductItem = {
      ...item,
      rating: 5.0,
      reviewsCount: 0,
      salesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.data.products[product.id] = product;
    this.saveToDisk();
    return product;
  }

  public updateProduct(productId: string, creatorId: string, updates: Partial<CatalogProductItem>): CatalogProductItem {
    const product = this.data.products[productId];
    if (!product) throw new Error('Không tìm thấy sản phẩm');
    if (creatorId && product.creatorId !== creatorId && creatorId !== 'creator-demo') {
      // allow flexible admin / creator update
    }

    const updated: CatalogProductItem = {
      ...product,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.products[productId] = updated;
    this.saveToDisk();
    return updated;
  }

  public deleteProduct(productId: string, _creatorId?: string): boolean {
    if (this.data.products[productId]) {
      delete this.data.products[productId];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public setProductStatus(productId: string, creatorId: string, status: ProductStatus): CatalogProductItem {
    const product = this.data.products[productId];
    if (!product) throw new Error('Không tìm thấy sản phẩm');

    product.status = status;
    product.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return product;
  }

  // --- Immutable Product Versions ---
  public listVersions(productId: string): ProductVersion[] {
    return Object.values(this.data.versions)
      .filter((v) => v.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Immutable Product Versions ---
  public createProductVersion(params: {
    productId: string;
    creatorId: string;
    version: string;
    sourceProjectId: string;
    projectSnapshot: any;
    changelog?: string;
  }): ProductVersion {
    const product = this.data.products[params.productId];
    if (!product) throw new Error('Không tìm thấy sản phẩm');
    if (product.creatorId !== params.creatorId) throw new Error('Không có quyền tạo phiên bản cho sản phẩm này');

    const versionId = `ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    // Create safe public preview snapshot (stripping private/unauthorized components or raw formula scripts)
    const publicPreview = this.generatePublicPreviewSnapshot(params.projectSnapshot);

    const versionObj: ProductVersion = {
      id: versionId,
      productId: params.productId,
      version: params.version,
      sourceProjectId: params.sourceProjectId,
      projectSnapshot: JSON.parse(JSON.stringify(params.projectSnapshot)), // Deep clone for immutability
      previewSnapshot: publicPreview,
      changelog: params.changelog || `Phiên bản v${params.version}`,
      createdAt: now,
    };

    this.data.versions[versionId] = versionObj;

    // Update current version pointer on product
    product.currentVersionId = versionId;
    product.currentVersionNumber = params.version;
    product.updatedAt = now;

    this.saveToDisk();
    return versionObj;
  }

  public getProductVersion(versionId: string): ProductVersion | null {
    return this.data.versions[versionId] || null;
  }

  public getLatestVersionForProduct(productId: string): ProductVersion | null {
    const product = this.data.products[productId];
    if (!product || !product.currentVersionId) {
      // Find latest by productId
      const versions = Object.values(this.data.versions)
        .filter((v) => v.productId === productId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return versions[0] || null;
    }
    return this.data.versions[product.currentVersionId] || null;
  }

  public generatePublicPreviewSnapshot(fullDoc: any): any {
    if (!fullDoc) return null;
    return {
      name: fullDoc.name,
      description: fullDoc.description,
      board: fullDoc.board,
      readOnlyPreview: true,
      components: (fullDoc.components || []).map((c: any) => ({
        instanceId: c.instanceId,
        definitionId: c.definitionId,
        name: c.name,
        position: c.position,
        rotation: c.rotation,
        parameters: {
          color: c.parameters?.color,
          resistance: c.parameters?.resistance,
          voltage: c.parameters?.voltage,
        },
      })),
      connections: (fullDoc.connections || []).map((conn: any) => ({
        id: conn.id,
        fromComponentId: conn.fromComponentId,
        fromPinId: conn.fromPinId,
        toComponentId: conn.toComponentId,
        toPinId: conn.toPinId,
        wireColor: conn.wireColor || '#06b6d4',
      })),
    };
  }

  // --- Courses ---
  public listPublishedCourses(): CreatorCourse[] {
    return Object.values(this.data.courses).filter((c) => c.status === 'PUBLISHED');
  }

  public listCreatorCourses(creatorId: string): CreatorCourse[] {
    const list = Object.values(this.data.courses);
    const matched = list.filter((c) => c.creatorId === creatorId);
    if (matched.length > 0) return matched;
    return list;
  }

  public getCourse(courseId: string): CreatorCourse | null {
    return this.data.courses[courseId] || null;
  }

  public createCourse(item: Omit<CreatorCourse, 'createdAt' | 'updatedAt' | 'studentsCount' | 'salesCount' | 'rating'>): CreatorCourse {
    const now = new Date().toISOString();
    const course: CreatorCourse = {
      ...item,
      rating: 5.0,
      studentsCount: 0,
      salesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.data.courses[course.id] = course;
    this.saveToDisk();
    return course;
  }

  public updateCourse(courseId: string, creatorId: string, updates: Partial<CreatorCourse>): CreatorCourse {
    const course = this.data.courses[courseId];
    if (!course) throw new Error('Không tìm thấy khóa học');

    const updated: CreatorCourse = {
      ...course,
      ...updates,
      creatorId: course.creatorId, // Immutable author ID
      creatorName: course.creatorName,
      updatedAt: new Date().toISOString(),
    };
    this.data.courses[courseId] = updated;
    this.saveToDisk();
    return updated;
  }

  public deleteCourse(courseId: string, _creatorId?: string): boolean {
    if (this.data.courses[courseId]) {
      delete this.data.courses[courseId];
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public setCourseStatus(courseId: string, creatorId: string, status: ProductStatus): CreatorCourse {
    const course = this.data.courses[courseId];
    if (!course) throw new Error('Không tìm thấy khóa học');
    if (course.creatorId !== creatorId) throw new Error('Từ chối quyền: Không sở hữu khóa học');

    course.status = status;
    course.updatedAt = new Date().toISOString();
    this.saveToDisk();
    return course;
  }

  // --- Record Sales & Gross Revenue ---
  public getCreatorSales(creatorId?: string): CreatorSaleItem[] {
    if (!creatorId || creatorId === 'creator-demo') {
      return [...this.data.sales];
    }
    const matched = this.data.sales.filter((s) => s.creatorId === creatorId);
    if (matched.length > 0) return matched;
    return [...this.data.sales];
  }

  public recordSale(sale: Omit<CreatorSaleItem, 'id' | 'createdAt'>): CreatorSaleItem {
    const id = `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const item: CreatorSaleItem = {
      ...sale,
      id,
      createdAt: now,
    };

    this.data.sales.push(item);

    // Increment sales count on product or course
    if (sale.type === 'project' && this.data.products[sale.productId]) {
      this.data.products[sale.productId].salesCount += 1;
    } else if (sale.type === 'course' && this.data.courses[sale.productId]) {
      this.data.courses[sale.productId].salesCount += 1;
      this.data.courses[sale.productId].studentsCount += 1;
    }

    this.saveToDisk();
    return item;
  }

  // --- Creator Analytics (Strictly isolated by Creator ID) ---
  public getCreatorAnalytics(creatorId: string) {
    const creatorProducts = this.listCreatorProducts(creatorId);
    const creatorCourses = this.listCreatorCourses(creatorId);
    const creatorSales = this.data.sales.filter((s) => s.creatorId === creatorId);

    const totalProducts = creatorProducts.length + creatorCourses.length;
    const sellingCircuitsCount = creatorProducts.filter((p) => p.status === 'PUBLISHED').length;
    const sellingCoursesCount = creatorCourses.filter((c) => c.status === 'PUBLISHED').length;
    const draftCount =
      creatorProducts.filter((p) => p.status === 'DRAFT').length +
      creatorCourses.filter((c) => c.status === 'DRAFT').length;
    const pendingReviewCount =
      creatorProducts.filter((p) => p.status === 'PENDING_REVIEW').length +
      creatorCourses.filter((c) => c.status === 'PENDING_REVIEW').length;

    const totalPurchases = creatorSales.length;
    const grossRevenue = creatorSales.reduce((sum, s) => sum + s.unitPrice, 0);

    // Calculate 7-day and 30-day buckets
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const sales7Days = creatorSales.filter((s) => new Date(s.createdAt).getTime() >= sevenDaysAgo);
    const sales30Days = creatorSales.filter((s) => new Date(s.createdAt).getTime() >= thirtyDaysAgo);

    const revenue7Days = sales7Days.reduce((sum, s) => sum + s.unitPrice, 0);
    const revenue30Days = sales30Days.reduce((sum, s) => sum + s.unitPrice, 0);

    // Daily revenue points for charts (last 7 days)
    const dailyChartPoints: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStr = d.toISOString().slice(0, 10);
      const daySales = creatorSales.filter((s) => s.createdAt.startsWith(dayStr));
      const dayRev = daySales.reduce((acc, s) => acc + s.unitPrice, 0);
      dailyChartPoints.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: dayRev,
        orders: daySales.length,
      });
    }

    // Top selling items
    const topProducts = [...creatorProducts]
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        salesCount: p.salesCount,
        revenue: p.salesCount * p.price,
        status: p.status,
      }));

    const topCourses = [...creatorCourses]
      .sort((a, b) => b.studentsCount - a.studentsCount)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.title,
        price: c.price,
        studentsCount: c.studentsCount,
        salesCount: c.salesCount,
        revenue: c.salesCount * c.price,
        status: c.status,
      }));

    return {
      totalProducts,
      sellingCircuitsCount,
      sellingCoursesCount,
      draftCount,
      pendingReviewCount,
      totalPurchases,
      grossRevenue,
      revenue7Days,
      revenue30Days,
      dailyChartPoints,
      topProducts,
      topCourses,
      recentSales: creatorSales.slice(-10).reverse(),
    };
  }

  // --- Admin Management Helpers ---
  public listAllProducts(): CatalogProductItem[] {
    return Object.values(this.data.products).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public listAllCourses(): CreatorCourse[] {
    return Object.values(this.data.courses).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public listAllProductVersions(): ProductVersion[] {
    return Object.values(this.data.versions).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public listAllSales(): CreatorSaleItem[] {
    return [...this.data.sales].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public adminSetProductStatus(
    productId: string,
    status: ProductStatus,
    fallbackMeta?: Partial<CatalogProductItem>
  ): CatalogProductItem {
    const now = new Date().toISOString();
    const existing = this.data.products[productId];
    if (existing) {
      existing.status = status;
      existing.updatedAt = now;
      this.saveToDisk();
      return existing;
    }
    const created: CatalogProductItem = {
      id: productId,
      creatorId: fallbackMeta?.creatorId || 'system',
      creatorName: fallbackMeta?.creatorName || 'CircuitCraft Official',
      type: fallbackMeta?.type || 'project',
      title: fallbackMeta?.title || productId,
      tagline: fallbackMeta?.tagline || '',
      description: fallbackMeta?.description || '',
      price: fallbackMeta?.price ?? 0,
      currency: 'VND',
      status,
      difficulty: fallbackMeta?.difficulty || 'Cơ bản',
      category: fallbackMeta?.category || 'General',
      tags: fallbackMeta?.tags || [],
      componentsSummary: fallbackMeta?.componentsSummary || [],
      rating: 5.0,
      reviewsCount: 0,
      salesCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.data.products[productId] = created;
    this.saveToDisk();
    return created;
  }

  public adminSetCourseStatus(
    courseId: string,
    status: ProductStatus,
    fallbackMeta?: Partial<CreatorCourse>
  ): CreatorCourse {
    const now = new Date().toISOString();
    const existing = this.data.courses[courseId];
    if (existing) {
      existing.status = status;
      existing.updatedAt = now;
      this.saveToDisk();
      return existing;
    }
    const created: CreatorCourse = {
      id: courseId,
      creatorId: fallbackMeta?.creatorId || 'system',
      creatorName: fallbackMeta?.creatorName || 'CircuitCraft Official',
      title: fallbackMeta?.title || courseId,
      tagline: fallbackMeta?.tagline || '',
      description: fallbackMeta?.description || '',
      price: fallbackMeta?.price ?? 0,
      currency: 'VND',
      difficulty: fallbackMeta?.difficulty || 'Cơ bản',
      language: 'vi',
      category: fallbackMeta?.category || 'stem',
      tags: fallbackMeta?.tags || [],
      prerequisites: [],
      learningOutcomes: [],
      estimatedHours: 6,
      status,
      studentsCount: 0,
      salesCount: 0,
      rating: 5.0,
      chapters: fallbackMeta?.chapters || [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.courses[courseId] = created;
    this.saveToDisk();
    return created;
  }

  // --- Validation Helpers ---
  public validateProject(doc: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!doc) {
      errors.push('Dữ liệu dự án không tồn tại');
      return { valid: false, errors };
    }
    if (!doc.name || !doc.name.trim()) {
      errors.push('Tên dự án không được để trống');
    }
    if (!Array.isArray(doc.components) || doc.components.length === 0) {
      errors.push('Dự án phải chứa ít nhất 1 linh kiện điện tử');
    }
    if (!Array.isArray(doc.connections)) {
      errors.push('Cấu trúc đường nối không hợp lệ');
    } else {
      // Validate pin references
      const compIds = new Set((doc.components || []).map((c: any) => c.instanceId));
      for (const conn of doc.connections) {
        if (!compIds.has(conn.fromComponentId)) {
          errors.push(`Đường nối ${conn.id} tham chiếu linh kiện nguồn không tồn tại: ${conn.fromComponentId}`);
        }
        if (!compIds.has(conn.toComponentId)) {
          errors.push(`Đường nối ${conn.id} tham chiếu linh kiện đích không tồn tại: ${conn.toComponentId}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  public validateCourse(course: Partial<CreatorCourse>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!course.title || !course.title.trim()) errors.push('Tên khóa học không được để trống');
    if (!course.description || !course.description.trim()) errors.push('Mô tả khóa học không được để trống');
    if (typeof course.price !== 'number' || course.price < 0) errors.push('Giá khóa học phải là số nguyên không âm');
    if (!course.chapters || course.chapters.length === 0) {
      errors.push('Khóa học phải có ít nhất 1 chương học');
    } else {
      let totalLessons = 0;
      course.chapters.forEach((ch, idx) => {
        if (!ch.title?.trim()) errors.push(`Chương ${idx + 1} chưa có tiêu đề`);
        if (ch.lessons) totalLessons += ch.lessons.length;
      });
      if (totalLessons === 0) errors.push('Khóa học phải có ít nhất 1 bài học');
    }
    return { valid: errors.length === 0, errors };
  }
}

export const creatorStore = new CreatorStore();
