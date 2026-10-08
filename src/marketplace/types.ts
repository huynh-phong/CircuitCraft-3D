import { ProjectDocument } from '../domain/project/types';

export interface CatalogProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number; // 0 = free, > 0 = paid
  currency: 'VND';
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  category: 'Học tập' | 'Chiếu sáng' | 'Điều khiển' | 'Âm thanh' | 'Mô-đun nguồn' | 'IoT & Nhúng';
  version: string;
  license: string;
  tags: string[];
  componentsSummary: string[];
  isFree: boolean;
  projectTemplate: () => ProjectDocument;
  rating: number;
  reviewsCount: number;
  downloadsCount: number;
  author: {
    name: string;
    verified: boolean;
    role: string;
  };
  learningOutcomes: string[];
}
