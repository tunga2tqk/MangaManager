export type ChapterStatus = 'missing' | 'owned';

export interface AttributeGroup {
  id: string;
  name: string;
  tags: string[];
}

export interface Chapter {
  number: number;
  status: ChapterStatus;
  tags?: string[];
  count?: number; // số bản đã có (nếu > 1 là trùng)
}

export interface SpecialChapter {
  id: string;
  name: string;
  status: ChapterStatus;
  tags?: string[];
  count?: number; // số bản đã có (nếu > 1 là trùng)
}

export interface MangaSeries {
  id: string;
  name: string;
  totalChapters: number;
  tags?: string[]; // multiple tags per series
  chapters: Chapter[];
  specialChapters?: SpecialChapter[];
  coverImageUri?: string;
  galleryImageUris?: string[];
}
