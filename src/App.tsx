/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  User, 
  UserRound, 
  Palette, 
  Shirt, 
  Zap, 
  Download, 
  Loader2, 
  Sparkles,
  Check,
  Image as ImageIcon,
  Crop as CropIcon,
  X,
  Maximize,
  Scissors,
  Brush,
  Smile,
  Scaling,
  Eraser,
  Undo,
  Settings2,
  ChevronRight,
  ChevronLeft,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Initialize Gemini AI
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

type Gender = 'Nữ' | 'Nam';
type Background = 'Nền Xanh' | 'Nền Trắng' | 'Nền Đỏ' | 'Nền Xám';
type Outfit = 'Áo sơ mi' | 'Mặc Vest' | 'Áo Dài' | 'Đồ Công Sở';
type Quality = '2K' | '4K' | '8K';
type VestStyle = 'Cổ điển' | 'Hiện đại' | 'Slim-fit' | 'Double-breasted';
type VestColor = 'Đen' | 'Xanh Navy' | 'Xám' | 'Trắng';
type SkinTone = 'Tự nhiên' | 'Sáng' | 'Trắng hồng' | 'Rám nắng';
type MakeupLevel = 'Không' | 'Nhẹ nhàng' | 'Tự nhiên' | 'Chuyên nghiệp';
type LipstickColor = 'Không' | 'Hồng nhạt' | 'Đỏ tươi' | 'Cam đào';
type PhotoSize = '2x3 cm' | '3x4 cm' | '4x6 cm' | 'Passport (3.5x4.5 cm)';

