import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Sliders, CheckCircle2, RotateCcw, AlertCircle, Trash2 } from 'lucide-react';

export default function SignatureScannerModal({ isOpen, onClose, onSave, currentSignature }) {
    const [imageSrc, setImageSrc] = useState(null);
    const [threshold, setThreshold] = useState(150); // Mức độ sáng/tối để tách nền (0-255)
    const [thickness, setThickness] = useState(0); // Optional: làm đậm nhạt nét chữ (hiệu ứng)
    const [scannedImage, setScannedImage] = useState(null);
    const [error, setError] = useState('');
    const canvasRef = useRef(null);
    const originalImageRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setImageSrc(null);
            setScannedImage(null);
            setError('');
            setThreshold(150);
        }
    }, [isOpen]);

    const processImage = useCallback(() => {
        if (!originalImageRef.current || !canvasRef.current) return;

        const img = originalImageRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Đặt kích thước canvas bằng kích thước ảnh
        canvas.width = img.width;
        canvas.height = img.height;

        // Vẽ ảnh gốc lên canvas
        ctx.drawImage(img, 0, 0);

        // Lấy dữ liệu pixel
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Tìm giới hạn của nét chữ để crop (bounding box)
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        let hasPixels = false;

        // Xử lý từng pixel để loại bỏ nền
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Tính độ xám (grayscale)
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            // Nếu pixel tối hơn threshold (nghĩa là nét chữ)
            if (gray < threshold) {
                // Đổi nét chữ thành màu xanh đen (thường dùng trong ký tên) hoặc đen
                data[i] = 20;     // R
                data[i + 1] = 40; // G
                data[i + 2] = 120; // B
                data[i + 3] = 255; // Alpha (đục)

                // Tính bounding box
                const x = (i / 4) % canvas.width;
                const y = Math.floor((i / 4) / canvas.width);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasPixels = true;
            } else {
                // Nền giấy -> Trong suốt
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Nâng cao: Crop ảnh chữ ký lại cho gọn
        if (hasPixels) {
            // Thêm padding
            const padding = 20;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(canvas.width, maxX + padding);
            maxY = Math.min(canvas.height, maxY + padding);

            const cropWidth = maxX - minX;
            const cropHeight = maxY - minY;

            // Tạo canvas phụ để crop
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;
            const cropCtx = cropCanvas.getContext('2d');
            
            cropCtx.drawImage(
                canvas,
                minX, minY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            setScannedImage(cropCanvas.toDataURL('image/png'));
        } else {
            setScannedImage(canvas.toDataURL('image/png'));
        }
    }, [threshold]);

    useEffect(() => {
        if (imageSrc) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                // Resize ảnh gốc nếu quá lớn (giảm tải cho canvas)
                const MAX_WIDTH = 1000;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(img, 0, 0, width, height);

                const resizedImg = new Image();
                resizedImg.onload = () => {
                    originalImageRef.current = resizedImg;
                    processImage();
                };
                resizedImg.src = tempCanvas.toDataURL('image/jpeg', 0.8);
            };
            img.onerror = () => {
                setError('Không thể đọc định dạng ảnh này. Vui lòng thử ảnh khác.');
            };
            img.src = imageSrc;
        }
    }, [imageSrc, processImage]);

    // Chạy lại processImage mỗi khi kéo slider
    useEffect(() => {
        if (originalImageRef.current) {
            processImage();
        }
    }, [threshold, processImage]);

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
            setImageSrc(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (scannedImage) {
            onSave(scannedImage); // Truyền chuỗi base64 về hàm cha
            onClose();
        } else {
            setError('Vui lòng scan ảnh trước khi lưu!');
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
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <header className="bg-slate-900 text-white p-5 flex justify-between items-center">
                    <h3 className="font-extrabold text-lg flex items-center gap-2">
                        <Upload size={20} className="text-blue-400" /> Quét & Cập nhật chữ ký
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Khu vực Upload Ảnh */}
                        <div className="space-y-4 border-r-0 md:border-r border-slate-100 pr-0 md:pr-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">1. Upload ảnh chữ ký chụp trên giấy</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-2 text-slate-400 group-hover:text-blue-500 transition" />
                                        <p className="mb-1 text-sm text-slate-500 font-medium">Bấm để chọn ảnh</p>
                                        <p className="text-xs text-slate-400">hoặc chụp trực tiếp từ điện thoại</p>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </label>
                            </div>

                            {/* Điều chỉnh độ nhạy */}
                            {imageSrc && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                                        <Sliders size={16} className="text-blue-600" /> Điều chỉnh độ đậm nhạt
                                    </label>
                                    <input 
                                        type="range" 
                                        min="50" max="220" 
                                        value={threshold} 
                                        onChange={(e) => setThreshold(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                                        <span>Lấy ít nét chữ (Mờ)</span>
                                        <span>Lấy nhiều nét chữ (Đậm)</span>
                                    </div>
                                </div>
                            )}

                            {!imageSrc && currentSignature && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-sm font-medium text-slate-600 mb-2">Chữ ký hiện tại của bạn:</p>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-center items-center h-24 relative overflow-hidden group">
                                        {/* Hiển thị chữ ký hiện tại */}
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
                        </div>

                        {/* Khu vực Hiển thị Kết Quả */}
                        <div className="flex flex-col">
                            <label className="block text-sm font-bold text-slate-700 mb-2">2. Kết quả quét chữ ký (Trong suốt)</label>
                            <div className="flex-1 bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-slate-100 border-2 border-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center min-h-[200px]">
                                {/* Checkerboard pattern for transparency visualization */}
                                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}></div>
                                
                                {scannedImage ? (
                                    <img src={scannedImage} alt="Scanned Signature Preview" className="z-10 max-w-[90%] max-h-[90%] object-contain drop-shadow-md" />
                                ) : (
                                    <div className="z-10 text-slate-400 text-sm flex flex-col items-center">
                                        <p>Chưa có ảnh quét</p>
                                        <p className="text-xs mt-1">(Vui lòng chọn ảnh ở bước 1)</p>
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
                                setScannedImage(null);
                            }}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-2"
                        >
                            <RotateCcw size={18} /> Làm lại
                        </button>
                        <button 
                            type="button"
                            onClick={handleSave}
                            disabled={!scannedImage}
                            className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-lg flex items-center gap-2 ${scannedImage ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                        >
                            <CheckCircle2 size={18} /> Lưu chữ ký
                        </button>
                    </div>
                </div>
            </div>
            {/* Ẩn canvas dùng để xử lý logic */}
            <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
}
