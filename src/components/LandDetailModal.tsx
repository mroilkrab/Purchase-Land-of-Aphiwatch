import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  X, 
  MapPin, 
  ExternalLink, 
  Building, 
  Wallet, 
  TrendingUp, 
  Edit3, 
  Layers, 
  FileText, 
  Maximize2,
  Calculator,
  Calendar,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Tag,
  Plus,
  Send,
  Cloud,
  FolderOpen,
  UploadCloud,
  Loader2,
  Download,
  Share2,
  Sparkles,
  Percent,
  Check,
  Compass,
  Satellite,
  Map as MapIcon,
  Eye,
  FileCheck,
  FileWarning,
  ShieldCheck,
  CheckSquare,
  Square,
  Paperclip,
  Camera,
  Upload,
  Printer,
  Receipt,
  Scale
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  LandPlot, 
  PortfolioSettings, 
  LandStatus, 
  QuickNoteItem, 
  QuickNoteTag, 
  LandPlotImage,
  DocumentChecklistCategory,
  LandTaxUsageType
} from '../types/land';
import { formatCurrency, formatThaiArea, calculatePlotHoldingInfo } from '../services/storage';
import { compressImageForStorage } from '../services/dbStorage';
import { ensureLandPlotDriveFolder, uploadPlotImageToDrive } from '../services/googleDrive';
import { getAccessToken } from '../services/firebaseAuth';
import { getPlotLandTax, calculateLandTax, inferDefaultTaxUsage, TAX_USAGE_CONFIGS } from '../services/landTax';

export interface DocumentRequirement {
  id: DocumentChecklistCategory;
  title: string;
  titleEn: string;
  importance: 'mandatory' | 'required' | 'recommended';
  importanceLabel: string;
  description: string;
  legalPurpose: string;
  matcher: (img: LandPlotImage) => boolean;
}

export const REQUIRED_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'deed',
    title: 'โฉนดที่ดิน (น.ส. 4 จ. / น.ส. 3 ก.)',
    titleEn: 'Land Title Deed',
    importance: 'mandatory',
    importanceLabel: 'จำเป็นสูงสุด',
    description: 'เอกสารแสดงกรรมสิทธิ์ที่ดิน หน้า-หลังสารบัญจดทะเบียน',
    legalPurpose: 'ใช้ตรวจสอบชื่อผู้ถือกรรมสิทธิ์ ลำดับสิทธิ์ และภาระผูกพันสลักหลัง',
    matcher: (img) =>
      img.category === 'deed' ||
      img.type === 'deed' ||
      /โฉนด|นส|น\.ส|deed|title/i.test(img.title),
  },
  {
    id: 'tax_receipt',
    title: 'ใบเสร็จภาษีที่ดิน & ค่าธรรมเนียม',
    titleEn: 'Land Tax & Fee Receipt',
    importance: 'required',
    importanceLabel: 'จำเป็น',
    description: 'ใบเสร็จภาษีที่ดินและสิ่งปลูกสร้าง (ภ.ด.ส.) หรือใบเสร็จค่าธรรมเนียมการโอน',
    legalPurpose: 'ยืนยันสถานะการชำระภาษีท้องถิ่น ไม่มีค้างชำระภาษีที่ดินและสิ่งปลูกสร้าง',
    matcher: (img) =>
      img.category === 'tax_receipt' ||
      img.type === 'tax_receipt' ||
      /ภาษี|ใบเสร็จ|ธรรมเนียม|tax|receipt/i.test(img.title),
  },
  {
    id: 'survey_map',
    title: 'แผนที่รังวัด / ระวางที่ดิน',
    titleEn: 'Cadastral & Survey Map',
    importance: 'required',
    importanceLabel: 'จำเป็น',
    description: 'แผนที่ระวางทางอากาศ หรือรูปแผนที่สังเขปแสดงแนวเขตและหลักหมุดที่ดิน',
    legalPurpose: 'ตรวจสอบแนวเขตที่ดิน ทางสาธารณประโยชน์ ทางเข้า-ออก และรูปแปลง',
    matcher: (img) =>
      img.category === 'survey_map' ||
      img.type === 'cadastral' ||
      /รังวัด|ระวาง|แนวเขต|หมุด|survey|cadastral|map/i.test(img.title),
  },
  {
    id: 'contract',
    title: 'สัญญาจะซื้อจะขาย / บันทึกข้อตกลง',
    titleEn: 'Purchase & Sale Contract',
    importance: 'required',
    importanceLabel: 'จำเป็นในการซื้อขาย',
    description: 'สัญญาจะซื้อจะขาย หรือสัญญาขายฝากที่ลงนามถูกต้องพร้อมเอกสารแนบ',
    legalPurpose: 'หลักฐานทางนิติกรรม กำหนดการชำระเงิน ราคาขาย และเงื่อนไขการโอน',
    matcher: (img) =>
      img.category === 'contract' ||
      img.type === 'contract' ||
      /สัญญา|มัดจำ|ขายฝาก|contract|agreement/i.test(img.title),
  },
  {
    id: 'appraisal',
    title: 'ใบประเมินราคา / ราคาประเมินธนารักษ์',
    titleEn: 'Official Appraisal Report',
    importance: 'recommended',
    importanceLabel: 'แนะนำ',
    description: 'เอกสารราคาประเมินทุนทรัพย์ที่ดินกรมธนารักษ์ หรือรายงานบริษัทประเมิน',
    legalPurpose: 'ใช้คำนวณภาษีหัก ณ ที่จ่าย ค่าธรรมเนียมโอน และประเมินมูลค่าหลักประกัน',
    matcher: (img) =>
      img.category === 'appraisal' ||
      img.type === 'appraisal' ||
      /ประเมิน|ธนารักษ์|appraisal|valuation/i.test(img.title),
  },
  {
    id: 'id_doc',
    title: 'สำเนาบัตร ปชช. & ทะเบียนบ้านคู่สัญญา',
    titleEn: 'ID Card & House Registration',
    importance: 'recommended',
    importanceLabel: 'แนะนำ',
    description: 'สำเนาบัตรประชาชนและทะเบียนบ้านของผู้ขายและผู้ซื้อ พร้อมเซ็นรับรอง',
    legalPurpose: 'ใช้ประกอบการยื่นเรื่องจดทะเบียนสิทธิและนิติกรรม ณ สำนักงานที่ดิน',
    matcher: (img) =>
      img.category === 'id_doc' ||
      /บัตร|ประชาชน|ทะเบียนบ้าน|id\s?card|id/i.test(img.title),
  },
];

interface LandDetailModalProps {
  plot: LandPlot | null;
  onClose: () => void;
  onEdit: (plot: LandPlot) => void;
  onSimulate: (plot: LandPlot) => void;
  onDelete?: (plot: LandPlot) => void;
  onUpdatePlot?: (plot: LandPlot) => void;
  settings?: PortfolioSettings;
  user?: User | null;
  onLoginGoogle?: () => void;
}

