import { 
  Utensils, 
  TrainFront, 
  Lightbulb, 
  Gamepad2, 
  Wallet, 
  CircleEllipsis,
  Home,
  ShoppingBag,
  Heart,
  Smartphone,
  Briefcase,
  TrendingUp,
  Gift,
  Coffee,
  Car,
  Plane,
  Tv,
  Users,
  Shirt,
  Scissors,
  MedicineBox,
  CreditCard,
  Banknote,
  type LucideIcon 
} from 'lucide-react-native';

export type CategoryType = 'expense' | 'income';

export type MajorCategory = {
  id: string;
  label: string;
  icon: string; // Icon key for CATEGORY_ICONS
  color: string;
  type: CategoryType;
  subCategories: MinorCategory[];
};

export type MinorCategory = {
  id: string;
  label: string;
};

// 全てのアイコンを定義
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  cafe: Coffee,
  transport: TrainFront,
  car: Car,
  travel: Plane,
  utilities: Lightbulb,
  housing: Home,
  shopping: ShoppingBag,
  fashion: Shirt,
  entertainment: Gamepad2,
  hobbies: Tv,
  health: Heart,
  beauty: Scissors,
  medical: Heart, // Reusing heart for now or find MedicineBox if possible
  communication: Smartphone,
  social: Users,
  salary: Briefcase,
  bonus: TrendingUp,
  gift: Gift,
  side_income: Banknote,
  investment: TrendingUp,
  others: CircleEllipsis,
  wallet: Wallet,
  card: CreditCard,
};

export const CATEGORIES: MajorCategory[] = [
  // --- 支出 ---
  {
    id: 'food_group',
    label: '食費',
    icon: 'food',
    color: '#f97316',
    type: 'expense',
    subCategories: [
      { id: 'food', label: '食費（一般）' }, // 既存互換
      { id: 'dining_out', label: '外食' },
      { id: 'cafe', label: 'カフェ・間食' },
    ]
  },
  {
    id: 'transport_group',
    label: '交通・車両',
    icon: 'transport',
    color: '#3b82f6',
    type: 'expense',
    subCategories: [
      { id: 'transport', label: '公共交通（電車・バス）' }, // 既存互換
      { id: 'taxi', label: 'タクシー' },
      { id: 'car', label: '車（ガソリン・駐車場）' },
    ]
  },
  {
    id: 'daily_group',
    label: '生活用品',
    icon: 'shopping',
    color: '#ec4899',
    type: 'expense',
    subCategories: [
      { id: 'shopping', label: '日用品' }, // 既存互換
      { id: 'fashion', label: '衣服' },
      { id: 'beauty', label: '美容・サロン' },
    ]
  },
  {
    id: 'housing_group',
    label: '住居・光熱費',
    icon: 'housing',
    color: '#6366f1',
    type: 'expense',
    subCategories: [
      { id: 'housing', label: '家賃・ローン' }, // 既存互換
      { id: 'utilities', label: '公共料金（電気・ガス・水道）' },
      { id: 'communication', label: '通信費（携帯・ネット）' },
    ]
  },
  {
    id: 'entertainment_group',
    label: '娯楽・交際',
    icon: 'entertainment',
    color: '#a855f7',
    type: 'expense',
    subCategories: [
      { id: 'entertainment', label: '娯楽・レジャー' }, // 既存互換
      { id: 'hobbies', label: '趣味・教養' },
      { id: 'social', label: '交際費' },
    ]
  },
  {
    id: 'health_group',
    label: '健康・医療',
    icon: 'health',
    color: '#ef4444',
    type: 'expense',
    subCategories: [
      { id: 'health', label: '健康維持' }, // 既存互換
      { id: 'medical', label: '医療費・薬品' },
    ]
  },

  // --- 収入 ---
  {
    id: 'income_group',
    label: '定期収入',
    icon: 'salary',
    color: '#10b981',
    type: 'income',
    subCategories: [
      { id: 'salary', label: '給与' }, // 既存互換
      { id: 'bonus', label: '賞与' },
    ]
  },
  {
    id: 'other_income_group',
    label: '臨時収入',
    icon: 'gift',
    color: '#f59e0b',
    type: 'income',
    subCategories: [
      { id: 'gift', label: 'お祝い・プレゼント' }, // 既存互換
      { id: 'side_income', label: '副業・臨時収入' },
      { id: 'other_income', label: 'その他雑収入' },
    ]
  },

  {
    id: 'others_group',
    label: 'その他',
    icon: 'others',
    color: '#64748b',
    type: 'expense',
    subCategories: [
      { id: 'others', label: 'その他' }, // 既存互換
    ]
  },
];

// ヘルパー関数: 小カテゴリIDから親の大カテゴリを見つける
export const getMajorCategoryByMinorId = (minorId: string): MajorCategory | undefined => {
  return CATEGORIES.find(major => major.subCategories.some(minor => minor.id === minorId));
};

// ヘルパー関数: 小カテゴリIDから小カテゴリを取得する
export const getMinorCategoryById = (minorId: string): MinorCategory | undefined => {
  for (const major of CATEGORIES) {
    const minor = major.subCategories.find(m => m.id === minorId);
    if (minor) return minor;
  }
  return undefined;
};

export const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c.type === 'expense');
export const INCOME_CATEGORIES = CATEGORIES.filter(c => c.type === 'income');
