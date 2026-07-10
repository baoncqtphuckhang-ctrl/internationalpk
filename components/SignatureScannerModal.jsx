import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, CheckCircle2, RotateCcw, AlertCircle, Trash2, PenTool, Image as ImageIcon } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

export default function SignatureScannerModal({ isOpen, onClose, onSave, currentSignature }) {
    const [activeTab, setActiveTab] = useState('draw'); // 'draw' or 'upload'
    
    const [imageSrc, setImageSrc] = useState(null);
    const [error, setError] = useState('');
    
    // Upload states
    const [originalImgData, setOriginalImgData] = useState(null);
    const [threshold, setThreshold] = useState(160);
    const [isProcessing, setIsProcessing] = useState(false);
    const [removeBorders, setRemoveBorders] = useState(true);
    
    // Shared state
    const [signatureColor, setSignatureColor] = useState('blue'); // 'blue', 'black', 'original'
    const [confirmRemove, setConfirmRemove] = useState(false);

    // Draw states
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setImageSrc(null);
            setOriginalImgData(null);
            setError('');
            setThreshold(160);
            setSignatureColor('blue');
            setRemoveBorders(true);
            setActiveTab('draw');
        }
    }, [isOpen]);

    // Canvas drawing setup
    useEffect(() => {
        if (activeTab === 'draw' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = signatureColor === 'blue' ? '#2563eb' : (signatureColor === 'black' ? '#0f172a' : '#2563eb');
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, [activeTab, signatureColor]);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        
        const canvas = canvasRef.current;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        const ctx = canvas.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            
            // Trim whitespace from drawn canvas to create a tight signature bounding box
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            let hasInk = false;
            
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alpha = imgData.data[(y * canvas.width + x) * 4 + 3];
                    if (alpha > 10) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        hasInk = true;
                    }
                }
            }
            
            if (hasInk) {
                const padding = 20;
                minX = Math.max(0, minX - padding);
                minY = Math.max(0, minY - padding);
                maxX = Math.min(canvas.width, maxX + padding);
                maxY = Math.min(canvas.height, maxY + padding);

                const cropWidth = maxX - minX;
                const cropHeight = maxY - minY;
                
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropWidth;
                cropCanvas.height = cropHeight;
                const cropCtx = cropCanvas.getContext('2d');
                cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                setImageSrc(cropCanvas.toDataURL('image/png'));
            }
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setImageSrc(null);
    };

    // Upload logic
    useEffect(() => {
        if (activeTab !== 'upload' || !originalImgData) return;
        
        setIsProcessing(true);
        const timer = setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = originalImgData.width;
            canvas.height = originalImgData.height;
            const ctx = canvas.getContext('2d');
            
            const imgData = new ImageData(
                new Uint8ClampedArray(originalImgData.data),
                originalImgData.width,
                originalImgData.height
            );
            const data = imgData.data;
            
            const lower = Math.max(0, threshold - 30);
            const upper = Math.min(255, threshold + 30);
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                let alpha = 255;
                
                if (brightness >= upper) alpha = 0;
                else if (brightness <= lower) alpha = 255;
                else alpha = Math.round(((upper - brightness) / (upper - lower)) * 255);
                
                data[i + 3] = alpha;
                
                if (alpha > 0) {
                    if (signatureColor === 'blue') {
                        data[i] = 10; data[i + 1] = 20; data[i + 2] = 150;
                    } else if (signatureColor === 'black') {
                        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
                    } else {
                        data[i] = Math.max(0, r - 30); data[i + 1] = Math.max(0, g - 30); data[i + 2] = Math.max(0, b - 30);
                    }
                }
            }
            
            if (removeBorders) {
                const stack = [];
                const w = originalImgData.width;
                const h = originalImgData.height;
                
                for (let x = 0; x < w; x++) {
                    if (data[(x) * 4 + 3] > 0) stack.push(x, 0);
                    if (data[((h - 1) * w + x) * 4 + 3] > 0) stack.push(x, h - 1);
                }
                for (let y = 0; y < h; y++) {
                    if (data[(y * w) * 4 + 3] > 0) stack.push(0, y);
                    if (data[(y * w + w - 1) * 4 + 3] > 0) stack.push(w - 1, y);
                }
                
                while (stack.length > 0) {
                    const y = stack.pop();
                    const x = stack.pop();
                    const idx = (y * w + x) * 4;
                    
                    if (data[idx + 3] === 0) continue;
                    data[idx + 3] = 0;
                    
                    if (x > 0 && data[(y * w + x - 1) * 4 + 3] > 0) stack.push(x - 1, y);
                    if (x < w - 1 && data[(y * w + x + 1) * 4 + 3] > 0) stack.push(x + 1, y);
                    if (y > 0 && data[((y - 1) * w + x) * 4 + 3] > 0) stack.push(x, y - 1);
                    if (y < h - 1 && data[((y + 1) * w + x) * 4 + 3] > 0) stack.push(x, y + 1);
                }
            }

            ctx.putImageData(imgData, 0, 0);
            
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            let hasInk = false;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const alphaIdx = (y * canvas.width + x) * 4 + 3;
                    if (data[alphaIdx] > 10) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        hasInk = true;
                    }
                }
            }

            if (hasInk) {
                const padding = 20;
                minX = Math.max(0, minX - padding);
                minY = Math.max(0, minY - padding);
                maxX = Math.min(canvas.width, maxX + padding);
                maxY = Math.min(canvas.height, maxY + padding);

                const cropWidth = maxX - minX;
                const cropHeight = maxY - minY;
                
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropWidth;
                cropCanvas.height = cropHeight;
                const cropCtx = cropCanvas.getContext('2d');
                cropCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                setImageSrc(cropCanvas.toDataURL('image/png', 1.0));
            } else {
                setImageSrc(canvas.toDataURL('image/png', 1.0));
            }
            
            setIsProcessing(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [originalImgData, threshold, signatureColor, removeBorders, activeTab]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Vui lòng tải lên một tệp hình ảnh (jpg, png, heic...).');
            return;
        }
        setError('');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                tempCtx.drawImage(img, 0, 0, width, height);

                const imgData = tempCtx.getImageData(0, 0, width, height);
                setOriginalImgData({
                    data: imgData.data,
                    width: width,
                    height: height
                });
            };
            img.onerror = () => {
                setError('Không thể đọc định dạng ảnh này. Vui lòng thử ảnh khác.');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (imageSrc) {
            onSave(imageSrc);
            onClose();
        } else {
            setError('Vui lòng tạo chữ ký trước khi lưu!');
        }
    };

    const handleRemoveSignature = () => {
        setConfirmRemove(true);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <header className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                    <h3 className="font-extrabold text-lg flex items-center gap-2">
                        <PenTool size={20} className="text-blue-400" /> Cập nhật chữ ký điện tử
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <button 
                        className={`flex-1 py-3.5 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'draw' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        onClick={() => {
                            setActiveTab('draw');
                            setImageSrc(null);
                        }}
                    >
                        <PenTool size={18} /> Vẽ trực tiếp
                    </button>
                    <button 
                        className={`flex-1 py-3.5 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        onClick={() => {
                            setActiveTab('upload');
                            if (originalImgData) {
                                setImageSrc(null);
                            } else {
                                setImageSrc(null);
                            }
                        }}
                    >
                        <ImageIcon size={18} /> Tải ảnh lên
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div className="flex flex-col mb-2 space-y-6">
                        {/* Tab Content: Draw */}
                        {activeTab === 'draw' && (
                            <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between items-end mb-3">
                                    <label className="block text-sm font-bold text-slate-700">Khu vực vẽ chữ ký</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-500">Màu mực:</span>
                                        <button onClick={() => setSignatureColor('blue')} className={`w-6 h-6 rounded-full bg-blue-600 shadow-sm border-2 ${signatureColor === 'blue' ? 'border-blue-300 scale-110' : 'border-transparent'}`} />
                                        <button onClick={() => setSignatureColor('black')} className={`w-6 h-6 rounded-full bg-slate-900 shadow-sm border-2 ${signatureColor === 'black' ? 'border-slate-400 scale-110' : 'border-transparent'}`} />
                                    </div>
                                </div>
                                <div className="w-full bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl overflow-hidden touch-none relative" style={{ height: '300px' }}>
                                    <canvas 
                                        ref={canvasRef}
                                        width={1400} 
                                        height={600}
                                        className="w-full h-full cursor-crosshair bg-transparent relative z-10"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        onTouchCancel={stopDrawing}
                                    />
                                    {!imageSrc && !isDrawing && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 z-0">
                                            <span className="text-lg font-bold">Ký vào đây</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end mt-3">
                                    <button 
                                        onClick={clearCanvas}
                                        className="text-sm text-slate-500 hover:text-red-600 font-medium flex items-center gap-1.5 transition-colors"
                                    >
                                        <RotateCcw size={14} /> Xóa làm lại
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Upload */}
                        {activeTab === 'upload' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
                                {/* Khu vực Upload Ảnh */}
                                <div className="space-y-4 border-r-0 md:border-r border-slate-100 pr-0 md:pr-8">
                                    <div>
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition group">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-8 h-8 mb-2 text-slate-400 group-hover:text-blue-500 transition" />
                                                <p className="mb-1 text-sm text-slate-500 font-medium">Bấm để chọn ảnh</p>
                                                <p className="text-xs text-slate-400">hoặc chụp trực tiếp từ điện thoại</p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </label>
                                    </div>

                                    {!originalImgData && currentSignature && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-sm font-medium text-slate-600 mb-2">Chữ ký hiện tại của bạn:</p>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-center items-center h-24 relative overflow-hidden group">
                                                <img src={currentSignature} alt="Current Signature" className="max-h-full max-w-full object-contain" />
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                                                    <button 
                                                        onClick={handleRemoveSignature}
                                                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-600 transition"
                                                    >
                                                        <Trash2 size={16} /> Xóa
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {originalImgData && (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                                                <div>
                                                    <label className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                                                        <span>Độ đậm (tách nền)</span>
                                                        <span className="text-blue-600">{threshold}</span>
                                                    </label>
                                                    <input 
                                                        type="range" min="50" max="250" 
                                                        value={threshold} 
                                                        onChange={(e) => setThreshold(parseInt(e.target.value))}
                                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                    />
                                                </div>

                                                <div className="pt-2 border-t border-blue-200/50">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2">Màu mực</label>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => setSignatureColor('original')}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${signatureColor === 'original' ? 'bg-white border-blue-400 text-blue-700 shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            Màu gốc
                                                        </button>
                                                        <button 
                                                            onClick={() => setSignatureColor('blue')}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${signatureColor === 'blue' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            Xanh dương
                                                        </button>
                                                        <button 
                                                            onClick={() => setSignatureColor('black')}
                                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${signatureColor === 'black' ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            Đen tuyền
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                <div className="pt-3 mt-3 border-t border-blue-200/50">
                                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer w-fit">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={removeBorders} 
                                                            onChange={(e) => setRemoveBorders(e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                        />
                                                        Tự xóa viền/rác mép ảnh
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Khu vực Hiển thị Kết Quả */}
                                <div className="flex flex-col">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Bản xem trước (PNG)</label>
                                    
                                    <div className="flex-1 rounded-xl relative overflow-hidden flex items-center justify-center min-h-[220px]" 
                                         style={{
                                            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h10v10H0zm10 10h10v10H10z\' fill=\'%23f1f5f9\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
                                            backgroundColor: '#ffffff',
                                            border: '2px solid #e2e8f0'
                                         }}>
                                        
                                        {isProcessing ? (
                                            <div className="z-10 flex flex-col items-center text-blue-600">
                                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                                                <p className="text-sm font-bold">Đang xử lý tách nền...</p>
                                            </div>
                                        ) : imageSrc ? (
                                            <img src={imageSrc} alt="Signature Preview" className="z-10 max-w-[90%] max-h-[90%] object-contain drop-shadow-sm" />
                                        ) : (
                                            <div className="z-10 text-slate-400 text-sm flex flex-col items-center">
                                                <p>Chưa có ảnh</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                        >
                            Hủy
                        </button>
                        <button 
                            type="button"
                            onClick={handleSave}
                            disabled={!imageSrc}
                            className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-lg flex items-center gap-2 ${imageSrc ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                        >
                            <CheckCircle2 size={18} /> Lưu chữ ký
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={confirmRemove}
                title="Xóa chữ ký"
                message="Bạn có chắc chắn muốn xóa chữ ký hiện tại?"
                confirmText="Xóa chữ ký"
                onConfirm={() => {
                    setConfirmRemove(false);
                    onSave(null);
                    onClose();
                }}
                onCancel={() => setConfirmRemove(false)}
            />
        </div>
    );
}
