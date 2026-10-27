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
  const headerMap: { [key: string]: number } = {};

  // Scan the first 5 lines to locate the main header row containing "ลำดับ" or "วันที่ซื้อ"
  for (let scanIdx = 0; scanIdx < Math.min(rawLines.length, 6); scanIdx++) {
    const tokens = tokenizeCsvLine(rawLines[scanIdx], delimiter);
    const hasHeaderSignature = tokens.some((tok) =>
      /ลำดับ|order|วันที่ซื้อ|purchasedate|รายละเอียดที่ดิน|เลขที่ดิน/i.test(tok)
    );

    if (hasHeaderSignature) {
      tokens.forEach((header, idx) => {
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
        else if (/ขายไป.*ไร่|partiallysoldrai/.test(h)) headerMap['partiallySoldRai'] = idx;
        else if (/ขายไป.*งาน|partiallysoldngan/.test(h)) headerMap['partiallySoldNgan'] = idx;
        else if (/ขายไป.*วา|partiallysoldsqwah/.test(h)) headerMap['partiallySoldSqWah'] = idx;
        else if (/ขายไป.*ตร|ขายไป.*รวม|partiallysoldtotal/.test(h)) headerMap['partiallySoldTotalSqWah'] = idx;
        else if (/คงเหลือ|remainingsqwah|remain/.test(h)) headerMap['remainingSqWah'] = idx;
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
      lineIndex = scanIdx + 1;

      // Check if immediate next line is a sub-header (e.g. contains "ประเภท", "ไร่", "งาน", "ตารางวา")
      if (lineIndex < rawLines.length) {
        const nextTokens = tokenizeCsvLine(rawLines[lineIndex], delimiter);
        const isSubHeader = nextTokens.some((tok) => /ประเภท|ตารางวา|คงเหลือ/i.test(tok));
        if (isSubHeader) {
          lineIndex++;
        }
      }
      break;
    }
  }

  // Iterate over data rows
  let orderSequence = startOrderNumber;

  for (let i = lineIndex; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    if (!rawLine.trim()) continue;

    const cols = tokenizeCsvLine(rawLine, delimiter);
    // Ignore rows that are completely empty or just commas
    if (cols.length === 0 || cols.every((c) => !c || c === '0' || c === '-')) {
      const nonZeroCols = cols.filter((c) => c && c !== '0' && c !== '-');
      if (nonZeroCols.length === 0) continue;
    }

    result.totalRowsProcessed++;

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
    const titleVal = getVal('title', 3);
    const deedVal = getVal('primaryDeedNumber', 8);
    const mapsUrlVal = getVal('mapsUrl', 9);
    const raiVal = parseNum(getVal('rai', 10));
    const nganVal = parseNum(getVal('ngan', 11));
    const sqWahVal = parseNum(getVal('sqWah', 12));

    // Check if this row is a sub-parcel row belonging to the previous plot
    // (i.e. orderNumber is empty and title is empty, but deed or area is present)
    if (orderRaw === 0 && !titleVal && deedVal && result.plots.length > 0) {
      const lastPlot = result.plots[result.plots.length - 1];
      const spTotalSqWah = raiVal * 400 + nganVal * 100 + sqWahVal;
      const { lat: spLat, lng: spLng } = extractCoords(mapsUrlVal);

      if (!lastPlot.subParcels) {
        lastPlot.subParcels = [];
      }
      lastPlot.subParcels.push({
        id: `sp-${lastPlot.id}-${lastPlot.subParcels.length + 1}`,
        deedNumber: deedVal,
        rai: raiVal,
        ngan: nganVal,
        sqWah: sqWahVal,
        totalSqWah: spTotalSqWah,
        mapsUrl: mapsUrlVal,
        latitude: spLat,
        longitude: spLng,
        notes: getVal('notes', 31),
      });
      continue;
    }

    const assignedOrder = orderRaw > 0 ? orderRaw : orderSequence;
    orderSequence = Math.max(orderSequence, assignedOrder) + 1;

    const title = titleVal || getVal('title', 1) || `แปลงที่ดินลำดับ #${assignedOrder}`;
    const purchaseDate = getVal('purchaseDate', 1) || new Date().toLocaleDateString('th-TH');
    const saleDate = getVal('saleDate', 2);
    const landType = getVal('landType', 4) || 'ที่ดินเปล่า';
    const subdistrict = getVal('subdistrict', 5);
    const district = getVal('district', 6);
    const province = getVal('province', 7) || 'นครสวรรค์';
    const primaryDeedNumber = deedVal;
    const mapsUrl = mapsUrlVal;

    const rai = raiVal;
    const ngan = nganVal;
    const sqWah = sqWahVal;

    let totalSqWah = parseNum(getVal('totalSqWah', 14));
    if (totalSqWah === 0 && (rai > 0 || ngan > 0 || sqWah > 0)) {
      totalSqWah = rai * 400 + ngan * 100 + sqWah;
    }

    let totalRai = parseNum(getVal('totalRai', 13));
    if (totalRai === 0 && totalSqWah > 0) {
      totalRai = Number((totalSqWah / 400).toFixed(2));
    }

    // Partial sales
    const partiallySoldRai = parseNum(getVal('partiallySoldRai', 15));
    const partiallySoldNgan = parseNum(getVal('partiallySoldNgan', 16));
    const partiallySoldSqWah = parseNum(getVal('partiallySoldSqWah', 17));
    let partiallySoldTotalSqWah = parseNum(getVal('partiallySoldTotalSqWah', 18));
    if (partiallySoldTotalSqWah === 0 && (partiallySoldRai > 0 || partiallySoldNgan > 0 || partiallySoldSqWah > 0)) {
      partiallySoldTotalSqWah = partiallySoldRai * 400 + partiallySoldNgan * 100 + partiallySoldSqWah;
    }

    let remainingSqWah = parseNum(getVal('remainingSqWah', 19));
    if (remainingSqWah === 0 && partiallySoldTotalSqWah > 0) {
      remainingSqWah = totalSqWah - partiallySoldTotalSqWah;
    } else if (remainingSqWah === 0 && partiallySoldTotalSqWah === 0) {
      remainingSqWah = totalSqWah;
    }

    const pricePerRai = parseNum(getVal('pricePerRai', 20));
    const pricePerSqWah = parseNum(getVal('pricePerSqWah', 21));
    const purchasePrice = parseNum(getVal('purchasePrice', 22));
    const taxAndFees = parseNum(getVal('taxAndFees', 23));
    const surveyCost = parseNum(getVal('surveyCost', 24));
    const otherExpenses = parseNum(getVal('otherExpenses', 25));

    let totalCost = parseNum(getVal('totalCost', 26));
    if (totalCost === 0) {
      totalCost = purchasePrice + taxAndFees + surveyCost + otherExpenses;
    }

    const targetSalePrice = parseNum(getVal('targetSalePrice', 27));
    const soldPrice = parseNum(getVal('soldPrice', 28));
    const commissionFee = parseNum(getVal('commissionFee', 29));
    const netReceived = parseNum(getVal('netReceived', 30));
    const status = normalizeStatus(getVal('status', 31));
    const notes = getVal('notes', 31);

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
      partiallySoldRai,
      partiallySoldNgan,
      partiallySoldSqWah,
      partiallySoldTotalSqWah,
      remainingSqWah,
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