const STATUS_STAGES: {
  status: LandStatus;
  label: string;
  percent: number;
  description: string;
  color: string;
  badgeBg: string;
}[] = [
  {
    status: 'holding',
    label: 'ถือครอง',
    percent: 25,
    description: 'ถือครองที่ดิน รอพัฒนาหรือรอจังหวะตลาด',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    status: 'for_sale',
    label: 'กำลังประกาศขาย',
    percent: 50,
    description: 'ทำการตลาด เสนอขายผ่านนายหน้าหรือสื่อออนไลน์',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    status: 'consignment',
    label: 'ติดมัดจำ / ขายฝาก',
    percent: 75,
    description: 'มีผู้ทำสัญญาวางมัดจำ หรือสัญญาขายฝากรอไถ่ถอน/หลุดจำนอง',
    color: 'amber',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    status: 'sold',
    label: 'ปิดการขายสำเร็จ',
    percent: 100,
    description: 'โอนกรรมสิทธิ์ ณ สำนักงานที่ดิน และรับเงินสุทธิครบถ้วน',
    color: 'rose',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
];

const QUICK_TAG_OPTIONS: { tag: QuickNoteTag; label: string; bg: string; text: string }[] = [
  { tag: 'observation', label: 'ข้อสังเกต', bg: 'bg-blue-500/20', text: 'text-blue-300' },
  { tag: 'visit', label: 'นัดดูที่ดิน', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  { tag: 'agent', label: 'นายหน้า', bg: 'bg-purple-500/20', text: 'text-purple-300' },
  { tag: 'urgent', label: 'ด่วน', bg: 'bg-rose-500/20', text: 'text-rose-300' },
  { tag: 'reminder', label: 'เตือนความจำ', bg: 'bg-amber-500/20', text: 'text-amber-300' },
  { tag: 'general', label: 'ทั่วไป', bg: 'bg-slate-700/40', text: 'text-slate-300' },
];

export const LandDetailModal: React.FC<LandDetailModalProps> = ({
  plot,
  onClose,
  onEdit,
  onSimulate,
  onDelete,
  onUpdatePlot,
  settings,
  user,
  onLoginGoogle,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const plotSummaryPdfRef = useRef<HTMLDivElement | null>(null);

  // Active sub-tab inside detail modal for clean screen space
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'map' | 'roi' | 'notes' | 'drive'>('overview');
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'uploaded' | 'missing'>('all');
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const [editingNoteDocId, setEditingNoteDocId] = useState<string | null>(null);
  const [tempDocNote, setTempDocNote] = useState<string>('');

  // ROI Estimator State
  const defaultSimPrice = plot?.targetSalePrice || (plot?.totalCost ? Math.round(plot.totalCost * 1.35) : 0);
  const [simulatedSalePrice, setSimulatedSalePrice] = useState<number>(defaultSimPrice);
  const [simCommissionRate, setSimCommissionRate] = useState<number>(settings?.defaultCommissionRate || 3);
  const [simTaxRate, setSimTaxRate] = useState<number>(settings?.defaultTaxRate || 2);
  const [monthlyHoldingCost, setMonthlyHoldingCost] = useState<number>(500);
  const [includeLandTaxInRoi, setIncludeLandTaxInRoi] = useState<boolean>(true);

  // Quick Land & Building Tax Editor State
  const [isEditingTax, setIsEditingTax] = useState<boolean>(false);
  const [editAppraisalPrice, setEditAppraisalPrice] = useState<number>(
    plot?.appraisalPrice || plot?.purchasePrice || 0
  );
  const [editUsageType, setEditUsageType] = useState<LandTaxUsageType>(
    plot?.taxUsageType || inferDefaultTaxUsage(plot?.landType)
  );
  const [editIsIndividual, setEditIsIndividual] = useState<boolean>(
    plot?.isIndividualOwner !== false
  );
  const [editVacantYears, setEditVacantYears] = useState<number>(
    plot?.vacantConsecutiveYears || 0
  );

  useEffect(() => {
    if (plot) {
      setEditAppraisalPrice(plot.appraisalPrice || plot.purchasePrice || 0);
      setEditUsageType(plot.taxUsageType || inferDefaultTaxUsage(plot.landType));
      setEditIsIndividual(plot.isIndividualOwner !== false);
      setEditVacantYears(plot.vacantConsecutiveYears || 0);
    }
  }, [plot]);

  // Mini Leaflet Map State
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [mapTileType, setMapTileType] = useState<'street' | 'satellite'>('satellite');
  const [newCoordinates, setNewCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Quick Notes State
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTag, setNewNoteTag] = useState<QuickNoteTag>('observation');

  // Google Drive Photos Sync State
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(plot?.driveFolderWebViewLink || null);

  useEffect(() => {
    if (plot) {
      setSimulatedSalePrice(plot.targetSalePrice || Math.round((plot.totalCost || 0) * 1.35));
      setNewCoordinates(null);
      setDriveFolderLink(plot.driveFolderWebViewLink || null);
    }
  }, [plot]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Initialize & Update Mini Leaflet Map when Tab is 'map' or 'overview'
  useEffect(() => {
    if (!plot) return;

    const lat = plot.latitude || 13.7563;
    const lng = plot.longitude || 100.5018;

    if (!mapContainerRef.current) return;

    // Destroy existing instance if container changed
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: plot.latitude && plot.longitude ? 15 : 10,
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // Tile Layer
    const tileUrl = mapTileType === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

    // Initial Marker
    const markerIcon = L.divIcon({
      className: 'custom-plot-marker',
      html: `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold font-mono text-xs shadow-lg border border-white">
            #${plot.orderNumber}
          </div>
          <div class="w-2.5 h-2.5 bg-emerald-500 -mt-1 rotate-45 border border-white"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 30],
    });

    const marker = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', (e) => {
      const position = e.target.getLatLng();
      setNewCoordinates({ lat: position.lat, lng: position.lng });
    });

    // Click anywhere on map to update coordinate pin
    map.on('click', (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      marker.setLatLng([clickLat, clickLng]);
      setNewCoordinates({ lat: clickLat, lng: clickLng });
    });

    // Invalidate size after modal render animation completes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [plot?.id, activeTab, mapTileType]);

  if (!plot) return null;

  // Holding Period Calculations vs Settings
  const holdingInfo = calculatePlotHoldingInfo(plot.purchaseDate);
  const expectedHoldingMonths = settings?.expectedHoldingPeriodMonths || 12;
  const isSold = plot.status === 'sold';
  const monthsHeld = holdingInfo.monthsHeld;
  const isOverdue = !isSold && monthsHeld > expectedHoldingMonths;
  const monthsOverdue = isOverdue ? monthsHeld - expectedHoldingMonths : 0;

  // Pipeline Status
  const currentStage = STATUS_STAGES.find((s) => s.status === plot.status) || STATUS_STAGES[0];
  const currentStatusIndex = STATUS_STAGES.findIndex((s) => s.status === plot.status);

  // Fast Status Change Handler
  const handleUpdateStatus = (newStatus: LandStatus) => {
    if (!onUpdatePlot) return;
    const updated = {
      ...plot,
      status: newStatus,
      saleDate: newStatus === 'sold' && !plot.saleDate ? new Date().toLocaleDateString('th-TH') : plot.saleDate,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updated);
    showToast(`อัปเดตสถานะเป็น: ${STATUS_STAGES.find((s) => s.status === newStatus)?.label}`);
  };

  // Save New Coordinates from Map
  const handleSaveCoordinates = () => {
    if (!newCoordinates || !onUpdatePlot) return;
    const updated: LandPlot = {
      ...plot,
      latitude: Number(newCoordinates.lat.toFixed(6)),
      longitude: Number(newCoordinates.lng.toFixed(6)),
      mapsUrl: `https://www.google.com/maps?q=${newCoordinates.lat.toFixed(6)},${newCoordinates.lng.toFixed(6)}`,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updated);
    setNewCoordinates(null);
    showToast('บันทึกพิกัดตำแหน่งใหม่ลงแปลงที่ดินเรียบร้อยแล้ว!');
  };

  // Land and Building Tax Calculation for this plot
  const landTaxCalc = getPlotLandTax(plot, monthsHeld);

  // ROI Estimator Real-time Calculations
  const testSalePrice = Number(simulatedSalePrice) || 0;
  const testTotalCost = Number(plot.totalCost) || 0;
  const testGrossProfit = testSalePrice - testTotalCost;
  const testCommission = (testSalePrice * simCommissionRate) / 100;
  const testTax = (testSalePrice * simTaxRate) / 100;
  const testHoldingCostTotal = monthsHeld * monthlyHoldingCost;
  const testHoldingLandTax = includeLandTaxInRoi ? landTaxCalc.accruedTaxForPeriod : 0;
  const testTotalCarrying = testHoldingCostTotal + testHoldingLandTax;
  const testNetProfit = testGrossProfit - testCommission - testTax - testTotalCarrying;
  const testNetRoi = testTotalCost > 0 ? (testNetProfit / testTotalCost) * 100 : 0;
  const testAnnualizedRoi = monthsHeld > 0 ? (testNetRoi / (monthsHeld / 12)) : testNetRoi;

  // Save Land and Building Tax Settings
  const handleSaveTaxInfo = () => {
    if (!onUpdatePlot) return;
    const computed = calculateLandTax({
      appraisalPrice: editAppraisalPrice,
      usageType: editUsageType,
      isIndividualOwner: editIsIndividual,
      vacantYears: editVacantYears,
      monthsHeld,
    });
    const updated: LandPlot = {
      ...plot,
      appraisalPrice: editAppraisalPrice,
      taxUsageType: editUsageType,
      isIndividualOwner: editIsIndividual,
      vacantConsecutiveYears: editVacantYears,
      annualLandTax: computed.annualTax,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updated);
    setIsEditingTax(false);
    showToast('บันทึกข้อมูลและคำนวณภาษีที่ดินและสิ่งปลูกสร้างเรียบร้อยแล้ว!');
  };

  // Save Simulated Price as Target Sale Price
  const handleApplySimulatedPrice = () => {
    if (!onUpdatePlot) return;
    const updated: LandPlot = {
      ...plot,
      targetSalePrice: testSalePrice,
      commissionFee: Math.round(testCommission),
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updated);
    showToast(`บันทึกราคาตั้งใจขายเป็น: ${formatCurrency(testSalePrice)} เรียบร้อยแล้ว!`);
  };

  // Quick Notes Handlers
  const handleAddQuickNote = () => {
    if (!newNoteText.trim() || !onUpdatePlot) return;
    const newNote: QuickNoteItem = {
      id: `qn-${Date.now()}`,
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      tag: newNoteTag,
    };
    const currentNotes = plot.quickNotes || [];
    const updatedPlot: LandPlot = {
      ...plot,
      quickNotes: [newNote, ...currentNotes],
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updatedPlot);
    setNewNoteText('');
    showToast('บันทึกโน้ตด่วนเรียบร้อยแล้ว');
  };

  const handleDeleteQuickNote = (noteId: string) => {
    if (!onUpdatePlot) return;
    const currentNotes = plot.quickNotes || [];
    const updatedNotes = currentNotes.filter((n) => n.id !== noteId);
    onUpdatePlot({
      ...plot,
      quickNotes: updatedNotes,
      updatedAt: new Date().toISOString(),
    });
    showToast('ลบโน้ตด่วนแล้ว');
  };

  // Sync / Upload Photos to Google Drive Folder
  const handleSyncPhotosToDrive = async () => {
    const token = await getAccessToken();
    if (!token) {
      if (onLoginGoogle) {
        onLoginGoogle();
      } else {
        showToast('กรุณาเข้าสู่ระบบ Google เพื่อเปิดใช้งาน Google Drive');
      }
      return;
    }

    try {
      setIsSyncingDrive(true);
      showToast('กำลังเตรียมโฟลเดอร์ใน Google Drive...');

      // 1. Ensure Folder named after this plot
      const folderRes = await ensureLandPlotDriveFolder(token, plot.orderNumber, plot.title);
      if (!folderRes) {
        throw new Error('ไม่สามารถสร้างหรือค้นหาโฟลเดอร์สำหรับแปลงนี้ใน Google Drive ได้');
      }

      setDriveFolderLink(folderRes.webViewLink);

      // 2. Upload any photos that aren't on Drive yet
      let uploadedCount = 0;
      const updatedImages: LandPlotImage[] = [];

      if (plot.images && plot.images.length > 0) {
        showToast(`กำลังอัปโหลดรูปภาพ (${plot.images.length} รูป) ไปยัง Google Drive...`);
        for (const img of plot.images) {
          if (!img.driveFileId && img.url.startsWith('data:')) {
            try {
              const res = await uploadPlotImageToDrive(
                token,
                folderRes.folderId,
                img.url,
                img.title || `photo_plot_${plot.orderNumber}`
              );
              updatedImages.push({
                ...img,
                driveFileId: res.fileId,
                driveWebViewLink: res.webViewLink,
                driveThumbnailLink: res.thumbnailLink,
              });
              uploadedCount++;
            } catch (imgErr) {
              console.warn('Skipped image upload error:', imgErr);
              updatedImages.push(img);
            }
          } else {
            updatedImages.push(img);
          }
        }
      }

      // 3. Save Folder Link & Image Drive IDs to Plot
      if (onUpdatePlot) {
        const updatedPlot: LandPlot = {
          ...plot,
          driveFolderId: folderRes.folderId,
          driveFolderWebViewLink: folderRes.webViewLink,
          images: updatedImages.length > 0 ? updatedImages : plot.images,
          updatedAt: new Date().toISOString(),
        };
        onUpdatePlot(updatedPlot);
      }

      showToast(`ซิงค์โฟลเดอร์และอัปโหลด ${uploadedCount} รูปลง Google Drive สำเร็จ!`);
    } catch (err: any) {
      console.error('Google Drive sync error:', err);
      showToast(`ข้อผิดพลาด Google Drive: ${err.message || 'ไม่สามารถซิงค์ได้'}`);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Document Checklist Handlers
  const handleUploadDocumentForRequirement = async (req: DocumentRequirement, files: FileList | null) => {
    if (!files || files.length === 0 || !onUpdatePlot) return;
    setIsUploadingDoc(req.id);
    try {
      const file = files[0];
      const compressedUrl = await compressImageForStorage(file, 1600, 0.85);
      const newImage: LandPlotImage = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        url: compressedUrl,
        title: `${req.title.split(' ')[0]} - ${file.name.replace(/\.[^/.]+$/, '')}`,
        type: req.id === 'survey_map' ? 'cadastral' : (req.id as any),
        category: req.id,
        uploadedAt: new Date().toISOString(),
      };

      const currentImages = plot.images || [];
      const currentChecklist = plot.documentChecklist || {};
      const updatedPlot: LandPlot = {
        ...plot,
        images: [...currentImages, newImage],
        documentChecklist: {
          ...currentChecklist,
          [req.id]: {
            ...(currentChecklist[req.id] || {}),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };

      onUpdatePlot(updatedPlot);
      showToast(`แนบเอกสาร "${req.title}" สำเร็จแล้ว!`);
    } catch (err) {
      console.error('Document upload error:', err);
      showToast('เกิดข้อผิดพลาดในการแนบเอกสาร');
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const handleTogglePhysicalHardCopy = (categoryId: DocumentChecklistCategory) => {
    if (!onUpdatePlot) return;
    const currentChecklist = plot.documentChecklist || {};
    const currentItemState = currentChecklist[categoryId] || {};
    const nextVal = !currentItemState.hasPhysicalHardCopy;

    const updatedPlot: LandPlot = {
      ...plot,
      documentChecklist: {
        ...currentChecklist,
        [categoryId]: {
          ...currentItemState,
          hasPhysicalHardCopy: nextVal,
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };

    onUpdatePlot(updatedPlot);
    showToast(nextVal ? 'บันทึกว่ามีฉบับจริงในแฟ้มเอกสารแล้ว' : 'ยกเลิกสถานะฉบับจริงในแฟ้ม');
  };

  const handleSaveDocNote = (categoryId: DocumentChecklistCategory) => {
    if (!onUpdatePlot) return;
    const currentChecklist = plot.documentChecklist || {};
    const currentItemState = currentChecklist[categoryId] || {};

    const updatedPlot: LandPlot = {
      ...plot,
      documentChecklist: {
        ...currentChecklist,
        [categoryId]: {
          ...currentItemState,
          note: tempDocNote.trim(),
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    };

    onUpdatePlot(updatedPlot);
    setEditingNoteDocId(null);
    showToast('บันทึกข้อความสำหรับเอกสารนี้แล้ว');
  };

  const handleDeleteAttachedDocImage = (imageId: string) => {
    if (!onUpdatePlot) return;
    const currentImages = plot.images || [];
    const updatedImages = currentImages.filter((img) => img.id !== imageId);
    const updatedPlot: LandPlot = {
      ...plot,
      images: updatedImages,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePlot(updatedPlot);
    showToast('ลบเอกสารที่แนบเรียบร้อย');
  };

  // Document Checklist Stat Computations
  const documentStatuses = REQUIRED_DOCUMENTS.map((req) => {
    const matchingImages = (plot.images || []).filter(req.matcher);
    const state = plot.documentChecklist?.[req.id] || {};
    const isUploaded = matchingImages.length > 0;
    const hasPhysical = !!state.hasPhysicalHardCopy;
    return {
      requirement: req,
      matchingImages,
      state,
      isUploaded,
      hasPhysical,
      status: isUploaded ? ('Uploaded' as const) : ('Missing' as const),
    };
  });

  const uploadedDocsCount = documentStatuses.filter((d) => d.isUploaded).length;
  const totalDocsCount = REQUIRED_DOCUMENTS.length;
  const missingDocsCount = totalDocsCount - uploadedDocsCount;
  const docCompletionPercent = Math.round((uploadedDocsCount / totalDocsCount) * 100);

  const filteredStatuses = documentStatuses.filter((item) => {
    if (checklistFilter === 'uploaded') return item.isUploaded;
    if (checklistFilter === 'missing') return !item.isUploaded;
    return true;
  });

  // Generate Individual Land Plot Summary PDF (Request 8 & Open directly)
  // Generate Individual Land Plot Summary PDF (Pure Crisp A4 Pages with Zero Text Overlap)
  const handleDownloadPlotSummaryPdf = async (action: 'open' | 'download' = 'open') => {
    setIsExportingPdf(true);
    showToast(action === 'open' ? 'กำลังประมวลผลเปิดเอกสารสรุปแปลงที่ดิน PDF ขนาด A4...' : 'กำลังจัดทำเอกสาร PDF ขนาด A4 สวยงาม...');

    try {
      // Ensure web fonts (Sarabun, Prompt, Noto Sans Thai) are 100% ready to eliminate font glyph overlaps
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 120));

      const container = plotSummaryPdfRef.current;
      if (!container) {
        throw new Error('ไม่พบเทมเพลตข้อมูลแปลงที่ดิน');
      }

      // Query all dedicated A4 page elements
      const pageElements = container.querySelectorAll<HTMLElement>('.pdf-page');
      if (!pageElements || pageElements.length === 0) {
        throw new Error('ไม่พบหน้าเอกสารสำหรับสร้าง PDF');
      }

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < pageElements.length; i++) {
        if (i > 0) {
          doc.addPage();
        }

        const pageEl = pageElements[i];
        const pageCanvas = await html2canvas(pageEl, {
          scale: 2.2, // High resolution for crisp, readable vector-like typography
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        // Add full-bleed exact 210mm x 297mm A4 page without awkward sliced text
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const cleanTitle = (plot.title || 'plot').replace(/[\s/\\:]/g, '_');
      const fileName = `สรุปแปลงที่ดิน_${plot.orderNumber}_${cleanTitle}_A4.pdf`;

      if (action === 'open') {
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const opened = window.open(blobUrl, '_blank');
        if (!opened) {
          doc.save(fileName);
          showToast('เบราว์เซอร์บล็อกหน้าต่างใหม่ จึงบันทึกไฟล์ PDF ขนาด A4 ลงเครื่องให้เรียบร้อย');
        } else {
          showToast('เปิดเอกสารสรุปแปลงที่ดิน (PDF ขนาด A4 ตัวอักษรคมชัด ไม่ซ้อนกัน) เรียบร้อยแล้ว!');
        }
      } else {
        doc.save(fileName);
        showToast('ดาวน์โหลดเอกสารสรุปแปลงที่ดิน (PDF ขนาด A4 สมบูรณ์) เรียบร้อยแล้ว!');
      }
    } catch (err: any) {
      console.warn('PDF export direct capture encountered an issue, launching print-to-PDF fallback:', err);
      showToast('กำลังเปิดหน้าต่างพิมพ์รายงาน (ท่านสามารถเลือกบันทึกเป็น PDF ขนาด A4 ได้ทันที)');
      setTimeout(() => {
        window.print();
      }, 350);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md print:static print:p-0 print:bg-transparent print:z-auto print:block">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden print:hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold flex items-center justify-center border border-emerald-500/20 text-sm">
              #{plot.orderNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 line-clamp-1">
                  {plot.title}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${currentStage.badgeBg}`}>
                  {currentStage.label}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {plot.subdistrict}, {plot.district}, {plot.province} • ประเภท: {plot.landType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onEdit(plot);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              title="เปิดหน้าต่างแก้ไขข้อมูลแปลงนี้"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>แก้ไขข้อมูล</span>
            </button>

            <button
              onClick={() => handleDownloadPlotSummaryPdf('open')}
              disabled={isExportingPdf}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              title="เปิดดูเอกสารสรุปแปลงที่ดินเป็น PDF ทันทีในเบราว์เซอร์ (รองรับทั้งมือถือและ iPad)"
            >
              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              <span>เปิดเป็น PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium items-center gap-1.5 transition-colors cursor-pointer"
              title="พิมพ์สรุปรายงานแปลงนี้ (A4)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>พิมพ์รายงาน</span>
            </button>

            <button
              onClick={() => handleDownloadPlotSummaryPdf('download')}
              disabled={isExportingPdf}
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium items-center gap-1.5 transition-colors cursor-pointer"
              title="ดาวน์โหลดไฟล์ PDF บันทึกลงเครื่อง"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>ดาวน์โหลด</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs for Screen Fit Discipline */}
        <div className="flex items-center gap-1 px-5 py-2 bg-slate-900 border-b border-slate-800 text-xs shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            ภาพรวม & ข้อมูลการเงิน
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'checklist'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>เช็คลิสต์เอกสาร</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                missingDocsCount === 0
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {uploadedDocsCount}/{totalDocsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            แผนที่ดาวเทียม & ปักหมุดพิกัด
          </button>

          <button
            onClick={() => setActiveTab('roi')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'roi'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            ประมาณการกำไร (ROI Estimator)
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'notes'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            โน้ตด่วน & ข้อสังเกต ({plot.quickNotes?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('drive')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'drive'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            Google Drive รูปภาพ
          </button>
        </div>

        {/* Modal Body Container with disciplined scroll */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 min-h-0 text-xs sm:text-sm">
          
          {/* 1. VISUAL STATUS PIPELINE PROGRESS BAR (Always visible at top of all tabs) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  ความคืบหน้าการขาย (Sales Pipeline Status)
                </span>
                <span className="text-xs text-slate-300">
                  ขั้นตอนปัจจุบัน: <strong className="text-white">{currentStage.label}</strong> ({currentStage.percent}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                คลิกที่ขั้นตอนเพื่อเปลี่ยนสถานะแปลงนี้ทันที
              </div>
            </div>

            {/* Pipeline Step Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_STAGES.map((stage, idx) => {
                const isActive = stage.status === plot.status;
                const isPassed = currentStatusIndex >= idx;

                return (
                  <button
                    key={stage.status}
                    onClick={() => handleUpdateStatus(stage.status)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40'
                        : isPassed
                        ? 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:bg-slate-800/60'
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        ขั้นที่ {idx + 1}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {stage.percent}%
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-white flex items-center gap-1">
                      {isPassed && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      <span className="line-clamp-1">{stage.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Linear Progress Bar */}
            <div className="relative h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-rose-500 transition-all duration-500"
                style={{ width: `${currentStage.percent}%` }}
              />
            </div>
          </div>

          {/* TAB 1: OVERVIEW & FINANCIALS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Holding Duration vs Expected Target */}
              <div className={`p-4 rounded-xl border ${
                isOverdue 
                  ? 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/20' 
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200">
                      ระยะเวลาถือครองจริง: <strong className="text-white">{holdingInfo.formattedDuration}</strong> ({monthsHeld} เดือน)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    เป้าหมายระบบ: {expectedHoldingMonths} เดือน {isOverdue && <span className="text-rose-400 font-bold">(เกินเป้า {monthsOverdue} เดือน)</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">วันที่ซื้อ:</span>
                    <span className="font-mono text-slate-200">{plot.purchaseDate || '-'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">วันที่ขาย:</span>
                    <span className="font-mono text-slate-200">{plot.saleDate || 'ยังไม่ขาย'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">เนื้อที่รวม:</span>
                    <span className="font-mono text-emerald-400 font-bold">{plot.totalSqWah?.toLocaleString('th-TH')} ตร.ว.</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">ต้นทุนผูกพันรวม:</span>
                    <span className="font-mono text-amber-400 font-bold">{formatCurrency(plot.totalCost)}</span>
                  </div>
                </div>
              </div>

              {/* Document Checklist Summary Card in Overview */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200 text-xs sm:text-sm">
                      ความพร้อมเอกสารสิทธิ์และนิติกรรม (Document Checklist)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">
                      แนบแล้ว <strong className={docCompletionPercent === 100 ? 'text-emerald-400' : 'text-amber-400'}>{uploadedDocsCount}/{totalDocsCount}</strong> รายการ ({docCompletionPercent}%)
                    </span>
                    <button
                      onClick={() => setActiveTab('checklist')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>เปิดเช็คลิสต์ & แนบไฟล์</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      docCompletionPercent === 100
                        ? 'bg-emerald-500'
                        : docCompletionPercent >= 50
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                        : 'bg-gradient-to-r from-amber-500 to-rose-500'
                    }`}
                    style={{ width: `${docCompletionPercent}%` }}
                  />
                </div>

                {/* Quick document status chips */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  {documentStatuses.map((item) => (
                    <div
                      key={item.requirement.id}
                      onClick={() => setActiveTab('checklist')}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                        item.isUploaded
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-950/30 hover:border-emerald-500/50'
                          : 'bg-slate-900/80 border-amber-500/30 text-slate-300 hover:bg-slate-800 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {item.isUploaded ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate text-[11px] font-medium">{item.requirement.title.split(' ')[0]}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 font-semibold ${
                        item.isUploaded ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {item.isUploaded ? 'Uploaded' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area & Deed Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    ขนาดเนื้อที่ดิน
                  </span>
                  <div className="text-xl font-bold text-white font-mono">
                    {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                  </div>
                  <div className="text-xs text-slate-400">
                    รวมทั้งหมด <span className="text-amber-400 font-bold font-mono">{plot.totalSqWah?.toLocaleString('th-TH')} ตารางวา</span>
                    {plot.totalRai > 0 && <span className="text-slate-500 ml-1">({plot.totalRai} ไร่)</span>}
                  </div>
                  {plot.partiallySoldTotalSqWah && plot.partiallySoldTotalSqWah > 0 ? (
                    <div className="pt-2 border-t border-slate-800 text-xs space-y-1">
                      <div className="text-amber-300 flex items-center justify-between">
                        <span>ขายไปบางส่วน:</span>
                        <span className="font-mono font-bold">
                          {formatThaiArea(plot.partiallySoldRai || 0, plot.partiallySoldNgan || 0, plot.partiallySoldSqWah || 0)} ({Number(plot.partiallySoldTotalSqWah ?? 0).toLocaleString('th-TH')} ตร.ว.)
                        </span>
                      </div>
                      {plot.remainingSqWah !== undefined && plot.remainingSqWah !== null && (
                        <div className="text-emerald-300 flex items-center justify-between font-semibold">
                          <span>คงเหลือปัจจุบัน:</span>
                          <span className="font-mono font-bold">
                            {formatThaiArea(Math.floor(Number(plot.remainingSqWah) / 400), Math.floor((Number(plot.remainingSqWah) % 400) / 100), (Number(plot.remainingSqWah) % 400) % 100)} ({Number(plot.remainingSqWah).toLocaleString('th-TH')} ตร.ว.)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    เลขที่ดิน & แผนที่ระบุพิกัด
                  </span>
                  <div className="text-base font-bold text-slate-200 font-mono">
                    เลขที่ดิน: {plot.primaryDeedNumber || '-'}
                  </div>
                  {plot.latitude && plot.longitude ? (
                    <div className="text-xs font-mono text-emerald-400">
                      พิกัด: {plot.latitude.toFixed(5)}° N, {plot.longitude.toFixed(5)}° E
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">ไม่ได้ระบุพิกัดแผนที่</span>
                  )}
                  {plot.mapsUrl && (
                    <a
                      href={plot.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      เปิดตำแหน่งใน Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-400" />
                  โครงสร้างต้นทุนและราคาซื้อ
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ราคาซื้อที่ดิน:</span>
                    <span className="font-mono font-semibold text-white">{formatCurrency(plot.purchasePrice)}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ค่าธรรมเนียม/ภาษี:</span>
                    <span className="font-mono text-slate-300">{formatCurrency(plot.taxAndFees)}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ค่ารังวัด:</span>
                    <span className="font-mono text-slate-300">{formatCurrency(plot.surveyCost)}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ค่าใช้จ่ายอื่นๆ:</span>
                    <span className="font-mono text-slate-300">{formatCurrency(plot.otherExpenses)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-blue-500/30 flex justify-between items-center">
                  <span className="text-xs text-blue-300 font-semibold">ต้นทุนรวมสุทธิทั้งสิ้น:</span>
                  <span className="text-base font-bold text-white font-mono">
                    {formatCurrency(plot.totalCost)}
                  </span>
                </div>
              </div>

              {/* Land and Building Tax Act B.E. 2562 Assessment Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-rose-400" />
                    <div>
                      <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                        ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TAX_USAGE_CONFIGS[landTaxCalc.usageType].badgeBg} ${TAX_USAGE_CONFIGS[landTaxCalc.usageType].badgeText}`}>
                          {TAX_USAGE_CONFIGS[landTaxCalc.usageType].shortLabel}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        คำนวณจากราคาประเมินทุนทรัพย์และการใช้ประโยชน์จริงตามกฎหมาย
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingTax(!isEditingTax)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingTax ? 'ปิดฟอร์มแก้ไข' : 'ปรับปรุงราคาประเมิน/ประเภท'}</span>
                  </button>
                </div>

                {/* Inline Tax Editor (If isEditingTax is true) */}
                {isEditingTax && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-rose-500/30 space-y-3 animate-fade-in text-xs">
                    <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                      <Scale className="w-3.5 h-3.5 text-rose-400" /> ปรับปรุงข้อมูลภาษีที่ดินและสิ่งปลูกสร้าง
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <label className="text-slate-400 block mb-1">ราคาประเมินทุนทรัพย์ที่ดิน (บาท)</label>
                        <input
                          type="number"
                          min="0"
                          value={editAppraisalPrice}
                          onChange={(e) => setEditAppraisalPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="text-slate-400 block mb-1">ประเภทการใช้ประโยชน์</label>
                        <select
                          value={editUsageType}
                          onChange={(e) => setEditUsageType(e.target.value as LandTaxUsageType)}
                          className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium cursor-pointer"
                        >
                          <option value="agricultural">เกษตรกรรม (ยกเว้น 50 ล้านแรก)</option>
                          <option value="residential_primary">ที่อยู่อาศัยหลังหลัก (ยกเว้น 50 ล้านแรก)</option>
                          <option value="residential_other">ที่อยู่อาศัยอื่น / ปล่อยเช่า (0.02% เริ่มต้น)</option>
                          <option value="commercial">พาณิชยกรรม / อื่นๆ (0.30% เริ่มต้น)</option>
                          <option value="vacant">ที่ดินรกร้างว่างเปล่า (0.30% + เพิ่มทุก 3 ปี)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex sm:flex-col justify-end">
                        <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer text-xs select-none">
                          <input
                            type="checkbox"
                            checked={editIsIndividual}
                            onChange={(e) => setEditIsIndividual(e.target.checked)}
                            className="w-4 h-4 rounded text-rose-500 bg-slate-700 border-slate-600 focus:ring-rose-500"
                          />
                          <span className="text-slate-200">บุคคลธรรมดา</span>
                        </label>
                      </div>

                      {editUsageType === 'vacant' && (
                        <div className="sm:col-span-12 flex items-center justify-between p-2 rounded bg-rose-950/40 border border-rose-800/40">
                          <span className="text-rose-200 text-xs">ทิ้งไว้ว่างเปล่าติดต่อกันกี่ปี (บวก 0.3% ทุก 3 ปี):</span>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={editVacantYears}
                            onChange={(e) => setEditVacantYears(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-white font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsEditingTax(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTaxInfo}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึกข้อมูลภาษีที่ดิน</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Tax Display Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ราคาประเมินทุนทรัพย์:</span>
                    <span className="font-mono font-semibold text-white">
                      {formatCurrency(landTaxCalc.appraisalPrice)}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">สิทธิยกเว้นฐานภาษี:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {landTaxCalc.exemptionAmount > 0 ? formatCurrency(landTaxCalc.exemptionAmount) : '-'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ฐานภาษีสุทธิ (Taxable):</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {formatCurrency(landTaxCalc.taxableBase)}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">อัตราภาษีแท้จริง:</span>
                    <span className="font-mono text-rose-300 font-semibold">
                      {landTaxCalc.effectiveRatePercent.toFixed(3)}%
                    </span>
                  </div>
                </div>

                {/* Annual & Accrued Totals Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-rose-300 font-semibold block">
                      ภาระภาษีที่ดินและสิ่งปลูกสร้างต่อปี (Annual Land Tax):
                    </span>
                    <div className="text-xl font-bold font-mono text-white mt-0.5 flex items-baseline gap-2">
                      {landTaxCalc.annualTax === 0 ? (
                        <span className="text-emerald-400">0 ฿ / ปี</span>
                      ) : (
                        <span className="text-rose-300">{formatCurrency(landTaxCalc.annualTax)} / ปี</span>
                      )}
                      <span className="text-xs font-normal text-slate-400">
                        (เฉลี่ย {formatCurrency(landTaxCalc.monthlyTax)} / เดือน)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {landTaxCalc.lawNote}
                    </p>
                  </div>

                  <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <span className="text-[11px] text-slate-400 block">
                      ภาษีที่ดินสะสมตามระยะถือครอง ({monthsHeld} เดือน):
                    </span>
                    <span className="text-base font-bold text-rose-300 font-mono">
                      {formatCurrency(landTaxCalc.accruedTaxForPeriod)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Selling Price & KPI */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ราคาที่ตั้งใจจะขาย (KPI Target) & ประมาณการกำไร
                  </h4>
                  <button
                    onClick={() => setActiveTab('roi')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" /> ทดสอบประมาณการ ROI
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900 p-3 rounded-lg border border-emerald-500/20">
                    <span className="text-slate-400 text-xs block">ราคาตั้งใจขาย:</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : 'ยังไม่ระบุ'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-xs block">กำไรคาดหวัง:</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {plot.targetSalePrice > plot.totalCost ? `+${formatCurrency(plot.targetSalePrice - plot.totalCost)}` : '-'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-xs block">คาดการณ์ ROI %:</span>
                    <span className="text-lg font-bold text-emerald-300 font-mono">
                      {plot.totalCost > 0 && plot.targetSalePrice > 0
                        ? `${(((plot.targetSalePrice - plot.totalCost) / plot.totalCost) * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-parcels (if any) */}
              {plot.subParcels && plot.subParcels.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    โฉนดย่อยในแปลงนี้ ({plot.subParcels.length} โฉนด)
                  </h4>
                  <div className="space-y-2">
                    {plot.subParcels.map((sp, idx) => (
                      <div
                        key={sp.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="text-slate-500 font-mono mr-2">#{idx + 1}</span>
                          <span className="font-mono text-emerald-400 font-semibold mr-2">โฉนด {sp.deedNumber}</span>
                          <span className="text-slate-400">({sp.notes || 'แปลงย่อย'})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-300">
                            {formatThaiArea(sp.rai, sp.ngan, sp.sqWah)} ({sp.totalSqWah} ตร.ว.)
                          </span>
                          {sp.mapsUrl && (
                            <a
                              href={sp.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 p-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Preview Row */}
              {plot.images && plot.images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-200 text-xs">
                      รูปภาพโฉนดและสถานที่ ({plot.images.length} รูป)
                    </h4>
                    <button
                      onClick={() => setActiveTab('drive')}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5" /> จัดเก็บใน Google Drive
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {plot.images.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => setSelectedImage(img.url)}
                        className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video cursor-pointer"
                      >
                        <img
                          src={img.url}
                          alt={img.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DOCUMENT CHECKLIST (Track required files: Title Deed, Tax Receipt, Survey Map, etc.) */}
          {activeTab === 'checklist' && (
            <div className="space-y-5">
              {/* Checklist Header & Completeness Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                          รายการตรวจสอบเอกสารสิทธิ์และนิติกรรม (Document Checklist)
                        </h3>
                        <p className="text-xs text-slate-400">
                          ตรวจสอบสถานะเอกสารสำคัญทางกฎหมายสำหรับแปลง #{plot.orderNumber} ({plot.title}) เพื่อความพร้อมในการโอน ซื้อขาย หรือทำสัญญา
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {driveFolderLink ? (
                      <a
                        href={driveFolderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="เปิดโฟลเดอร์ Google Drive ของแปลงนี้เพื่อดูเอกสารและภาพถ่ายทั้งหมด"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>เปิด Drive แปลงนี้</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => setActiveTab('drive')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Cloud className="w-3.5 h-3.5 text-blue-400" />
                        <span>ซิงค์ขึ้น Google Drive</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar and metrics */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-300 font-medium">
                        ความสมบูรณ์ของเอกสาร: <strong className={`font-mono text-sm ${docCompletionPercent === 100 ? 'text-emerald-400' : docCompletionPercent >= 50 ? 'text-cyan-400' : 'text-amber-400'}`}>{docCompletionPercent}%</strong>
                      </span>
                      <span className="text-slate-400 ml-2">
                        (แนบแล้ว {uploadedDocsCount} จากทั้งหมด {totalDocsCount} รายการ)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Uploaded: {uploadedDocsCount}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-semibold border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Missing: {missingDocsCount}
                      </span>
                    </div>
                  </div>

                  <div className="relative h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        docCompletionPercent === 100
                          ? 'bg-emerald-500'
                          : docCompletionPercent >= 50
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                          : 'bg-gradient-to-r from-amber-500 to-rose-500'
                      }`}
                      style={{ width: `${docCompletionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 text-xs pt-1 overflow-x-auto">
                  <span className="text-slate-400 mr-1 text-[11px]">ตัวกรอง:</span>
                  <button
                    onClick={() => setChecklistFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      checklistFilter === 'all'
                        ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    ทั้งหมด ({totalDocsCount})
                  </button>
                  <button
                    onClick={() => setChecklistFilter('uploaded')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      checklistFilter === 'uploaded'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    แนบแล้ว (Uploaded - {uploadedDocsCount})
                  </button>
                  <button
                    onClick={() => setChecklistFilter('missing')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      checklistFilter === 'missing'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ยังไม่แนบ (Missing - {missingDocsCount})
                  </button>
                </div>
              </div>

              {/* Checklist Items List */}
              <div className="space-y-3.5">
                {filteredStatuses.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500">
                    ไม่พบรายการเอกสารในตัวกรองนี้
                  </div>
                ) : (
                  filteredStatuses.map((item, idx) => {
                    const isUploadingThis = isUploadingDoc === item.requirement.id;
                    const importanceStyle = 
                      item.requirement.importance === 'mandatory'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : item.requirement.importance === 'required'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';

                    return (
                      <div
                        key={item.requirement.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          item.isUploaded
                            ? 'bg-slate-950/70 border-emerald-500/30 shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top Row: Title, Importance, and Uploaded/Missing Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              item.isUploaded
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}>
                              {item.isUploaded ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <FileWarning className="w-5 h-5 text-amber-400" />
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-slate-500 font-bold">
                                  #{idx + 1}
                                </span>
                                <h4 className="font-bold text-white text-sm sm:text-base">
                                  {item.requirement.title}
                                </h4>
                                <span className="text-xs font-mono text-slate-400">
                                  ({item.requirement.titleEn})
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${importanceStyle}`}>
                                  {item.requirement.importanceLabel}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {item.requirement.description}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                <span className="text-slate-400 font-medium">ความสำคัญทางกฎหมาย:</span> {item.requirement.legalPurpose}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 flex items-center gap-2">
                            {item.isUploaded ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>แนบแล้ว (Uploaded)</span>
                                <span className="text-[11px] font-normal text-emerald-400/80 font-mono">
                                  [{item.matchingImages.length} ไฟล์]
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs shadow-sm">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>ยังไม่แนบ (Missing)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Attached Files Thumbnails or Direct Upload Button */}
                        <div className="pt-3 border-t border-slate-800/80 space-y-3">
                          {item.matchingImages.length > 0 ? (
                            <div className="space-y-2">
                              <span className="text-[11px] text-slate-400 font-medium block">
                                เอกสารที่แนบไว้ ({item.matchingImages.length} ไฟล์):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {item.matchingImages.map((img) => (
                                  <div
                                    key={img.id}
                                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2.5 group hover:border-slate-700 transition-colors"
                                  >
                                    <div
                                      onClick={() => setSelectedImage(img.url)}
                                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                                    >
                                      <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative">
                                        <img
                                          src={img.url}
                                          alt={img.title}
                                          className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Maximize2 className="w-3 h-3 text-white" />
                                        </div>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-200 truncate">
                                          {img.title}
                                        </p>
                                        <span className="text-[10px] text-slate-500 font-mono block">
                                          {new Date(img.uploadedAt).toLocaleDateString('th-TH')}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => setSelectedImage(img.url)}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        title="ขยายดูภาพขนาดเต็ม"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      {img.driveWebViewLink && (
                                        <a
                                          href={img.driveWebViewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title="เปิดดูใน Google Drive"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                      <button
                                        onClick={() => handleDeleteAttachedDocImage(img.id)}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        title="ลบเอกสารนี้"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Upload Another File Button */}
                              <div className="pt-1">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-semibold cursor-pointer transition-colors">
                                  {isUploadingThis ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                      <span>กำลังประมวลผล...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>+ แนบไฟล์เพิ่มเติม</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    disabled={isUploadingThis}
                                    onChange={(e) => handleUploadDocumentForRequirement(item.requirement, e.target.files)}
                                  />
                                </label>
                              </div>
                            </div>
                          ) : (
                            /* Missing State: Clear Actionable Prompt to Upload Directly */
                            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-xs text-slate-300">
                                  ยังไม่มีไฟล์สำหรับรายการนี้ กรุณาถ่ายภาพหรืออัปโหลดสแกนเอกสาร
                                </span>
                              </div>

                              <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 cursor-pointer transition-all shrink-0">
                                {isUploadingThis ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>กำลังบันทึกไฟล์...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>+ แนบไฟล์เอกสารนี้</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  disabled={isUploadingThis}
                                  onChange={(e) => handleUploadDocumentForRequirement(item.requirement, e.target.files)}
                                />
                              </label>
                            </div>
                          )}

                          {/* Bottom Row: Physical Hard Copy Tracking & Notes */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-slate-900">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={item.hasPhysical}
                                onChange={() => handleTogglePhysicalHardCopy(item.requirement.id)}
                                className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                              />
                              <span className={item.hasPhysical ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                                มีเอกสารฉบับจริงในแฟ้มเอกสาร (Physical hard copy)
                              </span>
                            </label>

                            {/* Note / Remarks for this requirement */}
                            <div className="flex items-center gap-2">
                              {editingNoteDocId === item.requirement.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={tempDocNote}
                                    onChange={(e) => setTempDocNote(e.target.value)}
                                    placeholder="เช่น ต้นฉบับอยู่ที่สาขาธนาคาร..."
                                    className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
                                  />
                                  <button
                                    onClick={() => handleSaveDocNote(item.requirement.id)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    บันทึก
                                  </button>
                                  <button
                                    onClick={() => setEditingNoteDocId(null)}
                                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {item.state.note && (
                                    <span className="text-[11px] text-slate-300 italic max-w-xs truncate">
                                      บันทึก: "{item.state.note}"
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingNoteDocId(item.requirement.id);
                                      setTempDocNote(item.state.note || '');
                                    }}
                                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>{item.state.note ? 'แก้ไขบันทึก' : '+ เพิ่มบันทึกช่วยจำ'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MINI LEAFLET MAP & INTERACTIVE CLICK-TO-PIN (Request 3) */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    แผนที่เชิงโต้ตอบ: คลิกบนแผนที่เพื่ออัปเดตและบันทึกพิกัดใหม่
                  </h3>
                  <p className="text-xs text-slate-400">
                    คลิกตำแหน่งใดก็ได้บนแผนที่เพื่อย้ายหมุด จากนั้นกดปุ่มบันทึกพิกัดเพื่ออัปเดตลงระบบทันที
                  </p>
                </div>

                {/* Satellite / Street Switcher */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setMapTileType('satellite')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      mapTileType === 'satellite'
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Satellite className="w-3.5 h-3.5" /> ดาวเทียม
                  </button>
                  <button
                    onClick={() => setMapTileType('street')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      mapTileType === 'street'
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" /> แผนที่ถนน
                  </button>
                </div>
              </div>

              {/* Mini Map Container */}
              <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-700 shadow-xl">
                <div ref={mapContainerRef} className="w-full h-full z-10" />

                {/* Overlay Pin Information & Action Bar */}
                <div className="absolute top-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 text-xs shadow-lg space-y-1 max-w-[280px]">
                  <div className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    พิกัดปัจจุบัน:
                  </div>
                  <div className="font-mono font-bold text-white">
                    {plot.latitude && plot.longitude
                      ? `${plot.latitude.toFixed(6)}, ${plot.longitude.toFixed(6)}`
                      : 'ยังไม่ได้ระบุพิกัด'}
                  </div>
                </div>

                {newCoordinates && (
                  <div className="absolute bottom-3 left-3 right-3 z-20 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-cyan-500/60 text-xs shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div>
                      <span className="font-bold text-cyan-300 block">
                        📍 ตำแหน่งใหม่ที่คลิกเลือก:
                      </span>
                      <span className="font-mono text-white text-xs">
                        Lat: {newCoordinates.lat.toFixed(6)}° N, Lng: {newCoordinates.lng.toFixed(6)}° E
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveCoordinates}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/30 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> บันทึกพิกัดใหม่นี้
                      </button>
                      <button
                        onClick={() => setNewCoordinates(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ROI ESTIMATOR (Request 5) */}
          {activeTab === 'roi' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      เครื่องมือประมาณการผลตอบแทนการขาย (ROI Estimator)
                    </h3>
                    <p className="text-xs text-slate-400">
                      ปรับเปลี่ยนราคาขายเพื่อคำนวณกำไรสุทธิ ค่าคอมมิชชั่น ภาษีโอน และผลกระทบจากค่าถือครองทันที
                    </p>
                  </div>
                  <button
                    onClick={handleApplySimulatedPrice}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer self-start sm:self-auto"
                  >
                    <Check className="w-3.5 h-3.5" /> บันทึกเป็นราคาตั้งใจขาย
                  </button>
                </div>

                {/* Simulated Price Input & Slider */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">ราคาขายที่ต้องการทดสอบ (Simulated Sale Price):</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      {formatCurrency(testSalePrice)}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={testTotalCost || 100000}
                    max={Math.max((testTotalCost || 100000) * 3, 20000000)}
                    step={50000}
                    value={testSalePrice}
                    onChange={(e) => setSimulatedSalePrice(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />

                  {/* Preset Multipliers */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-slate-500">ทางลัดกำไร:</span>
                    {[15, 25, 35, 50, 75, 100].map((pct) => {
                      const priceForPct = Math.round(testTotalCost * (1 + pct / 100));
                      return (
                        <button
                          key={pct}
                          onClick={() => setSimulatedSalePrice(priceForPct)}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono transition-colors cursor-pointer"
                        >
                          +{pct}% ({formatCurrency(priceForPct)})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Variable Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <label className="text-slate-400 block font-medium">ค่าคอมมิชชั่นนายหน้า (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={simCommissionRate}
                      onChange={(e) => setSimCommissionRate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">ยอดหัก: {formatCurrency(testCommission)}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <label className="text-slate-400 block font-medium">ค่าธรรมเนียมโอน & ภาษี (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={simTaxRate}
                      onChange={(e) => setSimTaxRate(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">ยอดหัก: {formatCurrency(testTax)}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <label className="text-slate-400 block font-medium">ค่าถือครอง/ดูแล (บาท/เดือน)</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={monthlyHoldingCost}
                      onChange={(e) => setMonthlyHoldingCost(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-500">สะสม {monthsHeld} ด.: {formatCurrency(testHoldingCostTotal)}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-rose-500/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-rose-300 font-medium flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-rose-400" /> ภาษีที่ดินฯ (พ.ร.บ. 2562)
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeLandTaxInRoi}
                          onChange={(e) => setIncludeLandTaxInRoi(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-rose-500 bg-slate-700"
                        />
                        <span className="text-[10px] text-slate-400">หักใน ROI</span>
                      </label>
                    </div>
                    <div className="text-xs font-mono font-bold text-rose-300 pt-0.5">
                      {formatCurrency(landTaxCalc.annualTax)} / ปี
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      สะสม {monthsHeld} ด.: {formatCurrency(landTaxCalc.accruedTaxForPeriod)}
                    </span>
                  </div>
                </div>

                {/* Instant Calculation Output Card */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/30 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">กำไรขั้นต้น (Gross):</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {testGrossProfit > 0 ? `+${formatCurrency(testGrossProfit)}` : formatCurrency(testGrossProfit)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">หักค่าใช้จ่ายขายรวม:</span>
                      <span className="font-mono font-bold text-rose-400 text-sm">
                        -{formatCurrency(testCommission + testTax + testTotalCarrying)}
                      </span>
                      {includeLandTaxInRoi && testHoldingLandTax > 0 && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          (รวมภาษีที่ดิน {formatCurrency(testHoldingLandTax)})
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-emerald-400 block font-semibold">กำไรสุทธิคาดการณ์:</span>
                      <span className="font-mono font-bold text-emerald-300 text-base">
                        {testNetProfit > 0 ? `+${formatCurrency(testNetProfit)}` : formatCurrency(testNetProfit)}
                      </span>
                    </div>

                    <div>
                      <span className="text-cyan-400 block font-semibold">ผลตอบแทนสุทธิ (Net ROI):</span>
                      <span className="font-mono font-bold text-cyan-300 text-base">
                        {testNetRoi.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        (~{testAnnualizedRoi.toFixed(1)}% ต่อปี)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUICK NOTES & REMINDERS */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Add Note Bar */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  เพิ่มโน้ตด่วน หรือบันทึกข้อสังเกตแปลงนี้
                </h4>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">ป้ายกำกับ:</span>
                  {QUICK_TAG_OPTIONS.map((tagOpt) => (
                    <button
                      key={tagOpt.tag}
                      type="button"
                      onClick={() => setNewNoteTag(tagOpt.tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        newNoteTag === tagOpt.tag
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : `${tagOpt.bg} ${tagOpt.text} hover:opacity-80`
                      }`}
                    >
                      {tagOpt.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuickNote()}
                    placeholder="พิมพ์บันทึก เช่น นายหน้านัดดูที่ดินวันศุกร์นี้, มีเสาไฟขวางหน้าแปลง..."
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleAddQuickNote}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> บันทึก
                  </button>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-2">
                {(!plot.quickNotes || plot.quickNotes.length === 0) ? (
                  <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500">
                    ยังไม่มีบันทึกด่วนสำหรับแปลงนี้ คุณสามารถเพิ่มโน้ตนัดหมายหรือข้อสังเกตได้ทันที
                  </div>
                ) : (
                  plot.quickNotes.map((note) => {
                    const tagOpt = QUICK_TAG_OPTIONS.find((t) => t.tag === note.tag) || QUICK_TAG_OPTIONS[5];
                    const dateFormatted = new Date(note.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tagOpt.bg} ${tagOpt.text}`}>
                              {tagOpt.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {dateFormatted}
                            </span>
                          </div>
                          <p className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap">
                            {note.text}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteQuickNote(note.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="ลบโน้ตนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: GOOGLE DRIVE PHOTOS ORGANIZER (Requests 4 & 6) */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-400" />
                      โฟลเดอร์รูปภาพใน Google Drive ประจำแปลงนี้
                    </h3>
                    <p className="text-xs text-slate-400">
                      ระบบจะจัดกลุ่มรูปภาพแยกเป็นโฟลเดอร์ตามชื่อของแต่ละแปลงใน Google Drive เพื่อให้เปิดดูและแชร์ได้สะดวก
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncPhotosToDrive}
                      disabled={isSyncingDrive}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      {isSyncingDrive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังซิงค์ Drive...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>ซิงค์รูปทั้งหมดขึ้น Google Drive</span>
                        </>
                      )}
                    </button>

                    {driveFolderLink && (
                      <a
                        href={driveFolderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-blue-400" />
                        <span>เปิดดูโฟลเดอร์ใน Google Drive</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>ชื่อโฟลเดอร์ใน Drive:</span>
                  <span className="text-cyan-400 font-semibold">[แปลงที่ {plot.orderNumber.toString().padStart(2, '0')}] {plot.title}</span>
                </div>
              </div>

              {/* Photo Gallery with Google Drive Links */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs">
                  รายการรูปภาพของแปลงนี้ ({plot.images?.length || 0} รูป)
                </h4>

                {(!plot.images || plot.images.length === 0) ? (
                  <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500">
                    แปลงนี้ยังไม่มีรูปภาพแนบ คุณสามารถกด "แก้ไขข้อมูล" เพื่ออัปโหลดรูปภาพโฉนดหรือภาพถ่ายแปลง
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {plot.images.map((img) => (
                      <div
                        key={img.id}
                        className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video"
                      >
                        <img
                          src={img.url}
                          alt={img.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2 text-center">
                          <button
                            onClick={() => setSelectedImage(img.url)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3 h-3" /> ขยายภาพ
                          </button>
                          {img.driveWebViewLink && (
                            <a
                              href={img.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Cloud className="w-3 h-3" /> ดูบน Drive <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onSimulate(plot);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              คำนวณ KPI เต็มรูปแบบ
            </button>

            {onDelete && (
              <div>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ลบแปลง
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-rose-950/60 p-1 px-2.5 rounded-xl border border-rose-800/80">
                    <span className="text-[11px] text-rose-300 font-medium">ยืนยันลบ?</span>
                    <button
                      onClick={() => {
                        onClose();
                        onDelete(plot);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      ลบ
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onEdit(plot);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30 transition-all"
            >
              <Edit3 className="w-4 h-4" />
              แก้ไขข้อมูล
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Zooming Images */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white bg-slate-800 rounded-full hover:bg-slate-700"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            alt="Enlarged Deed Document"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Mini Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-60 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold shadow-2xl animate-fade-in border border-emerald-400/30">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 100% Pure Thai Printable Document Template for jsPDF and Browser Print */}
      <div
        ref={plotSummaryPdfRef}
        id="printable-plot-summary"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '0',
          width: '794px',
          minWidth: '794px',
          maxWidth: '794px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          zIndex: -9999,
          pointerEvents: 'none',
          visibility: 'visible',
          opacity: 1,
        }}
      >
        {/* ========================================================================= */}
        {/* PAGE 1: ข้อมูลที่ดิน การเงิน ต้นทุน ภาษีที่ดิน และผลตอบแทน (หน้า 1 จาก 2) */}
        {/* ========================================================================= */}
        <div
          className="pdf-page"
          style={{
            width: '794px',
            height: '1123px',
            minHeight: '1123px',
            maxHeight: '1123px',
            boxSizing: 'border-box',
            padding: '28px 34px 22px 34px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: "'Sarabun', 'Prompt', 'Noto Sans Thai', -apple-system, sans-serif",
            lineHeight: 1.55,
            letterSpacing: 'normal',
            wordBreak: 'break-word',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Header Block */}
            <div style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '12px 18px', borderRadius: '8px', border: '2px solid #0f172a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#047857', fontSize: '10.5px', fontWeight: 'bold' }}>
                    เอกสารสรุปข้อมูลแปลงที่ดินและการเงิน • พอร์ตโฟลิโอการลงทุนที่ดิน
                  </div>
                  <h1 style={{ fontSize: '17px', fontWeight: 'bold', margin: '2px 0 0 0', color: '#000000', lineHeight: 1.3 }}>
                    แปลงลำดับที่ #{plot.orderNumber}: {plot.title}
                  </h1>
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px', color: '#334155' }}>
                  <div>สถานะ: <span style={{ color: '#000000', fontWeight: 'bold' }}>{currentStage.label}</span></div>
                  <div>วันที่ออกเอกสาร: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #cbd5e1', fontSize: '10px', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <div>เจ้าของพอร์ต: <span style={{ fontWeight: 'bold', color: '#000000' }}>{settings?.ownerName || 'คุณอภิวัชร์'}</span> • ชื่อพอร์ต: {settings?.portfolioTitle || 'การลงทุนที่ดิน'}</div>
                <div>รหัสแปลง: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>PLOT-{String(plot.orderNumber).padStart(3, '0')}</span></div>
              </div>
            </div>

            {/* Section 1: ข้อมูลทำเลที่ตั้งและลักษณะแปลงที่ดิน */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                📍 1. ข้อมูลทำเลที่ตั้งและลักษณะทางกายภาพ
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '10px' }}>
                <div><span style={{ color: '#64748b' }}>ทำเลที่ตั้ง:</span> <strong>ตำบล{plot.subdistrict || '-'} อำเภอ{plot.district || '-'} จังหวัด{plot.province || '-'}</strong></div>
                <div><span style={{ color: '#64748b' }}>ประเภทการใช้ประโยชน์:</span> <strong>{plot.landType || '-'}</strong></div>
                <div><span style={{ color: '#64748b' }}>เลขที่โฉนด / เอกสารสิทธิ์:</span> <strong style={{ color: '#047857' }}>{plot.primaryDeedNumber || '-'}</strong></div>
                <div><span style={{ color: '#64748b' }}>เนื้อที่ดินรวม:</span> <strong style={{ color: '#047857' }}>{formatThaiArea(plot.rai, plot.ngan, plot.sqWah)} ({(plot.totalSqWah || 0).toLocaleString()} ตร.ว. / {plot.totalRai || 0} ไร่)</strong></div>
                <div><span style={{ color: '#64748b' }}>พิกัดดาวเทียม (GPS):</span> <strong>{plot.latitude && plot.longitude ? `${plot.latitude.toFixed(5)}, ${plot.longitude.toFixed(5)}` : 'ระบุในแผนที่'}</strong></div>
                <div><span style={{ color: '#64748b' }}>ระยะเวลาถือครอง:</span> <strong>{holdingInfo.formattedDuration} ({monthsHeld} เดือน)</strong></div>
              </div>
            </div>

            {/* Section 2: โครงสร้างต้นทุนการได้มา (Acquisition Cost) */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                💰 2. บัญชีโครงสร้างต้นทุนการได้มา (Acquisition Cost Breakdown)
              </h3>
              <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3px 0', color: '#475569' }}>ราคาซื้อที่ดินตามสัญญา:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(plot.purchasePrice)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3px 0', color: '#475569' }}>ค่าธรรมเนียมโอน / ค่าภาษีโอน / อากรแสตมป์:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(plot.taxAndFees)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3px 0', color: '#475569' }}>ค่าใช้จ่ายการรังวัดสอบเขตที่ดิน:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(plot.surveyCost)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '3px 0', color: '#475569' }}>ค่าพัฒนา ถมดิน ปรับพื้นที่ และค่าใช้จ่ายอื่น:</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(plot.otherExpenses)}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold', fontSize: '10.5px' }}>
                    <td style={{ padding: '4px 6px', color: '#0f172a' }}>รวมต้นทุนสุทธิทั้งสิ้น (Total Acquisition Cost):</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', color: '#0f172a' }}>
                      {formatCurrency(plot.totalCost)} ({plot.totalSqWah > 0 ? Math.round(plot.totalCost / plot.totalSqWah).toLocaleString() : 0} บาท/ตร.ว.)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: ภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. 2562) */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                <h3 style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  ⚖️ 3. การประเมินภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. 2562)
                </h3>
                <span style={{ fontSize: '9.5px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold' }}>
                  {TAX_USAGE_CONFIGS[landTaxCalc.usageType]?.shortLabel || landTaxCalc.usageType}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '10px' }}>
                <div><span style={{ color: '#64748b' }}>ราคาประเมินทุนทรัพย์:</span> <strong>{formatCurrency(landTaxCalc.appraisalPrice)}</strong></div>
                <div><span style={{ color: '#64748b' }}>สิทธิยกเว้นตามกฎหมาย:</span> <strong>{landTaxCalc.exemptionAmount > 0 ? formatCurrency(landTaxCalc.exemptionAmount) : 'ไม่มีการยกเว้น'}</strong></div>
                <div><span style={{ color: '#64748b' }}>ฐานภาษีสุทธิที่ต้องคำนวณ:</span> <strong>{formatCurrency(landTaxCalc.taxableBase)}</strong></div>
                <div><span style={{ color: '#64748b' }}>อัตราภาษีที่แท้จริง (Effective Rate):</span> <strong>{landTaxCalc.effectiveRatePercent.toFixed(2)}%</strong></div>
                <div>
                  <span style={{ color: '#64748b' }}>ภาษีประจำปี:</span>{' '}
                  <strong style={{ color: landTaxCalc.annualTax > 0 ? '#b91c1c' : '#15803d' }}>
                    {formatCurrency(landTaxCalc.annualTax)} / ปี (เฉลี่ย {formatCurrency(landTaxCalc.monthlyTax)} / ด.)
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>ภาษีสะสมช่วงถือครอง ({monthsHeld} เดือน):</span>{' '}
                  <strong style={{ color: landTaxCalc.accruedTaxForPeriod > 0 ? '#b91c1c' : '#15803d' }}>
                    {formatCurrency(landTaxCalc.accruedTaxForPeriod)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 4: เป้าหมายการขาย ผลตอบแทนสุทธิ และกำไรคาดการณ์ */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                📈 4. การคาดการณ์ผลตอบแทนและกำไรสุทธิ (ROI & Financial Waterfall)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '10px' }}>
                <div><span style={{ color: '#64748b' }}>ราคาเป้าหมายตั้งใจขาย (Target Sale):</span> <strong style={{ color: '#047857' }}>{plot.targetSalePrice > 0 ? formatCurrency(plot.targetSalePrice) : 'ยังไม่ระบุ'}</strong></div>
                <div><span style={{ color: '#64748b' }}>ต้นทุนถือครองและภาษีที่ดินสะสม:</span> <strong>{formatCurrency(testTotalCarrying)}</strong></div>
                <div>
                  <span style={{ color: '#64748b' }}>กำไรสุทธิคาดการณ์ (Net Profit):</span>{' '}
                  <strong style={{ color: '#047857' }}>
                    +{formatCurrency(testNetProfit)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>อัตราผลตอบแทนสุทธิ (% Net ROI):</span>{' '}
                  <strong style={{ color: '#047857' }}>
                    +{testNetRoi.toFixed(1)}%
                  </strong>
                </div>
                {plot.status === 'sold' && (
                  <>
                    <div><span style={{ color: '#64748b' }}>ราคาขายจริงที่ปิดการขาย:</span> <strong style={{ color: '#000000' }}>{formatCurrency(plot.soldPrice)}</strong></div>
                    <div><span style={{ color: '#64748b' }}>ยอดเงินสุทธิที่ได้รับจริง:</span> <strong style={{ color: '#047857' }}>{formatCurrency(plot.netReceived)}</strong></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer Page 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #cbd5e1' }}>
            <div>ระบบบริหารจัดการพอร์ตการลงทุนที่ดิน (Land Portfolio Management)</div>
            <div>เอกสารทางการสรุปข้อมูลแปลงที่ดิน • ออกเมื่อ {new Date().toLocaleDateString('th-TH')}</div>
            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>หน้า 1 จาก 2 (Page 1 of 2)</div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PAGE 2: รายการตรวจสอบเอกสารสิทธิ์ โฉนดย่อย และการลงนาม (หน้า 2 จาก 2)    */}
        {/* ========================================================================= */}
        <div
          className="pdf-page"
          style={{
            width: '794px',
            height: '1123px',
            minHeight: '1123px',
            maxHeight: '1123px',
            boxSizing: 'border-box',
            padding: '28px 34px 22px 34px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: "'Sarabun', 'Prompt', 'Noto Sans Thai', -apple-system, sans-serif",
            lineHeight: 1.55,
            letterSpacing: 'normal',
            wordBreak: 'break-word',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Page 2 Header */}
            <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #0f172a', borderRadius: '8px', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#047857', fontWeight: 'bold' }}>ส่วนที่ 2: การตรวจสอบเอกสารสิทธิ์ บันทึก และการลงนาม</span>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000000' }}>
                  แปลงลำดับที่ #{plot.orderNumber}: {plot.title} (โฉนดเลขที่ {plot.primaryDeedNumber || '-'})
                </div>
              </div>
              <div style={{ fontSize: '9.5px', color: '#475569', textAlign: 'right' }}>
                <div>ความสมบูรณ์เอกสาร: <strong style={{ color: '#047857' }}>{uploadedDocsCount}/{totalDocsCount} ({docCompletionPercent}%)</strong></div>
              </div>
            </div>

            {/* Section 5: รายการตรวจสอบเอกสารสิทธิ์ 12 รายการ */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
                📑 5. รายการตรวจสอบความสมบูรณ์เอกสารสิทธิ์ (Legal Due Diligence Checklist)
              </h3>
              <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e2e8f0', color: '#1e293b' }}>
                    <th style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1' }}>ลำดับ</th>
                    <th style={{ padding: '3px 6px', borderBottom: '1px solid #cbd5e1' }}>รายการเอกสารสิทธิ์และนิติกรรม</th>
                    <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>สถานะไฟล์แนบในระบบ</th>
                    <th style={{ padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>ฉบับจริงในแฟ้ม</th>
                  </tr>
                </thead>
                <tbody>
                  {documentStatuses.map((d, idx) => (
                    <tr key={d.requirement.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '2.5px 6px', color: '#64748b', textAlign: 'center', width: '30px' }}>{idx + 1}</td>
                      <td style={{ padding: '2.5px 6px', fontWeight: '500' }}>{d.requirement.title}</td>
                      <td style={{ padding: '2.5px 6px', textAlign: 'center', width: '110px' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '8.5px',
                          fontWeight: 'bold',
                          backgroundColor: d.isUploaded ? '#dcfce7' : '#fee2e2',
                          color: d.isUploaded ? '#15803d' : '#b91c1c'
                        }}>
                          {d.isUploaded ? '✓ แนบไฟล์แล้ว' : '✗ ยังไม่มีไฟล์'}
                        </span>
                      </td>
                      <td style={{ padding: '2.5px 6px', textAlign: 'center', width: '90px', color: d.hasPhysical ? '#15803d' : '#94a3b8', fontWeight: 'bold' }}>
                        {d.hasPhysical ? '✓ มีในแฟ้ม' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 6: ข้อมูลโฉนดย่อย (Sub-Parcels) หรือการแบ่งแปลง */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                🗂️ 6. ข้อมูลการแบ่งแยกแปลงย่อย (Sub-Parcels)
              </h3>
              {plot.subParcels && plot.subParcels.length > 0 ? (
                <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
                      <th style={{ padding: '2px 4px' }}>แปลงย่อย</th>
                      <th style={{ padding: '2px 4px' }}>เลขที่โฉนด</th>
                      <th style={{ padding: '2px 4px', textAlign: 'right' }}>เนื้อที่ (ไร่-งาน-วา)</th>
                      <th style={{ padding: '2px 4px', textAlign: 'right' }}>รวม ตร.ว.</th>
                      <th style={{ padding: '2px 4px' }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plot.subParcels.map((sp, sIdx) => (
                      <tr key={sp.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '2px 4px' }}>#{plot.orderNumber}.{sIdx + 1}</td>
                        <td style={{ padding: '2px 4px', fontWeight: 'bold' }}>{sp.deedNumber}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'right' }}>{formatThaiArea(sp.rai, sp.ngan, sp.sqWah)}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 'bold' }}>{sp.totalSqWah}</td>
                        <td style={{ padding: '2px 4px', color: '#64748b' }}>{sp.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                  แปลงนี้เป็นโฉนดเดี่ยวแปลงหลัก ไม่มีการแบ่งแยกแปลงย่อย (โฉนดเลขที่ {plot.primaryDeedNumber || '-'})
                </div>
              )}
            </div>

            {/* Section 7: บันทึกและข้อสังเกตการลงทุน */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 14px', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                📝 7. บันทึกและข้อสังเกตการลงทุน (Investment Notes & Remarks)
              </h3>
              <p style={{ fontSize: '9.5px', color: '#334155', margin: '0 0 3px 0' }}>
                {plot.notes || 'ไม่มีบันทึกเพิ่มเติมสำหรับแปลงนี้'}
              </p>
              {plot.quickNotes && plot.quickNotes.length > 0 && (
                <div style={{ fontSize: '9px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '3px' }}>
                  <strong>โน้ตด่วน:</strong> {plot.quickNotes.map((qn) => `[${qn.tag || 'บันทึก'}] ${qn.text}`).join(' • ')}
                </div>
              )}
            </div>

            {/* Section 8: ส่วนลงนามรับรองเอกสารทางการ (Official Signatures) */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
                ✍️ 8. การลงนามรับรองความถูกต้องของข้อมูล (Verification & Signatures)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', paddingTop: '4px' }}>
                <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#334155' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '28px' }}>ผู้จัดทำรายงาน (Prepared By)</div>
                  <div style={{ borderBottom: '1px solid #0f172a', width: '180px', margin: '0 auto 4px auto' }}></div>
                  <div>(............................................................)</div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>วันที่: ...... / ...... / ..........</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#334155' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '28px' }}>ผู้ตรวจสอบ / เจ้าของพอร์ต (Approved By)</div>
                  <div style={{ borderBottom: '1px solid #0f172a', width: '180px', margin: '0 auto 4px auto' }}></div>
                  <div>( {settings?.ownerName || 'คุณอภิวัชร์'} )</div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>วันที่: ...... / ...... / ..........</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Page 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #cbd5e1' }}>
            <div>ระบบบริหารจัดการพอร์ตการลงทุนที่ดิน (Land Portfolio Management)</div>
            <div>เอกสารทางการสำหรับตรวจสอบและประกอบการบริหารพอร์ตที่ดิน</div>
            <div style={{ fontWeight: 'bold', color: '#0f172a' }}>หน้า 2 จาก 2 (Page 2 of 2)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
