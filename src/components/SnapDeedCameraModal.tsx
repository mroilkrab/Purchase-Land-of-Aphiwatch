import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  RotateCcw, 
  Check, 
  FlipHorizontal, 
  Zap, 
  ZapOff, 
  AlertCircle, 
  Upload, 
  FileText,
  Loader2,
  Scan,
  Maximize2
} from 'lucide-react';
import { compressImageForStorage } from '../services/dbStorage';

interface SnapDeedCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Url: string, title: string) => void;
  defaultTitle?: string;
  deedNumber?: string;
}

export const SnapDeedCameraModal: React.FC<SnapDeedCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  defaultTitle,
  deedNumber,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  // Initialize title
  useEffect(() => {
    if (isOpen) {
      const initial = defaultTitle || 
        (deedNumber ? `โฉนดที่ดิน เลขที่ ${deedNumber}` : `รูปถ่ายโฉนด (${new Date().toLocaleDateString('th-TH')})`);
      setDocTitle(initial);
      setCapturedImage(null);
      setCameraError(null);
    }
  }, [isOpen, defaultTitle, deedNumber]);

  // Check available cameras
  useEffect(() => {
    if (!isOpen) return;
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Start camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCurrentStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง กรุณาใช้ปุ่มอัพโหลดภาพถ่ายแทน');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch((err) => {
          console.warn('Video play error:', err);
        });
      }

      // Check if torch/flashlight capability is present
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() || {}) as any;
        setHasTorch(Boolean(capabilities.torch));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errMsg = 'ไม่สามารถเข้าถึงกล้องถ่ายภาพได้';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องถ่ายภาพในเบราว์เซอร์ของคุณ';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'ไม่พบอุปกรณ์กล้องถ่ายภาพบนเครื่องนี้';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errMsg = 'กล้องกำลังถูกใช้งานโดยแอปพลิเคชันอื่น';
      }
      setCameraError(errMsg);
    }
  };

  const stopCurrentStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const nextTorch = !isTorchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle not supported or error:', err);
    }
  };

  // Switch between front/back camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture photo from video to canvas
  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // Flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If using user/front camera, flip horizontally for mirror preview
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    setIsProcessing(true);
    try {
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.90);
      // Compress for high-res clarity without bloating state
      const compressedUrl = await compressImageForStorage(rawDataUrl, 1600, 0.85);
      setCapturedImage(compressedUrl);
      stopCurrentStream();
    } catch (err) {
      console.error('Capture compression error:', err);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(rawDataUrl);
      stopCurrentStream();
    } finally {
      setIsProcessing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm and Save
  const handleConfirmSave = () => {
    if (!capturedImage) return;
    const finalTitle = docTitle.trim() || 
      (deedNumber ? `โฉนดที่ดิน เลขที่ ${deedNumber}` : `รูปถ่ายโฉนด (${new Date().toLocaleDateString('th-TH')})`);
    
    onCapture(capturedImage, finalTitle);
    handleClose();
  };

  // Fallback Camera input via file capture attribute
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsProcessing(true);
    try {
      const compressed = await compressImageForStorage(file, 1600, 0.85);
      setCapturedImage(compressed);
      setCameraError(null);
    } catch (err) {
      console.error('Fallback image processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCurrentStream();
    setCapturedImage(null);
    setCameraError(null);
    onClose();
  };

  // Life-cycle
  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    }
    return () => {
      stopCurrentStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>ถ่ายรูปโฉนดที่ดิน (Snap Deed)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                  กล้องสแกนเอกสาร
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                จัดวางโฉนดหรือเอกสารสิทธิ์ให้อยู่ในกรอบเพื่อความคมชัดของรายละเอียดและเลขที่ดิน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight toggle */}
            {!capturedImage && hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={isTorchOn ? 'ปิดแฟลช' : 'เปิดแฟลช'}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  isTorchOn 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Switch Camera */}
            {!capturedImage && hasMultipleCameras && (
              <button
                type="button"
                onClick={handleToggleFacingMode}
                title="สลับกล้องหน้า/หลัง"
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
              >
                <FlipHorizontal className="w-4 h-4" />
                <span className="text-[11px] hidden sm:inline">
                  {facingMode === 'environment' ? 'กล้องหลัง' : 'กล้องหน้า'}
                </span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport / Viewfinder Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[320px] sm:min-h-[420px]">
          
          {/* Flash Effect */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150" />
          )}

          {/* Captured Image Preview */}
          {capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-3 bg-slate-950">
              <img
                src={capturedImage}
                alt="Captured Deed"
                className="max-h-[60vh] max-w-full object-contain rounded-xl border border-slate-700 shadow-lg"
              />
              <div className="absolute top-5 left-5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-emerald-300 text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5 shadow">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>ภาพถ่ายโฉนดพร้อมใช้งาน</span>
              </div>
            </div>
          ) : cameraError ? (
            /* Camera Error State */
            <div className="p-8 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">ไม่สามารถเปิดกล้องถ่ายภาพได้</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-950/50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ถ่ายด้วยกล้องมือถือ / เลือกรูปภาพ</span>
                </button>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ลองเปิดกล้องอีกครั้ง</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover sm:object-contain"
              />

              {/* Document Scanner Alignment Frame */}
              <div className="absolute inset-4 sm:inset-8 pointer-events-none flex flex-col justify-between">
                {/* Top corners */}
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl shadow-sm" />
                  <div className="px-3 py-1 bg-slate-900/75 border border-emerald-500/30 rounded-full text-emerald-300 text-[11px] font-medium backdrop-blur-sm shadow flex items-center gap-1.5">
                    <Scan className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>วางโฉนดที่ดินให้อยู่ในกรอบ</span>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl shadow-sm" />
                </div>

                {/* Center watermark guide */}
                <div className="text-center opacity-40">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full border border-dashed border-emerald-400/50 flex items-center justify-center">
                    <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-emerald-300/80 font-mono tracking-widest mt-1 block uppercase">
                    Land Deed Alignment Guide
                  </span>
                </div>

                {/* Bottom corners */}
                <div className="flex justify-between items-end">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl shadow-sm" />
                  <span className="text-[10px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    {deedNumber ? `เลขที่ดิน: ${deedNumber}` : 'รูปภาพจะถูกแปลงเป็น Base64 ทันที'}
                  </span>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-r-2 border-emerald-400 rounded-br-xl shadow-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Hidden Canvas for capture processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Hidden Fallback File/Camera Input */}
          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFallbackFile}
            className="hidden"
          />
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
          
          {capturedImage ? (
            /* Post-capture review controls */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-medium whitespace-nowrap">
                  ชื่อรูปภาพโฉนด:
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="เช่น โฉนดเลขที่ 12345 หรือ ระวาง น.ส.4จ"
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ถ่ายใหม่ (Retake)</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.02]"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกรูปโฉนดลงแปลงที่ดิน (Save Deed)</span>
                </button>
              </div>
            </div>
          ) : !cameraError ? (
            /* Active Live Camera shutter button */
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เลือกไฟล์จากเครื่อง</span>
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={isProcessing}
                className="group relative flex items-center justify-center p-1 rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-95"
                title="กดถ่ายรูปโฉนดที่ดิน"
              >
                <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping group-hover:bg-emerald-500/40" />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 group-hover:from-emerald-500 group-hover:to-teal-400 text-white flex items-center justify-center shadow-xl shadow-emerald-900/50 border-4 border-slate-900">
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
};
