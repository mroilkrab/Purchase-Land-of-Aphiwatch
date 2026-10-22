import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  MapPin, 
  Layers, 
  Navigation, 
  ExternalLink, 
  Eye, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  Compass, 
  Info, 
  Search, 
  Maximize2,
  Check,
  ChevronDown,
  Mountain,
  Satellite,
  Map as MapIcon
} from 'lucide-react';
import { LandPlot, LandStatus } from '../types/land';
import { formatCurrency, formatThaiArea } from '../services/storage';

interface LandMapViewProps {
  plots: LandPlot[];
  onSelectPlot: (plot: LandPlot) => void;
  onEditPlot: (plot: LandPlot) => void;
}

export type MapTileLayerType = 'terrain' | 'satellite' | 'street' | 'dark';

export const TILE_LAYER_OPTIONS: {
  id: MapTileLayerType;
  label: string;
  emoji: string;
  shortLabel: string;
  description: string;
  provider: string;
}[] = [
  {
    id: 'terrain',
    label: 'ภูมิประเทศ (Terrain)',
    emoji: '⛰️',
    shortLabel: 'ภูมิประเทศ',
    description: 'ระดับความสูง ความลาดชัน สันเขา และภูมิสัณฐานธรรมชาติ',
    provider: 'Esri World Topo Map',
  },
  {
    id: 'satellite',
    label: 'ดาวเทียม (Satellite)',
    emoji: '🛰️',
    shortLabel: 'ดาวเทียม',
    description: 'ภาพถ่ายทางอากาศและดาวเทียมความละเอียดสูง คมชัดทุกแปลง',
    provider: 'Esri World Imagery',
  },
  {
    id: 'street',
    label: 'ถนนมาตรฐาน (Street)',
    emoji: '🗺️',
    shortLabel: 'ถนน',
    description: 'เส้นทาง คมนาคม ชุมชน และผังเมือง OpenStreetMap',
    provider: 'OpenStreetMap',
  },
  {
    id: 'dark',
    label: 'ธีมมืด (Dark Canvas)',
    emoji: '🌑',
    shortLabel: 'ธีมมืด',
    description: 'แผนที่คอนทราสต์สูง สบายตา เหมาะสำหรับกลางคืน',
    provider: 'Carto Dark',
  },
];

