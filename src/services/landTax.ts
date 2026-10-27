import { LandPlot, LandTaxUsageType } from '../types/land';

export interface TaxUsageInfo {
  id: LandTaxUsageType;
  title: string;
  shortLabel: string;
  description: string;
  exemptionRule: string;
  rateSummary: string;
  badgeBg: string;
  badgeText: string;
  iconType: 'sprout' | 'home' | 'building' | 'commercial' | 'alert';
}

export const TAX_USAGE_CONFIGS: Record<LandTaxUsageType, TaxUsageInfo> = {
  agricultural: {
    id: 'agricultural',
    title: 'เกษตรกรรม (ทำไร่ / ทำสวน / ปลูกพืช)',
    shortLabel: 'เกษตรกรรม',
    description: 'ที่ดินที่ใช้ประโยชน์ในการประกอบเกษตรกรรมตามเกณฑ์ขั้นต่ำของกระทรวงการคลัง',
    exemptionRule: 'บุคคลธรรมดาได้รับยกเว้นมูลค่า 50 ล้านบาทแรกต่อเขต อปท.',
    rateSummary: '0.01% - 0.10% (ยกเว้น 50 ล้านแรก)',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400 border border-emerald-500/30',
    iconType: 'sprout',
  },
  residential_primary: {
    id: 'residential_primary',
    title: 'ที่อยู่อาศัยหลังหลัก (มีชื่อในทะเบียนบ้าน)',
    shortLabel: 'บ้านหลังหลัก',
    description: 'ที่ดินและสิ่งปลูกสร้างที่เจ้าของเป็นบุคคลธรรมดาและมีชื่ออยู่ในทะเบียนบ้าน ณ วันที่ 1 ม.ค.',
    exemptionRule: 'ได้รับยกเว้นมูลค่า 50 ล้านบาทแรก (ที่ดินพร้อมสิ่งปลูกสร้าง)',
    rateSummary: '0.03% - 0.10% (ยกเว้น 50 ล้านแรก)',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-400 border border-sky-500/30',
    iconType: 'home',
  },
  residential_other: {
    id: 'residential_other',
    title: 'ที่อยู่อาศัยหลังอื่น / เพื่อการลงทุน / ให้เช่า',
    shortLabel: 'ที่อยู่อาศัยอื่น/ปล่อยเช่า',
    description: 'บ้านหลังที่สอง คอนโดปล่อยเช่า หรือที่อยู่อาศัยที่ไม่มีชื่อในทะเบียนบ้าน',
    exemptionRule: 'ไม่มีสิทธิยกเว้น 50 ล้านบาทแรก เสียภาษีตั้งแต่บาทแรก',
    rateSummary: '0.02% - 0.10%',
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-400 border border-indigo-500/30',
    iconType: 'building',
  },
  commercial: {
    id: 'commercial',
    title: 'พาณิชยกรรม / อุตสาหกรรม / อื่นๆ',
    shortLabel: 'พาณิชยกรรม/ร้านค้า',
    description: 'ที่ดินใช้ประโยชน์เชิงพาณิชย์ สำนักงาน โรงงาน คลังสินค้า หรือกิจการบริการ',
    exemptionRule: 'ไม่มีสิทธิยกเว้น เสียภาษีตามขั้นบันไดมูลค่าทรัพย์สิน',
    rateSummary: '0.30% - 0.70%',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400 border border-purple-500/30',
    iconType: 'commercial',
  },
  vacant: {
    id: 'vacant',
    title: 'ที่ดินรกร้างว่างเปล่า / ทิ้งไว้ไม่ได้ทำประโยชน์',
    shortLabel: 'รกร้างว่างเปล่า',
    description: 'ที่ดินที่ไม่ได้ทำประโยชน์ตามควรแก่สภาพ หรือทิ้งไว้รกร้างว่างเปล่าตลอดปีที่ผ่านมา',
    exemptionRule: 'ไม่มีสิทธิยกเว้น อัตราภาษีจะเพิ่มขึ้น 0.3% ทุก 3 ปี (สูงสุด 3.0%)',
    rateSummary: '0.30% - 3.00% (+0.3% ทุก 3 ปี)',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400 border border-rose-500/30',
    iconType: 'alert',
  },
};

