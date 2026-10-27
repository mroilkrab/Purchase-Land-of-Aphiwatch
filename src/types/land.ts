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

export type DocumentChecklistCategory =
  | 'deed'         // โฉนดที่ดิน / น.ส. 4 จ. / น.ส. 3 ก.
  | 'tax_receipt'  // ใบเสร็จภาษีที่ดิน / ค่าธรรมเนียม
  | 'survey_map'   // แผนที่รังวัด / ระวางที่ดิน
  | 'contract'     // สัญญาจะซื้อจะขาย / บันทึกมัดจำ
  | 'appraisal'    // ใบประเมินราคา / ราคาประเมินธนารักษ์
  | 'id_doc';      // สำเนาบัตรประชาชน / ทะเบียนบ้าน

export interface DocumentChecklistItemState {
  hasPhysicalHardCopy?: boolean;
  verified?: boolean;
  note?: string;
  updatedAt?: string;
}

export type DocumentChecklistRecord = Record<string, DocumentChecklistItemState>;

export interface LandPlotImage {
  id: string;
  url: string; // Data URL or cloud URL
  title: string;
  type: 'deed' | 'photo' | 'cadastral' | 'contract' | 'tax_receipt' | 'appraisal' | 'other';
  uploadedAt: string;
  category?: DocumentChecklistCategory;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveThumbnailLink?: string;
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
  
  // Partial sales & remaining area (ขายไปบางส่วน และ คงเหลือ)
  partiallySoldRai?: number;
  partiallySoldNgan?: number;
  partiallySoldSqWah?: number;
  partiallySoldTotalSqWah?: number;
  remainingSqWah?: number;
  
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
  
  // Land and Building Tax Act B.E. 2562 (ภาษีที่ดินและสิ่งปลูกสร้าง)
  appraisalPrice?: number; // ราคาประเมินทุนทรัพย์ที่ดิน (บาท)
  taxUsageType?: LandTaxUsageType; // ประเภทการใช้ประโยชน์ตามกฎหมาย
  isIndividualOwner?: boolean; // เจ้าของในนามบุคคลธรรมดา (ได้รับยกเว้น 50 ล้านแรก)
  vacantConsecutiveYears?: number; // ปีที่ทิ้งว่างเปล่าติดต่อกัน (กรณีที่ดินรกร้าง)
  annualLandTax?: number; // ภาษีที่ดินและสิ่งปลูกสร้างต่อปี (บาท)

  status: LandStatus;
  notes: string; // หมายเหตุเพิ่มเติม
  quickNotes?: QuickNoteItem[]; // บันทึกด่วน & ข้อสังเกตชั่วคราว
  images?: LandPlotImage[];
  documentChecklist?: DocumentChecklistRecord;
  driveFolderId?: string; // Google Drive folder ID for this specific plot
  driveFolderWebViewLink?: string; // Web URL to open the Google Drive folder directly
  updatedAt: string;
}

export type LandTaxUsageType = 
  | 'agricultural' // เกษตรกรรม (0.01% - ยกเว้น 50 ล้านแรก)
  | 'residential_primary' // ที่อยู่อาศัยหลังหลัก (ยกเว้น 50 ล้านแรก)
  | 'residential_other' // ที่อยู่อาศัยหลังอื่น / ปล่อยเช่า (0.02% เริ่มต้น)
  | 'commercial' // พาณิชยกรรม / อุตสาหกรรม / อื่นๆ (0.30% เริ่มต้น)
  | 'vacant'; // รกร้างว่างเปล่า / ไม่ได้ทำประโยชน์ (0.30% + ปรับเพิ่มทุก 3 ปี)

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
  theme?: 'dark' | 'light';
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
