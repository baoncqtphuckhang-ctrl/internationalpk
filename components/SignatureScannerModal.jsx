import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, RotateCcw, AlertCircle, Trash2 } from 'lucide-react';

export default function SignatureScannerModal({ isOpen, onClose, onSave, currentSignature }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [error, setError] = useState('');
    
    // New states for background removal
    const [originalImgData, setOriginalImgData] = useState(null);
    const [threshold, setThreshold] = useState(160);
    const [isProcessing, setIsProcessing] = useState(false);
    const [signatureColor, setSignatureColor] = useState('original'); // 'original', 'blue', 'black'

    useEffect(() => {
        if (!isOpen) {
            setImageSrc(null);
            setOriginalImgData(null);
            setError('');
            setThreshold(160);
            setSignatureColor('original');
        }
    }, [isOpen]);

    // Process image whenever threshold, color or original data changes
    useEffect(() => {
        if (!originalImgData) return;
        
        setIsProcessing(true);
        // Use a small timeout to not block the UI thread immediately while sliding
        const timer = setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = originalImgData.width;
            canvas.height = originalImgData.height;
            const ctx = canvas.getContext('2d');
            
            // Create a copy of the original data to modify
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
                
                // Calculate perceived brightness
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                
                let alpha = 255;
                if (brightness >= upper) {
                    alpha = 0;
                } else if (brightness <= lower) {
                    alpha = 255;
                } else {
                    alpha = Math.round(((upper - brightness) / (upper - lower)) * 255);
                }
                
                data[i + 3] = alpha;
                
                // Apply color tint if selected and it's not fully transparent
                if (alpha > 0) {
                    if (signatureColor === 'blue') {
                        data[i] = 10;     // R
                        data[i + 1] = 20; // G
                        data[i + 2] = 150; // B
                    } else if (signatureColor === 'black') {
                        data[i] = 0;
                        data[i + 1] = 0;
                        data[i + 2] = 0;
                    } else {
                        // Original color, just make it a bit darker for better contrast
                        data[i] = Math.max(0, r - 30);
                        data[i + 1] = Math.max(0, g - 30);
                        data[i + 2] = Math.max(0, b - 30);
                    }
                }
            }
            
            ctx.putImageData(imgData, 0, 0);
            
            // Auto crop the transparent background to tighten the bounding box
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
                // Add padding
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
    }, [originalImgData, threshold, signatureColor]);

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
                const MAX_WIDTH = 800; // Resize to reasonable size for processing
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
            setError('Vui lòng chọn ảnh trước khi lưu!');
        }
    };

    const handleRemoveSignature = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa chữ ký hiện tại không?')) {
            onSave(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="bg-slate-900 text-white p-5 flex justify-between items-center">
                    <h3 className="font-extrabold text-lg flex items-center gap-2">
                        <Upload size={20} className="text-blue-400" /> Cập nhật chữ ký điện tử
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-bold">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                        {/* Khu vực Upload Ảnh */}
                        <div className="space-y-4 border-r-0 md:border-r border-slate-100 pr-0 md:pr-8">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">1. Upload ảnh chữ ký (viết trên giấy trắng)</label>
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
                                                <Trash2 size={16} /> Xóa chữ ký
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
                                                <span>Độ đậm chữ ký (tách nền)</span>
                                                <span className="text-blue-600">{threshold}</span>
                                            </label>
                                            <input 
                                                type="range" 
                                                min="50" 
                                                max="250" 
                                                value={threshold} 
                                                onChange={(e) => setThreshold(parseInt(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <p className="text-xs text-slate-500 mt-1.5">Kéo thanh trượt để loại bỏ nền giấy trắng, giữ lại nét mực rõ nhất.</p>
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
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Khu vực Hiển thị Kết Quả */}
                        <div className="flex flex-col">
                            <label className="block text-sm font-bold text-slate-700 mb-2">2. Bản xem trước (Chữ ký điện tử dạng PNG)</label>
                            
                            {/* Nền caro để dễ nhìn phần trong suốt */}
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
                                        <p className="text-xs mt-1">(Vui lòng tải ảnh lên ở bước 1)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button 
                            type="button"
                            onClick={() => {
                                setImageSrc(null);
                                setOriginalImgData(null);
                                setThreshold(160);
                            }}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                        >
                            <RotateCcw size={18} /> Làm lại
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
        </div>
    );
}