export interface TaxBracketCalculation {
  bracketLabel: string;
  min: number;
  max: number;
  ratePercent: number;
  taxableInBracket: number;
  taxInBracket: number;
}

export interface LandTaxCalculationResult {
  appraisalPrice: number;
  usageType: LandTaxUsageType;
  isIndividualOwner: boolean;
  vacantYears: number;
  exemptionAmount: number;
  taxableBase: number;
  annualTax: number;
  monthlyTax: number;
  effectiveRatePercent: number;
  brackets: TaxBracketCalculation[];
  accruedTaxForPeriod: number; // ภาษีสะสมตามระยะเวลาถือครอง
  lawNote: string;
}

/**
 * Infer default usage type from land type description
 */
export const inferDefaultTaxUsage = (landType?: string): LandTaxUsageType => {
  if (!landType) return 'vacant';
  const t = landType.toLowerCase();
  if (t.includes('บ้าน') || t.includes('ทาวน์') || t.includes('คอนโด')) {
    return 'residential_other';
  }
  if (t.includes('อาคารพาณิชย์') || t.includes('ตึกแถว') || t.includes('โกดัง') || t.includes('โรงงาน')) {
    return 'commercial';
  }
  if (t.includes('เกษตร') || t.includes('สวน') || t.includes('ไร่') || t.includes('นา')) {
    return 'agricultural';
  }
  return 'vacant'; // Default for bare land
};

/**
 * Calculate Land and Building Tax under Thai Law B.E. 2562
 */
