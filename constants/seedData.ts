import type { AttributeGroup, Chapter, ChapterStatus, MangaSeries } from '@/types';

export const INITIAL_ATTRIBUTE_GROUPS: AttributeGroup[] = [
  {
    id: 'group-price',
    name: 'Giá bìa',
    tags: ['6k', '6k5', '7k5', '10k', '13k', '16k'],
  },
  {
    id: 'group-year',
    name: 'Năm xuất bản',
    tags: ['1999', '2002', '2003', '2004', '2005', '2008', '2009'],
  },
];

interface SeriesSeed {
  name: string;
  totalChapters: number;
  tags?: string[];
  missing?: number[];
  extra?: number[]; // mỗi phần tử là một bản thừa (có thể lặp)
  owned?: number[]; // nếu có, chỉ các tập này là đã có, còn lại chưa có
  specialChapters?: Array<{ name: string; status: ChapterStatus; count?: number }>;
}

function buildChapters(seed: SeriesSeed): Chapter[] {
  const missingSet = new Set(seed.missing || []);
  const ownedSet = new Set(seed.owned || []);
  const extraCounts = new Map<number, number>();
  (seed.extra || []).forEach((n) => {
    extraCounts.set(n, (extraCounts.get(n) || 0) + 1);
  });

  return Array.from({ length: seed.totalChapters }, (_, i) => {
    const number = i + 1;
    let status: ChapterStatus;
    if (seed.owned && seed.owned.length > 0) {
      status = ownedSet.has(number) ? 'owned' : 'missing';
    } else {
      status = missingSet.has(number) ? 'missing' : 'owned';
    }
    const extra = extraCounts.get(number) || 0;
    const count = status === 'owned' && extra > 0 ? 1 + extra : undefined;
    return { number, status, count };
  });
}

function makeSeries(seed: SeriesSeed, index?: number): MangaSeries {
  const slug = seed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseId = `seed-${index !== undefined ? index + 1 : Math.random().toString(36).substring(2, 7)}-${slug}`;
  return {
    id: baseId,
    name: seed.name,
    totalChapters: seed.totalChapters,
    tags: seed.tags || [],
    chapters: buildChapters(seed),
    specialChapters: seed.specialChapters?.map((sc, scIndex) => ({
      id: `${baseId}-special-${scIndex + 1}`,
      name: sc.name,
      status: sc.status,
      count: sc.count,
      tags: [],
    })),
  };
}

