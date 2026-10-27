import { LandPlot, LandStatus } from '../types/land';

export interface CsvParseResult {
  plots: LandPlot[];
  errors: string[];
  warnings: string[];
  totalRowsProcessed: number;
}

/**
 * Robust CSV/TSV tokenizer that correctly parses quoted strings,
 * escaped quotes (""), and multiple delimiter types (, \t ;).
 */
export function tokenizeCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current.trim());
  return result;
}

/**
 * Auto-detect delimiter from the first non-empty lines
 */
function detectDelimiter(content: string): string {
  const firstLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 3);
  if (firstLines.length === 0) return ',';

  const line = firstLines[0];
  const tabCount = (line.match(/\t/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  const semiCount = (line.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

/**
 * Clean numeric string e.g. "1,250,000.00 บาท" -> 1250000
 */
function parseNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize status in Thai/English
 */
function normalizeStatus(val: string): LandStatus {
  if (!val) return 'holding';
  const str = val.trim().toLowerCase();
  if (str.includes('ขายแล้ว') || str === 'sold') return 'sold';
  if (str.includes('ฝาก') || str.includes('จำนอง') || str.includes('มัดจำ') || str === 'consignment') return 'consignment';
  if (str.includes('ประกาศขาย') || str.includes('กำลังขาย') || str === 'for_sale') return 'for_sale';
  return 'holding';
}

/**
 * Extract lat/lng from Google Maps link
 */
function extractCoords(url: string): { lat?: number; lng?: number } {
  if (!url) return {};
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }
  return {};
}

/**
 * Parse raw CSV/TSV string into an array of LandPlot objects.
 */
export function parseCsvToPlots(csvText: string, startOrderNumber: number = 1): CsvParseResult {
  const result: CsvParseResult = {
    plots: [],
    errors: [],
    warnings: [],
    totalRowsProcessed: 0,
  };

  if (!csvText || !csvText.trim()) {
    result.errors.push('ข้อความ CSV ว่างเปล่า กรุณาวางข้อมูลก่อนกดนำเข้า');
    return result;
  }

  const delimiter = detectDelimiter(csvText);
  const rawLines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    result.errors.push('ไม่พบข้อมูลในเนื้อหา CSV');
    return result;
  }

  let lineIndex = 0;
  let firstLineTokens = tokenizeCsvLine(rawLines[0], delimiter);

  // If first line has only 1 column and looks like a title (e.g. "รายละเอียดการซื้อที่ดิน - อภิวัชร์"), skip it
  if (firstLineTokens.length === 1 && rawLines.length > 1) {
    lineIndex++;
    firstLineTokens = tokenizeCsvLine(rawLines[lineIndex], delimiter);
  }

  // Detect header columns mapping
  const headerMap: { [key: string]: number } = {};
  const isHeaderRow = firstLineTokens.some((tok) =>
    /ลำดับ|order|วันที่|ซื้อ|รายละเอียด|ชื่อ|title|ประเภท|ตำบล|อำเภอ|จังหวัด|โฉนด|ไร่|งาน|วา|ราคา|cost|status|สถานะ/i.test(tok)
  );

  if (isHeaderRow) {
    firstLineTokens.forEach((header, idx) => {
      const h = header.toLowerCase().replace(/[\s/\\()_.-]/g, '');
      if (/ลำดับ|order|no|id/.test(h)) headerMap['orderNumber'] = idx;
      else if (/วันที่ซื้อ|purchasedate|buydate/.test(h)) headerMap['purchaseDate'] = idx;
      else if (/วันที่ขาย|saledate/.test(h)) headerMap['saleDate'] = idx;
      else if (/รายละเอียด|ชื่อแปลง|title|name|description/.test(h)) headerMap['title'] = idx;
      else if (/ประเภท|landtype|type/.test(h)) headerMap['landType'] = idx;
      else if (/ตำบล|แขวง|subdistrict/.test(h)) headerMap['subdistrict'] = idx;
      else if (/อำเภอ|เขต|district/.test(h)) headerMap['district'] = idx;
      else if (/จังหวัด|province/.test(h)) headerMap['province'] = idx;
      else if (/เลขที่ดิน|เลขโฉนด|deed|โฉนด/.test(h)) headerMap['primaryDeedNumber'] = idx;
      else if (/ตำแหน่ง|แผนที่|maps|url|พิกัด|location/.test(h)) headerMap['mapsUrl'] = idx;
      else if (/รวมไร่|รวมจำนวนที่ดินไร่|totalrai/.test(h)) headerMap['totalRai'] = idx;
      else if (/รวมตารางวา|รวมตรว|รวมจำนวนที่ดินตรว|totalsqwah/.test(h)) headerMap['totalSqWah'] = idx;
      else if (/^ไร่$|rai/.test(h)) headerMap['rai'] = idx;
      else if (/^งาน$|ngan/.test(h)) headerMap['ngan'] = idx;
      else if (/^ตารางวา$|^วา$|sqwah/.test(h)) headerMap['sqWah'] = idx;
      else if (/ไร่ละ|pricerai/.test(h)) headerMap['pricePerRai'] = idx;
      else if (/ตารางวาละ|pricesqwah/.test(h)) headerMap['pricePerSqWah'] = idx;
      else if (/ราคารวม|ราคาซื้อ|purchaseprice/.test(h)) headerMap['purchasePrice'] = idx;
      else if (/ค่าธรรมเนียม|ค่าอากร|ภาษี|tax/.test(h)) headerMap['taxAndFees'] = idx;
      else if (/ค่ารังวัด|survey/.test(h)) headerMap['surveyCost'] = idx;
      else if (/ค่าใช้จ่ายอื่นๆ|otherexpenses/.test(h)) headerMap['otherExpenses'] = idx;
      else if (/รวมทั้งสิ้น|รวมทั้งหมด|รวมต้นทุน|totalcost|cost/.test(h)) headerMap['totalCost'] = idx;
      else if (/ราคาที่ตั้งใจจะขาย|ราคาขายเป้าหมาย|targetsale|target/.test(h)) headerMap['targetSalePrice'] = idx;
      else if (/ราคาที่ขายได้|soldprice|sold/.test(h)) headerMap['soldPrice'] = idx;
      else if (/คอมมิชชั่น|commission/.test(h)) headerMap['commissionFee'] = idx;
      else if (/สุทธิ|netreceived|net/.test(h)) headerMap['netReceived'] = idx;
      else if (/สถานะ|status/.test(h)) headerMap['status'] = idx;
      else if (/หมายเหตุ|note|notes|remark/.test(h)) headerMap['notes'] = idx;
    });
    lineIndex++; // Move past header row
  }

  // Iterate over data rows
  let orderSequence = startOrderNumber;

  for (let i = lineIndex; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    if (!rawLine.trim()) continue;

    const cols = tokenizeCsvLine(rawLine, delimiter);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    result.totalRowsProcessed++;

    // Helper to extract value either by headerMap or positional index
    const getVal = (field: string, fallbackIdx: number): string => {
      if (headerMap[field] !== undefined && headerMap[field] < cols.length) {
        return cols[headerMap[field]] || '';
      }
      if (fallbackIdx >= 0 && fallbackIdx < cols.length) {
        return cols[fallbackIdx] || '';
      }
      return '';
    };

    const orderRaw = parseNum(getVal('orderNumber', 0));
    const assignedOrder = orderRaw > 0 ? orderRaw : orderSequence;
    orderSequence = Math.max(orderSequence, assignedOrder) + 1;

    const title = getVal('title', 3) || getVal('title', 1) || `แปลงที่ดินลำดับ #${assignedOrder}`;
    const purchaseDate = getVal('purchaseDate', 1) || new Date().toLocaleDateString('th-TH');
    const saleDate = getVal('saleDate', 2);
    const landType = getVal('landType', 4) || 'ที่ดินเปล่า';
    const subdistrict = getVal('subdistrict', 5);
    const district = getVal('district', 6);
    const province = getVal('province', 7) || 'นครสวรรค์';
    const primaryDeedNumber = getVal('primaryDeedNumber', 8);
    const mapsUrl = getVal('mapsUrl', 9);

    const rai = parseNum(getVal('rai', 10));
    const ngan = parseNum(getVal('ngan', 11));
    const sqWah = parseNum(getVal('sqWah', 12));

    let totalSqWah = parseNum(getVal('totalSqWah', 14));
    if (totalSqWah === 0 && (rai > 0 || ngan > 0 || sqWah > 0)) {
      totalSqWah = rai * 400 + ngan * 100 + sqWah;
    }

    let totalRai = parseNum(getVal('totalRai', 13));
    if (totalRai === 0 && totalSqWah > 0) {
      totalRai = Number((totalSqWah / 400).toFixed(2));
    }

    const pricePerRai = parseNum(getVal('pricePerRai', 15));
    const pricePerSqWah = parseNum(getVal('pricePerSqWah', 16));
    const purchasePrice = parseNum(getVal('purchasePrice', 17));
    const taxAndFees = parseNum(getVal('taxAndFees', 18));
    const surveyCost = parseNum(getVal('surveyCost', 19));
    const otherExpenses = parseNum(getVal('otherExpenses', 20));

    let totalCost = parseNum(getVal('totalCost', 21));
    if (totalCost === 0) {
      totalCost = purchasePrice + taxAndFees + surveyCost + otherExpenses;
    }

    const targetSalePrice = parseNum(getVal('targetSalePrice', 22));
    const soldPrice = parseNum(getVal('soldPrice', 23));
    const commissionFee = parseNum(getVal('commissionFee', 24));
    const netReceived = parseNum(getVal('netReceived', 25));
    const status = normalizeStatus(getVal('status', 26));
    const notes = getVal('notes', 27);

    const { lat, lng } = extractCoords(mapsUrl);

    const newPlot: LandPlot = {
      id: `plot-${Date.now()}-${assignedOrder}-${Math.random().toString(36).substring(2, 6)}`,
      orderNumber: assignedOrder,
      purchaseDate,
      saleDate,
      title,
      landType,
      subdistrict,
      district,
      province,
      primaryDeedNumber,
      mapsUrl,
      latitude: lat,
      longitude: lng,
      rai,
      ngan,
      sqWah,
      totalRai,
      totalSqWah,
      pricePerRai,
      pricePerSqWah,
      purchasePrice,
      taxAndFees,
      surveyCost,
      otherExpenses,
      totalCost,
      targetSalePrice,
      soldPrice,
      commissionFee,
      netReceived,
      status,
      notes,
      images: [],
      quickNotes: [],
      updatedAt: new Date().toISOString(),
    };

    result.plots.push(newPlot);
  }

  if (result.plots.length === 0) {
    result.errors.push('ไม่พบข้อมูลแปลงที่ดินที่สามารถอ่านได้ กรุณาตรวจสอบหัวตารางและเนื้อหา CSV');
  }

  return result;
}

/**
 * Returns a ready-to-use CSV template matching the portfolio format
 */
export function getSampleCsvTemplate(): string {
  return `"ลำดับ","วันที่ซื้อ","วันที่ขาย","รายละเอียดที่ดิน","ประเภท","ตำบล/แขวง","อำเภอ/เขต","จังหวัด","เลขที่ดิน","ตำแหน่งที่ดิน","ไร่","งาน","ตารางวา","รวมจำนวนที่ดิน(ไร่)","รวมจำนวนที่ดิน(ตร.ว.)","ไร่ละ","ตารางวาละ","ราคารวม/ราคาซื้อ","จ่ายค่าธรรมเนียม/ค่าอากร/ภาษี","จ่ายค่ารังวัด","จ่ายค่าใช้จ่ายอื่นๆ","รวมทั้งสิ้น/ทั้งหมด","ราคาที่ตั้งใจจะขาย","ราคาที่ขายได้","ค่าคอมมิชชั่น","สุทธิที่ได้รับ","สถานะ","หมายเหตุเพิ่มเติม"
1,"23/3/2569","","ที่ดินริมแม่น้ำเจ้าพระยา แปลงสวย","ที่ดินเปล่า","เกรียงไกร","เมืองนครสวรรค์","นครสวรรค์","48291","https://www.google.com/maps?q=15.7032,100.1378",5,0,0,5,2000,500000,1250,2500000,75000,15000,10000,2600000,3900000,0,0,0,"ถือครอง","ติดแม่น้ำ วิวสวย เหมาะพัฒนาจัดสรร"
2,"15/4/2569","","ที่ดินติดถนนสายเอเชีย ใกล้สี่แยก","ที่ดินเปล่า","ปากน้ำโพ","เมืองนครสวรรค์","นครสวรรค์","10342","https://www.google.com/maps?q=15.6980,100.1250",2,2,0,2.5,1000,800000,2000,2000000,60000,12000,8000,2080000,3200000,0,0,0,"กำลังประกาศขาย","หน้ากว้าง 40 เมตร ติดถนนดำ"
3,"10/1/2568","18/2/2568","อาคารพาณิชย์ 3 ชั้น ใจกลางเมือง","อาคารพาณิชย์","ปากน้ำโพ","เมืองนครสวรรค์","นครสวรรค์","55201","https://www.google.com/maps?q=15.7050,100.1410",0,0,50,0.125,50,0,36000,1800000,54000,0,6000,1860000,2500000,2500000,75000,2425000,"ขายแล้ว","ปิดการขายเรียบร้อย โอนกรรมสิทธิ์แล้ว"`;
}