export const calculateLandTax = (params: {
  appraisalPrice: number;
  usageType?: LandTaxUsageType;
  isIndividualOwner?: boolean;
  vacantYears?: number;
  monthsHeld?: number;
}): LandTaxCalculationResult => {
  const {
    appraisalPrice = 0,
    usageType = 'vacant',
    isIndividualOwner = true,
    vacantYears = 0,
    monthsHeld = 0,
  } = params;

  const value = Math.max(0, Number(appraisalPrice) || 0);
  let exemptionAmount = 0;
  let taxableBase = value;
  const brackets: TaxBracketCalculation[] = [];
  let annualTax = 0;

  if (usageType === 'agricultural') {
    if (isIndividualOwner) {
      exemptionAmount = Math.min(value, 50000000);
      taxableBase = Math.max(0, value - exemptionAmount);
    } else {
      exemptionAmount = 0;
      taxableBase = value;
    }

    // Step rates on taxable base
    const tiers = [
      { max: 75000000, rate: 0.0001, label: '0 - 75 ล้านบาท (0.01%)' },
      { max: 100000000, rate: 0.0003, label: '75 - 100 ล้านบาท (0.03%)' },
      { max: 500000000, rate: 0.0005, label: '100 - 500 ล้านบาท (0.05%)' },
      { max: 1000000000, rate: 0.0007, label: '500 - 1,000 ล้านบาท (0.07%)' },
      { max: Infinity, rate: 0.0010, label: 'เกิน 1,000 ล้านบาท (0.10%)' },
    ];

    let prevMax = 0;
    for (const tier of tiers) {
      if (taxableBase > prevMax) {
        const taxable = Math.min(taxableBase, tier.max) - prevMax;
        const tax = taxable * tier.rate;
        brackets.push({
          bracketLabel: tier.label,
          min: prevMax,
          max: tier.max === Infinity ? taxableBase : tier.max,
          ratePercent: tier.rate * 100,
          taxableInBracket: taxable,
          taxInBracket: Math.round(tax),
        });
        annualTax += tax;
        prevMax = tier.max;
      }
    }
  } else if (usageType === 'residential_primary') {
    if (isIndividualOwner) {
      exemptionAmount = Math.min(value, 50000000);
      taxableBase = Math.max(0, value - exemptionAmount);
    } else {
      exemptionAmount = 0;
      taxableBase = value;
    }

    const tiers = [
      { max: 25000000, rate: 0.0003, label: '50 - 75 ล้านบาท (0.03%)' },
      { max: 50000000, rate: 0.0005, label: '75 - 100 ล้านบาท (0.05%)' },
      { max: Infinity, rate: 0.0010, label: 'เกิน 100 ล้านบาท (0.10%)' },
    ];

    let prevMax = 0;
    for (const tier of tiers) {
      if (taxableBase > prevMax) {
        const taxable = Math.min(taxableBase, tier.max) - prevMax;
        const tax = taxable * tier.rate;
        brackets.push({
          bracketLabel: tier.label,
          min: prevMax,
          max: tier.max === Infinity ? taxableBase : tier.max,
          ratePercent: tier.rate * 100,
          taxableInBracket: taxable,
          taxInBracket: Math.round(tax),
        });
        annualTax += tax;
        prevMax = tier.max;
      }
    }
  } else if (usageType === 'residential_other') {
    exemptionAmount = 0;
    taxableBase = value;

    const tiers = [
      { max: 50000000, rate: 0.0002, label: '0 - 50 ล้านบาท (0.02%)' },
      { max: 75000000, rate: 0.0003, label: '50 - 75 ล้านบาท (0.03%)' },
      { max: 100000000, rate: 0.0005, label: '75 - 100 ล้านบาท (0.05%)' },
      { max: Infinity, rate: 0.0010, label: 'เกิน 100 ล้านบาท (0.10%)' },
    ];

    let prevMax = 0;
    for (const tier of tiers) {
      if (taxableBase > prevMax) {
        const taxable = Math.min(taxableBase, tier.max) - prevMax;
        const tax = taxable * tier.rate;
        brackets.push({
          bracketLabel: tier.label,
          min: prevMax,
          max: tier.max === Infinity ? taxableBase : tier.max,
          ratePercent: tier.rate * 100,
          taxableInBracket: taxable,
          taxInBracket: Math.round(tax),
        });
        annualTax += tax;
        prevMax = tier.max;
      }
    }
  } else if (usageType === 'commercial') {
    exemptionAmount = 0;
    taxableBase = value;

    const tiers = [
      { max: 50000000, rate: 0.003, label: '0 - 50 ล้านบาท (0.30%)' },
      { max: 200000000, rate: 0.004, label: '50 - 200 ล้านบาท (0.40%)' },
      { max: 1000000000, rate: 0.005, label: '200 - 1,000 ล้านบาท (0.50%)' },
      { max: 5000000000, rate: 0.006, label: '1,000 - 5,000 ล้านบาท (0.60%)' },
      { max: Infinity, rate: 0.007, label: 'เกิน 5,000 ล้านบาท (0.70%)' },
    ];

    let prevMax = 0;
    for (const tier of tiers) {
      if (taxableBase > prevMax) {
        const taxable = Math.min(taxableBase, tier.max) - prevMax;
        const tax = taxable * tier.rate;
        brackets.push({
          bracketLabel: tier.label,
          min: prevMax,
          max: tier.max === Infinity ? taxableBase : tier.max,
          ratePercent: tier.rate * 100,
          taxableInBracket: taxable,
          taxInBracket: Math.round(tax),
        });
        annualTax += tax;
        prevMax = tier.max;
      }
    }
  } else {
    // Vacant Land
    exemptionAmount = 0;
    taxableBase = value;

    // Surcharge rule: +0.3% every 3 consecutive vacant years, max 3.0% (300 bps increase capped)
    const surchargePeriods = Math.floor(Math.max(0, vacantYears) / 3);
    const surchargeRate = Math.min(0.027, surchargePeriods * 0.003); // Max added to base 0.3% to reach 3.0%

    const tiers = [
      { max: 50000000, rate: 0.003 + surchargeRate, label: `0 - 50 ล้านบาท (${((0.003 + surchargeRate) * 100).toFixed(2)}%)` },
      { max: 200000000, rate: 0.004 + surchargeRate, label: `50 - 200 ล้านบาท (${((0.004 + surchargeRate) * 100).toFixed(2)}%)` },
      { max: 1000000000, rate: 0.005 + surchargeRate, label: `200 - 1,000 ล้านบาท (${((0.005 + surchargeRate) * 100).toFixed(2)}%)` },
      { max: 5000000000, rate: 0.006 + surchargeRate, label: `1,000 - 5,000 ล้านบาท (${((0.006 + surchargeRate) * 100).toFixed(2)}%)` },
      { max: Infinity, rate: 0.007 + surchargeRate, label: `เกิน 5,000 ล้านบาท (${((0.007 + surchargeRate) * 100).toFixed(2)}%)` },
    ];

    let prevMax = 0;
    for (const tier of tiers) {
      if (taxableBase > prevMax) {
        const taxable = Math.min(taxableBase, tier.max) - prevMax;
        const effectiveTierRate = Math.min(0.03, tier.rate); // Capped at 3.0%
        const tax = taxable * effectiveTierRate;
        brackets.push({
          bracketLabel: tier.label,
          min: prevMax,
          max: tier.max === Infinity ? taxableBase : tier.max,
          ratePercent: effectiveTierRate * 100,
          taxableInBracket: taxable,
          taxInBracket: Math.round(tax),
        });
        annualTax += tax;
        prevMax = tier.max;
      }
    }
  }

  const roundedAnnualTax = Math.round(annualTax);
  const monthlyTax = Math.round(roundedAnnualTax / 12);
  const effectiveRatePercent = value > 0 ? (roundedAnnualTax / value) * 100 : 0;

  // Accrued holding period tax
  const effectiveMonths = Math.max(0, monthsHeld);
  const accruedTaxForPeriod = Math.round((roundedAnnualTax / 12) * effectiveMonths);

  let lawNote = '';
  if (usageType === 'agricultural') {
    lawNote = isIndividualOwner
      ? 'ได้รับยกเว้นมูลค่า 50 ล้านบาทแรกตามมาตรา 40 พระราชบัญญัติภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562'
      : 'เสียภาษีตามขั้นบันไดอัตราเกษตรกรรม 0.01% - 0.10%';
  } else if (usageType === 'residential_primary') {
    lawNote = 'ได้รับยกเว้นมูลค่า 50 ล้านบาทแรกสำหรับบ้านหลังหลักที่ผู้ถือกรรมสิทธิ์มีชื่อในทะเบียนบ้าน';
  } else if (usageType === 'vacant' && vacantYears >= 3) {
    lawNote = `ที่ดินทิ้งไว้ว่างเปล่าติดต่อกัน ${vacantYears} ปี มีการบวกอัตราภาษีเพิ่มตามมาตรา 43 (+0.3% ทุก 3 ปี)`;
  } else {
    lawNote = 'คำนวณตามอัตราภาษีมาตรฐานของ พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562';
  }

  return {
    appraisalPrice: value,
    usageType,
    isIndividualOwner,
    vacantYears,
    exemptionAmount,
    taxableBase,
    annualTax: roundedAnnualTax,
    monthlyTax,
    effectiveRatePercent,
    brackets,
    accruedTaxForPeriod,
    lawNote,
  };
};

/**
 * Get plot tax calculation with fallback to purchase price if appraisal price is not set
 */
export const getPlotLandTax = (plot: Partial<LandPlot>, monthsHeld = 0): LandTaxCalculationResult => {
  const appraisal = Number(plot.appraisalPrice) > 0 ? Number(plot.appraisalPrice) : Number(plot.purchasePrice) || 0;
  const usageType = plot.taxUsageType || inferDefaultTaxUsage(plot.landType);
  const isIndividualOwner = plot.isIndividualOwner !== false; // Default true
  const vacantYears = Number(plot.vacantConsecutiveYears) || 0;

  return calculateLandTax({
    appraisalPrice: appraisal,
    usageType,
    isIndividualOwner,
    vacantYears,
    monthsHeld,
  });
};