export const INITIAL_SERIES: MangaSeries[] = [
  // 7 viên ngọc rồng
  makeSeries({
    name: '7 viên ngọc rồng 2003',
    totalChapters: 58,
    tags: ['7 viên ngọc rồng', '2003'],
    missing: [4, 5, 11, 14, 36, 37, 45, 58],
    extra: [8, 9, 10, 22],
  }),

  // Doremon ngắn (45 tập)
  makeSeries({
    name: 'Doremon ngắn 1999',
    totalChapters: 45,
    tags: ['Doremon', '1999'],
    missing: [8, 9, 18, 20, 22, 26, 31, 44, 45],
  }),
  makeSeries({
    name: 'Doremon ngắn 2009 loại 3',
    totalChapters: 45,
    tags: ['Doremon', '2009', 'loại 3'],
    missing: [10, 14, 18, 20, 22, 23, 24, 29, 32, 36, 39, 43],
    extra: [27, 33, 33],
  }),
  makeSeries({
    name: 'Doremon ngắn 2002 - bìa 6k',
    totalChapters: 45,
    tags: ['Doremon', '2002', '6k'],
    missing: [3, 7, 9, 14, 19, 20, 21, 22, 23, 24, 25, 27, 28, 30, 33, 34, 35, 37, 41, 43],
  }),
  makeSeries({
    name: 'Doremon ngắn 2005 - bìa 7k5',
    totalChapters: 45,
    tags: ['Doremon', '2005', '7k5'],
    missing: [11, 16, 17, 21, 26, 27, 30, 36, 37],
  }),
  makeSeries({
    name: 'Doremon ngắn 2009',
    totalChapters: 45,
    tags: ['Doremon', '2009'],
    missing: [23, 27, 32, 33, 37, 39, 44],
  }),
  makeSeries({
    name: 'Doremon ngắn 2009 Loại 2',
    totalChapters: 45,
    tags: ['Doremon', '2009', 'loại 2'],
    missing: [13, 20, 29, 32],
  }),
  makeSeries({
    name: 'Doremon ngắn 1999 loại 2',
    totalChapters: 45,
    tags: ['Doremon', '1999', 'loại 2'],
    missing: [1, 12, 13, 15],
    extra: [37],
  }),
  makeSeries({
    name: 'Doremon ngắn 2008 - bìa 10k',
    totalChapters: 45,
    tags: ['Doremon', '2008', '10k'],
    missing: [14, 15, 16, 17, 19, 21, 22, 23, 27, 28, 29, 34, 35, 38, 40, 41, 44, 45],
  }),
  makeSeries({
    name: 'Doremon ngắn hỗn hợp (gáy ngang)',
    totalChapters: 45,
    tags: ['Doremon', 'hỗn hợp'],
    missing: [1, 3, 5, 11, 12, 14, 15, 17, 19, 21, 22, 24, 26, 27, 28, 33, 35, 36, 37, 38, 39, 44],
  }),
  makeSeries({
    name: 'Doremon ngắn hỗn hợp nhiều gáy',
    totalChapters: 45,
    tags: ['Doremon', 'hỗn hợp'],
    missing: [4, 11, 14, 15, 16, 17, 21, 26, 31, 34, 38, 39, 43, 44],
    extra: [9, 9, 42],
  }),
  makeSeries({
    name: 'Doremon ngắn 2007 - bìa 10k (kỷ niệm 50 năm)',
    totalChapters: 45,
    tags: ['Doremon', '2007', '10k', 'kỷ niệm 50 năm'],
    missing: [2, 3, 4, 5, 6, 7, 12, 14, 17, 18, 25, 26, 30, 31, 33, 34, 35, 36, 37, 38, 39, 41, 42, 44],
  }),

  // Doremon dài (24 tập)
  makeSeries({
    name: 'Doremon dài 2009',
    totalChapters: 24,
    tags: ['Doremon', '2009'],
    missing: [3, 21, 22],
    extra: [1, 10],
  }),
  makeSeries({
    name: 'Doremon dài 2004 - bìa 6k',
    totalChapters: 24,
    tags: ['Doremon', '2004', '6k'],
    owned: [1, 13, 17, 18, 20, 21, 22, 23],
  }),
  makeSeries({
    name: 'Doremon dài 2004 - bìa 6k5',
    totalChapters: 24,
    tags: ['Doremon', '2004', '6k5'],
    owned: [3, 7, 8, 9, 15, 16, 17, 19],
  }),
  makeSeries({
    name: 'Doremon dài 2005 - bìa 7k5',
    totalChapters: 24,
    tags: ['Doremon', '2005', '7k5'],
    owned: [1, 2, 3, 4, 6, 11, 17, 21, 24, 5, 7, 16],
  }),
  makeSeries({
    name: 'Doremon dài 2008 - bìa 10k',
    totalChapters: 24,
    tags: ['Doremon', '2008', '10k'],
    owned: [2, 3, 4, 6, 7, 9, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 10, 16, 17],
  }),
  makeSeries({
    name: 'Doremon dài hỗn hợp (ảnh bổ sung)',
    totalChapters: 24,
    tags: ['Doremon', 'hỗn hợp'],
    owned: [2, 4, 7, 10, 17, 3, 6, 11, 20, 21, 23, 24],
    extra: [4],
  }),

  // Doremon plus (5 tập)
  makeSeries({
    name: 'Doremon plus bìa 7k5',
    totalChapters: 5,
    tags: ['Doremon', '7k5'],
    missing: [3],
  }),
  makeSeries({
    name: 'Doremon plus bìa 13k',
    totalChapters: 5,
    tags: ['Doremon', '13k'],
    extra: [2],
  }),
  makeSeries({
    name: 'Doremon plus bìa 10k (kỷ niệm 50 năm)',
    totalChapters: 5,
    tags: ['Doremon', '10k', 'kỷ niệm 50 năm'],
    missing: [1, 2, 3, 4],
  }),

  // Doremon thêm (6 tập)
  makeSeries({
    name: 'Doremon thêm - giá bìa 6k',
    totalChapters: 6,
    tags: ['Doremon', '6k'],
    specialChapters: [{ name: '5*', status: 'owned' }],
  }),
  makeSeries({
    name: 'Doremon thêm giá bìa hỗn hợp',
    totalChapters: 6,
    tags: ['Doremon', 'hỗn hợp'],
    extra: [6],
  }),
  makeSeries({
    name: 'Doremon thêm 2009 giá bìa 13k',
    totalChapters: 6,
    tags: ['Doremon', '2009', '13k', 'màu đậm'],
    missing: [1, 2, 3, 4],
  }),
  makeSeries({
    name: 'Doremon thêm 2008 giá bìa 13k',
    totalChapters: 6,
    tags: ['Doremon', '2008', '13k', 'màu nhạt'],
    missing: [6],
  }),

  // đội quân Doremon thêm (12 tập)
  makeSeries({
    name: 'đội quân Doremon thêm 2004 giá bìa 6k',
    totalChapters: 12,
    tags: ['đội quân Doremon', '2004', '6k'],
    extra: [5],
  }),
  makeSeries({
    name: 'đội quân Doremon thêm 2009 giá bìa 13k',
    totalChapters: 12,
    tags: ['đội quân Doremon', '2009', '13k'],
    missing: [3, 5, 11, 12],
    extra: [4],
  }),
  makeSeries({
    name: 'đội quân Doremon thêm hỗn hợp',
    totalChapters: 12,
    tags: ['đội quân Doremon', 'hỗn hợp'],
    missing: [2, 6, 9, 12],
  }),

  // đội quân doremon thêm đặc biệt (3 tập)
  makeSeries({
    name: 'đội quân doremon thêm đặc biệt 2009-13k số 1',
    totalChapters: 3,
    tags: ['đội quân Doremon', '2009', '13k', 'đặc biệt'],
    missing: [3],
  }),
  makeSeries({
    name: 'đội quân doremon thêm đặc biệt 2009-13k số 2',
    totalChapters: 3,
    tags: ['đội quân Doremon', '2009', '13k', 'đặc biệt'],
    missing: [3],
  }),
  makeSeries({
    name: 'đội quân doremon thêm đặc biệt 2009-13k số 3',
    totalChapters: 3,
    tags: ['đội quân Doremon', '2009', '13k', 'đặc biệt'],
  }),
  makeSeries({
    name: 'đội quân doremon thêm đặc biệt 2005-7k5 xấu',
    totalChapters: 3,
    tags: ['đội quân Doremon', '2005', '7k5'],
    missing: [1, 3],
  }),
  makeSeries({
    name: 'đội quân doremon thêm đặc biệt 2005-7k5 đẹp',
    totalChapters: 3,
    tags: ['đội quân Doremon', '2005', '7k5'],
    missing: [2, 3],
  }),

  // Doremon nhi đồng (18 tập)
  makeSeries({
    name: 'Doremon nhi đồng',
    totalChapters: 18,
    tags: ['Doremon'],
  }),

  // Doremon bóng chày (23 tập)
  makeSeries({
    name: 'Doremon bóng chày 13k',
    totalChapters: 23,
    tags: ['Doremon', '13k'],
    missing: [20, 21, 22, 23],
  }),
  makeSeries({
    name: 'Doremon bóng chày 7k5',
    totalChapters: 23,
    tags: ['Doremon', '7k5'],
    missing: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  }),
  makeSeries({
    name: 'Doremon bóng chày 10k',
    totalChapters: 23,
    tags: ['Doremon', '10k'],
    missing: [1, 2, 3, 6, 7, 10, 11, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  }),
  makeSeries({
    name: 'Doremon bóng chày 16k',
    totalChapters: 23,
    tags: ['Doremon', '16k'],
    missing: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  }),

  // Đội quân nhí nhố (39 tập)
  makeSeries({
    name: 'Đội quân nhí nhố',
    totalChapters: 39,
    tags: ['Đội quân nhí nhố'],
    missing: [9, 10, 11, 14, 15, 16, 20, 21, 25, 26, 27, 28, 35, 36, 39],
  }),

  // Yughi Oh (39 tập)
  makeSeries({
    name: 'Yughi Oh',
    totalChapters: 39,
    tags: ['Yughi Oh'],
    missing: [3, 6, 8, 9, 12, 14, 15],
  }),

  // Yughi oh movie (15 tập)
  makeSeries({
    name: 'Yughi oh movie',
    totalChapters: 15,
    tags: ['Yughi Oh'],
    missing: [1, 3, 8, 9, 10, 11, 14, 15],
  }),
].map((series, index) => {
  const slug = series.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseId = `seed-${index + 1}-${slug}`;
  return {
    ...series,
    id: baseId,
    specialChapters: series.specialChapters?.map((sc, scIndex) => ({
      ...sc,
      id: `${baseId}-special-${scIndex + 1}`,
    })),
  };
});
