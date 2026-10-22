export interface SubParcel {
  id: string;
  deedNumber: string; // เลขที่ดิน/เลขโฉนด
  rai: number;
  ngan: number;
  sqWah: number;
  totalSqWah: number;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface LandPlotImage {
  id: string;
  url: string; // Data URL or cloud URL
  title: string;
  type: 'deed' | 'photo' | 'cadastral' | 'contract' | 'other';
  uploadedAt: string;
}

export type LandStatus = 'holding' | 'for_sale' | 'sold' | 'consignment'; // ถือครอง, กำลังประกาศขาย, ขายแล้ว, ขายฝาก

export interface LandPlot {
  id: string;
  orderNumber: number; // ลำดับ
  purchaseDate: string; // วันที่ซื้อ เช่น "23/3/2569"
  saleDate: string; // วันที่ขาย เช่น "ขายแล้ว" หรือ "18/2/2568"
  title: string; // รายละเอียดที่ดิน
  landType: string; // ประเภท: ที่ดินเปล่า, ขายฝาก, น.ส.3, บ้านพร้อมที่ดิน, ที่ดินเปล่า (แบ่งโฉนด), อาคารพาณิชย์
  subdistrict: string; // ตำบล/แขวง
  district: string; // อำเภอ/เขต
  province: string; // จังหวัด
  primaryDeedNumber: string; // เลขที่ดินหลัก
  mapsUrl: string; // ลิงก์แผนที่ Google Maps
  latitude?: number; // ละติจูด
  longitude?: number; // ลองจิจูด
  
  // Land Area (ขนาดที่ดินรวม)
  rai: number; // ไร่
  ngan: number; // งาน
  sqWah: number; // ตารางวา
  totalRai: number; // รวมจำนวนที่ดิน (ไร่) คำนวณเป็นทศนิยม
  totalSqWah: number; // รวมจำนวนที่ดิน (ตร.ว.)
  
  // Sub parcels (โฉนดย่อยในแปลงเดียวกัน)
  subParcels?: SubParcel[];
  
  // Costs & Valuation (ราคาและการลงทุน)
  pricePerRai: number; // ไร่ละ
  pricePerSqWah: number; // ตารางวาละ
  purchasePrice: number; // ราคารวม/ราคาซื้อ
  taxAndFees: number; // จ่ายค่าธรรมเนียม/ค่าอากร/ภาษี
  surveyCost: number; // จ่ายค่ารังวัด
  otherExpenses: number; // จ่ายค่าใช้จ่ายอื่นๆ
  totalCost: number; // รวมทั้งสิ้น/ทั้งหมด = purchasePrice + taxAndFees + surveyCost + otherExpenses
  
  // Sales & Realization (การขายและกำไร)
  targetSalePrice: number; // ราคาที่ตั้งใจจะขาย (KPI ประมาณการ)
  soldPrice: number; // ราคาที่ขายได้จริง
  commissionFee: number; // ค่าคอมมิชชั่น
  netReceived: number; // สุทธิที่ได้รับ
  
  status: LandStatus;
  notes: string; // หมายเหตุเพิ่มเติม
  quickNotes?: QuickNoteItem[]; // บันทึกด่วน & ข้อสังเกตชั่วคราว
  images?: LandPlotImage[];
  updatedAt: string;
}

export type QuickNoteTag = 'observation' | 'reminder' | 'agent' | 'urgent' | 'visit' | 'general';

export interface QuickNoteItem {
  id: string;
  text: string;
  createdAt: string; // ISO string e.g. "2026-10-22T08:15:00.000Z"
  tag?: QuickNoteTag;
}

export type AppFontSize = 'sm' | 'base' | 'lg' | 'xl';

export interface PortfolioSettings {
  ownerName: string;
  portfolioTitle: string;
  defaultCommissionRate: number; // e.g. 3%
  defaultTaxRate: number; // e.g. 2%
  expectedHoldingPeriodMonths?: number; // e.g. 12 or 24 months
  googleSheetId?: string;
  lastSyncedAt?: string;
  currency: string;
  fontSize?: AppFontSize;
}

export interface KPIStats {
  totalPlots: number;
  holdingPlots: number;
  soldPlots: number;
  consignmentPlots: number;
  
  totalAreaSqWah: number;
  totalAreaRai: number;
  holdingAreaSqWah: number;
  holdingAreaRai: number;
  
  totalPurchaseCost: number; // ราคารวมซื้อทั้งหมด
  totalAcquisitionCost: number; // รวมต้นทุนทั้งสิ้น (รวมภาษี, ค่ารังวัด, ค่าอื่นๆ)
  totalTargetSalePrice: number; // ราคาที่ตั้งใจจะขายรวม (แปลงที่ยังถือครอง)
  projectedGrossProfit: number; // กำไรคาดหวังรวม
  projectedROI: number; // % ผลตอบแทนคาดหวัง
  
  totalRealizedSales: number; // ยอดขายจริง
  totalNetReceived: number; // สุทธิที่ได้รับจริง
  totalRealizedProfit: number; // กำไรรับรู้แล้ว
  
  provincesCount: number;
}