export const LandMapView: React.FC<LandMapViewProps> = ({
  plots,
  onSelectPlot,
  onEditPlot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeTileType, setActiveTileType] = useState<MapTileLayerType>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'interactive' | 'static-cards'>('interactive');
  const [activePlot, setActivePlot] = useState<LandPlot | null>(plots[0] || null);
  const [copiedCoords, setCopiedCoords] = useState<string | null>(null);

  // Filter plots that have valid coordinates
  const plotsWithCoords = plots.filter(
    (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const filteredPlots = plotsWithCoords.filter((p) => {
    const matchProv = selectedProvince === 'all' || p.province === selectedProvince;
    const matchStatus = selectedStatus === 'all' || p.status === selectedStatus;
    return matchProv && matchStatus;
  });

  const provinces = Array.from(new Set(plots.map((p) => p.province).filter(Boolean)));

  // Tile layer configurations for Leaflet
  const getTileConfig = (type: MapTileLayerType) => {
    switch (type) {
      case 'terrain':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, FAO',
          maxZoom: 19,
        };
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        };
      case 'dark':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          maxZoom: 19,
        };
      case 'street':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        };
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || viewMode !== 'interactive') return;

    if (!mapInstanceRef.current) {
      // Default center: Thailand (between Nakhon Sawan and Bangkok)
      const map = L.map(mapContainerRef.current, {
        center: [15.2, 100.4],
        zoom: 7,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add base tile layer
      const cfg = getTileConfig(activeTileType);
      const baseTile = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      tileLayerRef.current = baseTile;

      // Layer group for pins
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      // Clean up on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode]);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const cfg = getTileConfig(activeTileType);
    const newTile = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;
  }, [activeTileType]);

  // Update Markers when plots or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredPlots.forEach((plot) => {
      if (!plot.latitude || !plot.longitude) return;

      const latLng: [number, number] = [plot.latitude, plot.longitude];
      bounds.extend(latLng);

      // Pin Color by status
      let badgeColor = 'bg-emerald-500 text-slate-950 border-emerald-300';
      if (plot.status === 'sold') badgeColor = 'bg-rose-500 text-white border-rose-300';
      else if (plot.status === 'consignment') badgeColor = 'bg-amber-500 text-slate-950 border-amber-300';
      else if (plot.status === 'for_sale') badgeColor = 'bg-cyan-500 text-slate-950 border-cyan-300';

      // Custom HTML Marker Pin with Plot Number
      const customIcon = L.divIcon({
        className: 'custom-plot-marker',
        html: `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="px-2 py-1 rounded-full shadow-xl font-bold font-mono text-xs flex items-center gap-1 border-2 ${badgeColor} transition-transform group-hover:scale-115">
              <span>#${plot.orderNumber}</span>
            </div>
            <div class="w-2 h-2 -mt-1 rotate-45 ${badgeColor}"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 30],
        popupAnchor: [0, -32],
      });

      const marker = L.marker(latLng, { icon: customIcon });

      // Popup Content
      const popupHtml = document.createElement('div');
      popupHtml.className = 'text-xs text-slate-200 space-y-2 min-w-[220px]';
      popupHtml.innerHTML = `
        <div class="border-b border-slate-700/80 pb-2">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-white text-sm">#${plot.orderNumber} ${plot.title}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-0.5">
            ${plot.subdistrict}, ${plot.district}, ${plot.province}
          </div>
        </div>

        <div class="space-y-1 text-[11px]">
          <div class="flex justify-between">
            <span class="text-slate-400">เนื้อที่:</span>
            <span class="font-mono font-semibold text-amber-300">${formatThaiArea(plot.rai, plot.ngan, plot.sqWah)} (${plot.totalSqWah} ตร.ว.)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">ต้นทุนรวม:</span>
            <span class="font-mono font-bold text-white">${formatCurrency(plot.totalCost)}</span>
          </div>
          ${plot.targetSalePrice > 0 ? `
            <div class="flex justify-between">
              <span class="text-emerald-400">ราคาตั้งใจขาย (KPI):</span>
              <span class="font-mono font-semibold text-emerald-300">${formatCurrency(plot.targetSalePrice)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
            <span>พิกัด GPS:</span>
            <span class="font-mono text-slate-300">${plot.latitude?.toFixed(4)}, ${plot.longitude?.toFixed(4)}</span>
          </div>
        </div>

        <div class="pt-2 flex gap-1.5 border-t border-slate-800">
          <button id="btn-view-${plot.id}" class="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] text-center cursor-pointer transition-colors">
            ดูรายละเอียด
          </button>
          ${plot.mapsUrl ? `
            <a href="${plot.mapsUrl}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-[11px] border border-slate-700 flex items-center justify-center">
              Maps ↗
            </a>
          ` : ''}
        </div>
      `;

      // Attach button listener inside popup
      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        setActivePlot(plot);
        const btn = document.getElementById(`btn-view-${plot.id}`);
        if (btn) {
          btn.onclick = () => onSelectPlot(plot);
        }
      });

      marker.addTo(markersLayerRef.current!);
    });

    // Auto zoom map to fit markers
    if (filteredPlots.length > 0 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredPlots, viewMode]);

  // Quick zoom to specific region
  const handleZoomToRegion = (region: 'all' | 'nakhonsawan' | 'bangkok' | 'phetchabun') => {
    if (!mapInstanceRef.current) return;
    switch (region) {
      case 'nakhonsawan':
        mapInstanceRef.current.flyTo([15.6835, 100.2285], 12);
        setSelectedProvince('นครสวรรค์');
        break;
      case 'bangkok':
        mapInstanceRef.current.flyTo([13.875, 100.61], 12);
        setSelectedProvince('กรุงเทพฯ');
        break;
      case 'phetchabun':
        mapInstanceRef.current.flyTo([15.986, 101.072], 12);
        setSelectedProvince('เพชรบูรณ์');
        break;
      case 'all':
      default:
        setSelectedProvince('all');
        mapInstanceRef.current.flyTo([15.0, 100.5], 7);
        break;
    }
  };

  const handleFlyToPlot = (plot: LandPlot) => {
    setActivePlot(plot);
    if (mapInstanceRef.current && plot.latitude && plot.longitude) {
      mapInstanceRef.current.flyTo([plot.latitude, plot.longitude], 15, { duration: 1.2 });
    }
  };

  const handleCopyCoords = (lat?: number, lng?: number) => {
    if (!lat || !lng) return;
    const str = `${lat}, ${lng}`;
    navigator.clipboard.writeText(str);
    setCopiedCoords(str);
    setTimeout(() => setCopiedCoords(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                แผนที่แสดงตำแหน่งแปลงที่ดิน (Land Plot Map Visualization)
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {plotsWithCoords.length} แปลงระบุพิกัด
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                แสดงพิกัดดาวเทียมจริง แผนที่ระวาง และระบบปักหมุดแปลงที่ดินแบบไร้ข้อจำกัด
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Basemap Layer Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setViewMode('interactive')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'interactive'
                  ? 'bg-emerald-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              แผนที่ดาวเทียมสด (Interactive)
            </button>
            <button
              onClick={() => setViewMode('static-cards')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'static-cards'
                  ? 'bg-emerald-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              การ์ดแผนที่พิกัด (Static Locator)
            </button>
          </div>

          {/* Basemap toggle (if interactive) */}
          {viewMode === 'interactive' && (
            <div className="flex flex-wrap items-center rounded-lg bg-slate-800 p-1 border border-slate-700 text-xs gap-1">
              {TILE_LAYER_OPTIONS.map((opt) => {
                const isActive = activeTileType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setActiveTileType(opt.id)}
                    className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-700 text-emerald-400 font-semibold shadow-sm ring-1 ring-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                    title={`${opt.label} — ${opt.description} (${opt.provider})`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Region Buttons & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">ลัดไปยังพื้นที่:</span>
          <button
            onClick={() => handleZoomToRegion('all')}
            className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              selectedProvince === 'all'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            🇹🇭 ภาพรวมทั้งหมด ({plots.length} แปลง)
          </button>
          <button
            onClick={() => handleZoomToRegion('nakhonsawan')}
            className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              selectedProvince === 'นครสวรรค์'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            📍 นครสวรรค์ (6 แปลง)
          </button>
          <button
            onClick={() => handleZoomToRegion('bangkok')}
            className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              selectedProvince === 'กรุงเทพฯ'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            📍 กรุงเทพฯ (3 แปลง)
          </button>
          <button
            onClick={() => handleZoomToRegion('phetchabun')}
            className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              selectedProvince === 'เพชรบูรณ์'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            📍 เพชรบูรณ์ (1 แปลง)
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">สถานะ:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="holding">ถือครอง</option>
            <option value="for_sale">กำลังประกาศขาย</option>
            <option value="sold">ขายแล้ว</option>
            <option value="consignment">รับขายฝาก</option>
          </select>
        </div>
      </div>

      {/* Main Map View Area */}
      {viewMode === 'interactive' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Map Canvas */}
          <div className="lg:col-span-8 xl:col-span-9 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative shadow-2xl h-[560px]">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Floating Map Legend */}
            <div className="absolute top-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 shadow-xl text-[11px] space-y-1.5 pointer-events-auto">
              <span className="font-semibold text-slate-300 block mb-1">สัญลักษณ์หมุด:</span>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300" />
                <span className="text-slate-300">ถือครอง (Holding)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500 border border-cyan-300" />
                <span className="text-slate-300">กำลังประกาศขาย</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300" />
                <span className="text-slate-300">รับขายฝาก</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-300" />
                <span className="text-slate-300">ขายแล้ว</span>
              </div>
            </div>

            {/* Backdrop to close layer dropdown when clicked outside */}
            {showLayerMenu && (
              <div 
                className="absolute inset-0 z-[25] cursor-default" 
                onClick={() => setShowLayerMenu(false)}
              />
            )}

            {/* Floating Layer Toggle Widget */}
            <div className="absolute top-4 right-4 z-30 pointer-events-auto">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLayerMenu(!showLayerMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs font-medium transition-all hover:border-emerald-500/50 cursor-pointer group"
                  title="สลับชั้นข้อมูลแผนที่ (Layer Toggle)"
                >
                  <Layers className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  <span className="font-semibold text-slate-100 hidden sm:inline">
                    {TILE_LAYER_OPTIONS.find((l) => l.id === activeTileType)?.label || 'ชั้นแผนที่'}
                  </span>
                  <span className="sm:hidden text-sm">
                    {TILE_LAYER_OPTIONS.find((l) => l.id === activeTileType)?.emoji || '🗺️'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showLayerMenu ? 'rotate-180 text-emerald-400' : ''}`} />
                </button>

                {showLayerMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/90 p-2 shadow-2xl z-40 space-y-1.5">
                    <div className="px-2.5 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        ชั้นข้อมูลแผนที่ (Leaflet Layers)
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Tiles</span>
                    </div>

                    <div className="space-y-1">
                      {TILE_LAYER_OPTIONS.map((layer) => {
                        const isCurrent = activeTileType === layer.id;
                        return (
                          <button
                            key={layer.id}
                            type="button"
                            onClick={() => {
                              setActiveTileType(layer.id);
                              setShowLayerMenu(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer group ${
                              isCurrent
                                ? 'bg-emerald-500/15 border border-emerald-500/50 text-emerald-200 shadow-sm'
                                : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                            }`}
                          >
                            <span className="text-xl mt-0.5 filter drop-shadow">{layer.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold group-hover:text-emerald-300 transition-colors">
                                  {layer.label}
                                </span>
                                {isCurrent && (
                                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <Check className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                                {layer.description}
                              </p>
                              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                <span>{layer.provider}</span>
                                {layer.id === 'terrain' && (
                                  <span className="text-amber-400 font-sans font-medium text-[9px]">เส้นชั้นความสูง</span>
                                )}
                                {layer.id === 'satellite' && (
                                  <span className="text-cyan-400 font-sans font-medium text-[9px]">ภาพถ่ายดาวเทียม</span>
                                )}
                                {layer.id === 'street' && (
                                  <span className="text-emerald-400 font-sans font-medium text-[9px]">เส้นทางคมนาคม</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Plot Navigator List */}
          <div className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                รายการแปลงที่ดิน ({filteredPlots.length})
              </h3>
              <span className="text-[10px] text-slate-500">คลิกเพื่อซูมหาแปลง</span>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1 scrollbar-thin">
              {filteredPlots.map((plot) => {
                const isSelected = activePlot?.id === plot.id;
                return (
                  <div
                    key={plot.id}
                    onClick={() => handleFlyToPlot(plot)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-md'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-emerald-400">
                        #{plot.orderNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          plot.status === 'sold'
                            ? 'bg-rose-500/10 text-rose-400'
                            : plot.status === 'consignment'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {plot.status === 'sold' ? 'ขายแล้ว' : plot.status === 'consignment' ? 'ขายฝาก' : 'ถือครอง'}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-100 truncate mb-1">
                      {plot.title}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{plot.subdistrict}, {plot.province}</span>
                      <span className="font-mono text-amber-400">{plot.totalSqWah} ตร.ว.</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      <span className="font-mono font-semibold text-white">
                        {formatCurrency(plot.totalCost)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlot(plot);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5 cursor-pointer"
                      >
                        ดูข้อมูล <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Static Map Image Cards Generator View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlots.map((plot) => {
            const lat = plot.latitude || 15.0;
            const lng = plot.longitude || 100.5;
            // Static satellite tile preview URL from Esri ArcGIS
            const staticMapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 15))}/${Math.floor((lng + 180) / 360 * Math.pow(2, 15))}`;

            return (
              <div
                key={plot.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col"
              >
                {/* Static Map Visual Header */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden group">
                  <iframe
                    title={`Mini Map for ${plot.title}`}
                    className="w-full h-full border-0 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.005}%2C${lng + 0.005}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />

                  {/* Badge & Crosshairs */}
                  <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-xs font-mono font-bold text-emerald-400">
                    แปลง #{plot.orderNumber}
                  </div>

                  <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 text-slate-300">
                    <Compass className="w-3.5 h-3.5 text-rose-400" />
                  </div>

                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 font-mono">
                    <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                      {lat.toFixed(5)}° N, {lng.toFixed(5)}° E
                    </span>
                    <button
                      onClick={() => handleCopyCoords(lat, lng)}
                      className="px-2 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white cursor-pointer"
                    >
                      {copiedCoords === `${lat}, ${lng}` ? 'คัดลอกแล้ว!' : 'คัดลอกพิกัด'}
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white text-sm truncate">
                      {plot.title}
                    </h4>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {plot.subdistrict}, {plot.district}, {plot.province}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">เนื้อที่:</span>
                        <span className="font-semibold text-slate-200">
                          {formatThaiArea(plot.rai, plot.ngan, plot.sqWah)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ต้นทุนรวม:</span>
                        <span className="font-semibold font-mono text-emerald-400">
                          {formatCurrency(plot.totalCost)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectPlot(plot)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-center cursor-pointer transition-colors"
                    >
                      ดูข้อมูลแปลง
                    </button>
                    {plot.mapsUrl && (
                      <a
                        href={plot.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