type TabType = 'basic' | 'outfit' | 'beauty' | 'edit' | 'export';

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [gender, setGender] = useState<Gender>('Nữ');
  const [background, setBackground] = useState<Background>('Nền Trắng');
  const [outfit, setOutfit] = useState<Outfit>('Áo sơ mi');
  const [quality, setQuality] = useState<Quality>('2K');
  const [keepFace, setKeepFace] = useState(true);
  const [vestStyle, setVestStyle] = useState<VestStyle>('Cổ điển');
  const [vestColor, setVestColor] = useState<VestColor>('Đen');
  const [skinTone, setSkinTone] = useState<SkinTone>('Tự nhiên');
  const [makeup, setMakeup] = useState<MakeupLevel>('Tự nhiên');
  const [lipstick, setLipstick] = useState<LipstickColor>('Hồng nhạt');
  const [photoSize, setPhotoSize] = useState<PhotoSize>('3x4 cm');

  // Cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(3 / 4);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object Removal state
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);

  // Sync canvas size with image
  const syncCanvasSize = useCallback(() => {
    if (previewImgRef.current && canvasRef.current) {
      const img = previewImgRef.current;
      const canvas = canvasRef.current;
      const rect = img.getBoundingClientRect();
      
      // Only resize if different to avoid clearing canvas unnecessarily
      if (canvas.width !== img.clientWidth || canvas.height !== img.clientHeight) {
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        
        // If we have history, we might need to redraw, but for now let's just ensure size
        // Redrawing on resize is complex because coordinates change. 
        // For this app, we'll just clear on resize or try to maintain aspect.
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setOriginalImage(reader.result?.toString() || null);
        setCroppedImage(null);
        setResultImage(null);
        // Don't auto-open crop modal anymore
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initialAspect = aspect || 1;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, initialAspect, width, height),
      width,
      height
    );
    setCrop(crop);
  }

  const handleAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const newCrop = centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, newAspect || 1, width, height),
        width,
        height
      );
      setCrop(newCrop);
    }
  };

  const getCroppedImg = () => {
    if (!imgRef.current || !completedCrop) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0, 0, completedCrop.width, completedCrop.height
      );
    }
    setCroppedImage(canvas.toDataURL('image/jpeg'));
    setShowCropModal(false);
  };

  // Drawing logic for object removal
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Save state before drawing for undo
    if (canvasRef.current) {
      setCanvasHistory(prev => [...prev, canvasRef.current!.toDataURL()]);
    }
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const undoLastStroke = () => {
    if (canvasHistory.length === 0 || !canvasRef.current) return;
    
    const lastState = canvasHistory[canvasHistory.length - 1];
    const newHistory = canvasHistory.slice(0, -1);
    setCanvasHistory(newHistory);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        if (newHistory.length === 0) {
          // Check if canvas is actually empty now
          // This is a bit simplified, but works for basic undo
          setHasDrawn(false);
        }
      };
      img.src = lastState;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawn(true);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      setCanvasHistory([]);
    }
  };

  const generateIDPhoto = async () => {
    const baseImage = croppedImage || originalImage;
    if (!baseImage) {
      setError("Vui lòng tải ảnh lên trước.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (!apiKey) {
        throw new Error("API_KEY_MISSING");
      }
      const model = "gemini-2.5-flash-image";
      
      // If user has drawn on the canvas, we merge it or send it as context
      let finalBase64 = baseImage.split(',')[1];
      let promptPrefix = "";

      if (hasDrawn && canvasRef.current) {
        // Create a composite image with the red marks to show AI what to remove
        const tempCanvas = document.createElement('canvas');
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = baseImage;
        });
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(img, 0, 0);
          tempCtx.drawImage(canvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
          finalBase64 = tempCanvas.toDataURL('image/jpeg').split(',')[1];
          promptPrefix = "I have marked some areas in RED. Please REMOVE the objects, text, or logos inside or covered by the RED marks and fill them naturally with the background. ";
        }
      }

      const prompt = `
        ${promptPrefix}
        Convert this person's photo into a professional ID photo:
        - Gender: ${gender}
        - Background: ${background}
        - Outfit: ${outfit}. ${outfit === 'Mặc Vest' ? `Style: ${vestStyle}, Color: ${vestColor}.` : ''}
        - Beauty: Skin Tone ${skinTone}, Makeup ${makeup}, Lipstick ${lipstick}.
        - Face: ${keepFace ? 'Keep original facial features exactly.' : 'Enhance professionally.'}
        - Size: ${photoSize}, 3:4 aspect ratio, centered.
        - Style: High quality studio lighting, professional ID photo.
      `;

      const response = await genAI.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { data: finalBase64, mimeType: "image/jpeg" } },
            { text: prompt },
          ],
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        setResultImage(`data:image/png;base64,${part.inlineData.data}`);
        setActiveTab('export');
      } else {
        throw new Error("Không tìm thấy ảnh kết quả.");
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      if (err.message === "API_KEY_MISSING") {
        setError("Thiếu API Key. Vui lòng thiết lập VITE_GEMINI_API_KEY trong môi trường của bạn.");
      } else if (err.message?.includes("API key not valid")) {
        setError("API Key không hợp lệ. Vui lòng kiểm tra lại thiết lập của bạn.");
      } else {
        setError("Lỗi xử lý AI. Vui lòng thử lại.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const [showOriginal, setShowOriginal] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  return (
    <div className="h-screen h-[100dvh] w-screen bg-[#F0F4F8] overflow-hidden flex flex-col font-sans text-slate-800">
      {/* Compact Header */}
      <header className="h-14 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg text-slate-900 hidden sm:block">AI ID Photo Pro</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Reset button moved to sidebar */}
        </div>
      </header>

      <main className="flex-grow flex flex-col-reverse lg:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[400px] h-[50%] lg:h-full border-t lg:border-t-0 lg:border-r bg-white/90 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden z-10 shadow-2xl lg:shadow-none">
          {/* Tabs Navigation */}
          <div className="flex border-b bg-slate-50/30 overflow-x-auto no-scrollbar">
            {(['basic', 'outfit', 'beauty', 'edit', 'export'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-4 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex flex-col items-center gap-1 ${
                  activeTab === tab ? 'border-blue-500 text-blue-600 bg-white shadow-[inset_0_-2px_0_0_rgba(59,130,246,0.5)]' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-white/50'
                }`}
              >
                {tab === 'basic' && <><ImageIcon className="w-4 h-4" /> Cơ bản</>}
                {tab === 'outfit' && <><Shirt className="w-4 h-4" /> Trang phục</>}
                {tab === 'beauty' && <><Sparkles className="w-4 h-4" /> Làm đẹp</>}
                {tab === 'edit' && <><Brush className="w-4 h-4" /> Chỉnh sửa</>}
                {tab === 'export' && <><Download className="w-4 h-4" /> Xuất ảnh</>}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {activeTab === 'basic' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <ControlGroup label="Tải ảnh & Cắt" icon={Upload}>
                  <div className="space-y-3">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-200 transition-all flex flex-col items-center gap-2 group"
                    >
                      <Upload className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-600">Thay đổi ảnh chân dung</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={onSelectFile} accept="image/*" className="hidden" />
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setShowCropModal(true)}
                        disabled={!originalImage}
                        className="py-3 px-4 rounded-xl border border-blue-100 bg-white text-blue-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <Scissors className="w-4 h-4" /> Cắt ảnh
                      </button>
                      <button 
                        onClick={() => {
                          setGender('Nữ');
                          setBackground('Nền Trắng');
                          setOutfit('Áo sơ mi');
                          setQuality('2K');
                          setKeepFace(true);
                          setVestStyle('Cổ điển');
                          setVestColor('Đen');
                          setSkinTone('Tự nhiên');
                          setMakeup('Tự nhiên');
                          setLipstick('Hồng nhạt');
                          setPhotoSize('3x4 cm');
                          clearCanvas();
                        }}
                        className="py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Đặt lại
                      </button>
                    </div>
                  </div>
                </ControlGroup>
                <ControlGroup label="Giới tính" icon={User}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Nữ', 'Nam'].map(g => (
                      <TabButton key={g} active={gender === g} onClick={() => setGender(g as Gender)}>{g}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
                <ControlGroup label="Màu nền" icon={Palette}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Nền Trắng', 'Nền Xanh', 'Nền Đỏ', 'Nền Xám'].map(b => (
                      <TabButton key={b} active={background === b} onClick={() => setBackground(b as Background)}>{b}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
                <div className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-slate-100 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Smile className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-slate-600">Giữ khuôn mặt gốc</span>
                  </div>
                  <Switch active={keepFace} onClick={() => setKeepFace(!keepFace)} />
                </div>
              </motion.div>
            )}

            {activeTab === 'outfit' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <ControlGroup label="Loại trang phục" icon={Shirt}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Áo sơ mi', 'Mặc Vest', 'Áo Dài', 'Đồ Công Sở'].map(o => (
                      <TabButton key={o} active={outfit === o} onClick={() => setOutfit(o as Outfit)}>{o}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
                {outfit === 'Mặc Vest' && (
                  <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 space-y-5">
                    <ControlGroup label="Kiểu Vest">
                      <div className="grid grid-cols-2 gap-2">
                        {['Cổ điển', 'Hiện đại', 'Slim-fit', 'Double-breasted'].map(s => (
                          <TabButton key={s} active={vestStyle === s} onClick={() => setVestStyle(s as VestStyle)} small>{s}</TabButton>
                        ))}
                      </div>
                    </ControlGroup>
                    <ControlGroup label="Màu Vest">
                      <div className="flex gap-3">
                        {['Đen', 'Xanh Navy', 'Xám', 'Trắng'].map(c => (
                          <button 
                            key={c} onClick={() => setVestColor(c as VestColor)}
                            className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${vestColor === c ? 'border-blue-600 scale-110 ring-4 ring-blue-100' : 'border-white'}`}
                            style={{ backgroundColor: c === 'Đen' ? '#000' : c === 'Xanh Navy' ? '#000080' : c === 'Xám' ? '#808080' : '#fff' }}
                          />
                        ))}
                      </div>
                    </ControlGroup>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'beauty' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <ControlGroup label="Màu da" icon={UserRound}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Tự nhiên', 'Sáng', 'Trắng hồng', 'Rám nắng'].map(s => (
                      <TabButton key={s} active={skinTone === s} onClick={() => setSkinTone(s as SkinTone)} small>{s}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
                <ControlGroup label="Trang điểm" icon={Sparkles}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Không', 'Nhẹ nhàng', 'Tự nhiên', 'Chuyên nghiệp'].map(m => (
                      <TabButton key={m} active={makeup === m} onClick={() => setMakeup(m as MakeupLevel)} small>{m}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
                <ControlGroup label="Màu son" icon={Smile}>
                  <div className="grid grid-cols-2 gap-2">
                    {['Không', 'Hồng nhạt', 'Đỏ tươi', 'Cam đào'].map(l => (
                      <TabButton key={l} active={lipstick === l} onClick={() => setLipstick(l as LipstickColor)} small>{l}</TabButton>
                    ))}
                  </div>
                </ControlGroup>
              </motion.div>
            )}

            {activeTab === 'edit' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <p className="text-xs text-orange-700 font-medium leading-relaxed">
                    Dùng bút khoanh vùng các chi tiết thừa (logo, chữ, mụn, tóc con...) để AI xóa bỏ tự động.
                  </p>
                </div>
                <ControlGroup label="Kích thước bút" icon={Brush}>
                  <input 
                    type="range" min="5" max="50" value={brushSize} 
                    onChange={e => setBrushSize(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </ControlGroup>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={undoLastStroke}
                    disabled={canvasHistory.length === 0}
                    className="py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Undo className="w-4 h-4" /> Hoàn tác
                  </button>
                  <button 
                    onClick={clearCanvas}
                    disabled={!hasDrawn}
                    className="py-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Xóa hết
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'export' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100 space-y-5">
                  <ControlGroup label="Kích thước in" icon={Scaling}>
                    <div className="grid grid-cols-2 gap-2">
                      {['2x3 cm', '3x4 cm', '4x6 cm', 'Passport (3.5x4.5 cm)'].map(s => (
                        <TabButton key={s} active={photoSize === s} onClick={() => setPhotoSize(s as PhotoSize)} small>{s}</TabButton>
                      ))}
                    </div>
                  </ControlGroup>
                  <ControlGroup label="Chất lượng xuất" icon={Settings2}>
                    <div className="grid grid-cols-3 gap-2">
                      {['2K', '4K', '8K'].map(q => (
                        <TabButton key={q} active={quality === q} onClick={() => setQuality(q as Quality)}>{q}</TabButton>
                      ))}
                    </div>
                  </ControlGroup>
                </div>
                
                {resultImage && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = resultImage;
                        link.download = `id-photo-${Date.now()}.png`;
                        link.click();
                      }}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:translate-y-0"
                    >
                      <Download className="w-5 h-5" /> Tải ảnh chất lượng cao
                    </button>
                    <p className="text-[10px] text-slate-400 text-center font-medium">Ảnh đã được tối ưu hóa cho in ấn chuyên nghiệp</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-6 border-t bg-slate-50">
            <button
              onClick={generateIDPhoto}
              disabled={isProcessing || !originalImage}
              className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                isProcessing || !originalImage
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'
              }`}
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5" /> THỰC HIỆN AI</>}
            </button>
            {error && <p className="text-red-500 text-[10px] mt-2 text-center font-bold">{error}</p>}
          </div>
        </aside>

        {/* Main Preview Area */}
        <section className="flex-grow bg-[#F8FAFC] p-4 lg:p-10 flex items-center justify-center relative overflow-hidden">
          {/* Original Image Comparison (Floating) */}
          {originalImage && (
            <div className="absolute top-6 left-6 z-20 hidden sm:flex flex-col gap-3">
              <div className="relative group">
                <div className="absolute -top-2 -left-2 px-2 py-0.5 bg-blue-500 text-white text-[8px] font-bold rounded-md z-10 shadow-lg">ẢNH GỐC</div>
                <div className="w-32 h-44 bg-white p-1 rounded-xl shadow-2xl border border-white/50 overflow-hidden transform -rotate-3 group-hover:rotate-0 transition-all duration-500 cursor-pointer hover:scale-105"
                     onMouseDown={() => setShowOriginal(true)}
                     onMouseUp={() => setShowOriginal(false)}
                     onMouseLeave={() => setShowOriginal(false)}
                     onTouchStart={() => setShowOriginal(true)}
                     onTouchEnd={() => setShowOriginal(false)}
                >
                  <img src={originalImage} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                </div>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <div className="flex items-center gap-1.5 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Nhấn giữ so sánh</p>
                </div>
                <button 
                  onClick={() => setCompareMode(!compareMode)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm border ${
                    compareMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Scaling className="w-3 h-3" /> {compareMode ? 'Tắt so sánh' : 'So sánh 2 hình'}
                </button>
              </div>
            </div>
          )}

          <div className={`w-full h-full flex flex-col items-center justify-center gap-6 transition-all duration-500 ${compareMode ? 'max-w-6xl' : 'max-w-4xl'}`}>
            <div className={`relative w-full flex items-center justify-center gap-4 transition-all duration-500 ${compareMode ? 'flex-row' : 'flex-col'}`}>
              
              {compareMode && (croppedImage || originalImage) && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="relative w-full max-w-[400px] aspect-[3/4] bg-white rounded-[32px] shadow-xl overflow-hidden flex items-center justify-center border-[12px] border-white"
                >
                  <img src={croppedImage || originalImage || ''} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/80 backdrop-blur rounded-full text-[10px] font-bold text-slate-500 shadow-sm border">TRƯỚC</div>
                </motion.div>
              )}

              <div className={`relative w-full transition-all duration-500 bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] overflow-hidden flex items-center justify-center border-[16px] border-white ${
                compareMode ? 'max-w-[400px] aspect-[3/4]' : 'max-w-[480px] aspect-[3/4]'
              }`}>
                <AnimatePresence mode="wait">
                  {showOriginal && originalImage && !compareMode ? (
                    <motion.img 
                      key="original-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      src={originalImage} className="w-full h-full object-contain z-30 absolute inset-0 bg-white" referrerPolicy="no-referrer"
                    />
                  ) : null}
                  
                  {resultImage ? (
                    <motion.img 
                      key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      src={resultImage} className="w-full h-full object-contain" referrerPolicy="no-referrer"
                    />
                  ) : (croppedImage || originalImage) ? (
                    <div className="relative w-full h-full">
                      <img 
                        ref={previewImgRef}
                        src={croppedImage || originalImage || ''} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                        onLoad={syncCanvasSize}
                      />
                      {activeTab === 'edit' && (
                        <canvas
                          ref={canvasRef}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="absolute inset-0 cursor-crosshair touch-none"
                        />
                      )}
                      {isProcessing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                          <p className="text-blue-900 font-bold animate-pulse">AI đang xử lý...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-300 flex flex-col items-center gap-4">
                      <ImageIcon className="w-20 h-20 opacity-10" />
                      <p className="text-sm font-medium">Chưa có ảnh được tải lên</p>
                    </div>
                  )}
                </AnimatePresence>
                {compareMode && resultImage && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/80 backdrop-blur rounded-full text-[10px] font-bold text-slate-500 shadow-sm border">SAU</div>
                )}
              </div>
            </div>

            {/* Preview Labels */}
            {!compareMode && (
              <div className="flex gap-4">
                <div className="px-3 py-1 bg-white/80 backdrop-blur rounded-full text-[10px] font-bold text-slate-500 shadow-sm border">
                  {resultImage ? 'KẾT QUẢ AI' : 'ẢNH GỐC'}
                </div>
                {croppedImage && !resultImage && (
                  <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-bold shadow-sm border border-blue-200">
                    ĐÃ CẮT 3:4
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Crop Modal */}
      <AnimatePresence>
        {showCropModal && originalImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b flex justify-between items-center shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CropIcon className="w-5 h-5 text-blue-600" /> Cắt ảnh chuyên nghiệp
                </h3>
                <div className="flex gap-2">
                  {[
                    { label: '3:4', val: 3/4 },
                    { label: '4:6', val: 4/6 },
                    { label: '2:3', val: 2/3 },
                    { label: 'Tự do', val: undefined }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleAspectChange(opt.val)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                        aspect === opt.val ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCropModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-6 flex-grow overflow-auto flex flex-col items-center bg-slate-50">
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={aspect}
                  className="max-w-full"
                >
                  <img ref={imgRef} alt="Crop" src={originalImage} onLoad={onImageLoad} className="max-h-[50vh] object-contain" />
                </ReactCrop>
              </div>
              <div className="p-6 border-t flex gap-3 shrink-0">
                <button onClick={() => setShowCropModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Hủy</button>
                <button onClick={getCroppedImg} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700">Xác nhận</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}

function ControlGroup({ label, icon: Icon, children }: { label: string, icon?: any, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3 h-3 text-slate-400" />}
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}

interface TabButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
  key?: React.Key;
}

function TabButton({ children, active, onClick, small }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-3 rounded-xl font-bold transition-all text-center ${
        small ? 'text-[10px]' : 'text-xs'
      } ${
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

interface SwitchProps {
  active: boolean;
  onClick: () => void;
}

function Switch({ active, onClick }: SwitchProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-10 h-5 rounded-full transition-all relative ${active ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  );
}
