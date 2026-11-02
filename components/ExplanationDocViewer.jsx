'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Loader2, ExternalLink, AlertCircle } from 'lucide-react';

const loadPdfJsLibrary = () => {
    if (typeof window === 'undefined') return Promise.reject(new Error('Window is undefined'));
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        return Promise.resolve(window.pdfjsLib);
    }
    return new Promise((resolve, reject) => {
        const existingScript = document.getElementById('pdfjs-script');
        if (existingScript) {
            existingScript.addEventListener('load', () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                } else {
                    reject(new Error('pdfjsLib not loaded'));
                }
            });
            return;
        }

        const script = document.createElement('script');
        script.id = 'pdfjs-script';
        script.src = '/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            } else {
                reject(new Error('pdfjsLib not loaded'));
            }
        };
        script.onerror = (e) => {
            // Fallback CDN nếu file tĩnh gặp sự cố
            const cdnScript = document.createElement('script');
            cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            cdnScript.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                } else {
                    reject(e);
                }
            };
            cdnScript.onerror = reject;
            document.head.appendChild(cdnScript);
        };
        document.head.appendChild(script);
    });
};

export default function ExplanationDocViewer({ files = [] }) {
    const [renderedPages, setRenderedPages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [renderProgress, setRenderProgress] = useState('');

    useEffect(() => {
        let isMounted = true;
        if (!Array.isArray(files) || files.length === 0) {
            setRenderedPages([]);
            setIsLoading(false);
            return;
        }

        const renderAllFiles = async () => {
            setIsLoading(true);
            setRenderProgress('Đang chuẩn bị hồ sơ giải trình...');
            const pagesResult = [];

            try {
                // Tải trình đọc PDF không qua bundler để tránh xung đột canvas
                const pdfjsLib = await loadPdfJsLibrary();

                for (let fIdx = 0; fIdx < files.length; fIdx++) {
                    const file = files[fIdx];
                    if (!file || !file.url) continue;

                    const isPdf = (file.type === 'application/pdf') || 
                                  (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.pdf')) ||
                                  (typeof file.url === 'string' && file.url.toLowerCase().includes('.pdf'));

                    if (!isPdf) {
                        // File ảnh thông thường (PNG, JPG, WEBP...)
                        pagesResult.push({
                            id: `${fIdx}-img`,
                            fileName: file.name || `Tài liệu ${fIdx + 1}`,
                            fileUrl: file.url,
                            pageIndex: 1,
                            totalPages: 1,
                            type: 'image',
                            imgUrl: file.url
                        });
                        continue;
                    }

                    // Xử lý file PDF: Render từng trang ra ảnh sắc nét
                    setRenderProgress(`Đang tải file PDF: ${file.name || ''}...`);
                    try {
                        let loadingTask;
                        if (typeof file.url === 'string' && file.url.startsWith('data:application/pdf;base64,')) {
                            const base64Data = file.url.replace(/^data:application\/pdf;base64,/, '');
                            const byteCharacters = atob(base64Data);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            loadingTask = pdfjsLib.getDocument({ data: byteArray });
                        } else {
                            // Cố gắng tải PDF qua fetch để lấy ArrayBuffer, tránh CORS issue nếu có
                            try {
                                const response = await fetch(file.url);
                                const arrayBuffer = await response.arrayBuffer();
                                loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                            } catch (fetchErr) {
                                loadingTask = pdfjsLib.getDocument({ url: file.url, withCredentials: false });
                            }
                        }

                        const pdfDoc = await loadingTask.promise;
                        const numPages = pdfDoc.numPages;

                        for (let pNum = 1; pNum <= numPages; pNum++) {
                            setRenderProgress(`Đang nạp trang ${pNum}/${numPages} (${file.name || ''})...`);
                            const page = await pdfDoc.getPage(pNum);
                            
                            // Scale 2.0 đảm bảo độ nét cao chuẩn A4 khi in (tương đương 180-200 DPI)
                            const viewport = page.getViewport({ scale: 2.0 });
                            const canvas = document.createElement('canvas');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const ctx = canvas.getContext('2d');
                            
                            await page.render({ canvasContext: ctx, viewport }).promise;
                            const pageImg = canvas.toDataURL('image/jpeg', 0.92);

                            pagesResult.push({
                                id: `${fIdx}-pdf-${pNum}`,
                                fileName: file.name || `Tài liệu ${fIdx + 1}`,
                                fileUrl: file.url,
                                pageIndex: pNum,
                                totalPages: numPages,
                                type: 'pdf-page',
                                imgUrl: pageImg
                            });
                        }
                    } catch (pdfErr) {
                        console.error('Lỗi khi render trang PDF:', file.name, pdfErr);
                        // Fallback: nếu lỗi render, lưu lại để hiển thị kèm link mở
                        pagesResult.push({
                            id: `${fIdx}-fallback`,
                            fileName: file.name || `Tài liệu ${fIdx + 1}`,
                            fileUrl: file.url,
                            pageIndex: 1,
                            totalPages: 1,
                            type: 'fallback',
                            imgUrl: null
                        });
                    }
                }

                if (isMounted) {
                    setRenderedPages(pagesResult);
                }
            } catch (err) {
                console.error('Lỗi khởi động pdfjsLib:', err);
                if (isMounted) {
                    setRenderedPages(files.map((f, i) => ({
                        id: `${i}-err`,
                        fileName: f.name || `Tài liệu ${i + 1}`,
                        fileUrl: f.url,
                        pageIndex: 1,
                        totalPages: 1,
                        type: 'fallback',
                        imgUrl: f.url
                    })));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setRenderProgress('');
                }
            }
        };

        renderAllFiles();

        return () => {
            isMounted = false;
        };
    }, [files]);

    if (!Array.isArray(files) || files.length === 0) return null;

    return (
        <div className="w-full flex flex-col items-center gap-6 print:block print:w-full print:m-0 print:p-0">
            {/* Banner trạng thái tải trên màn hình (ẩn khi in) */}
            {isLoading && (
                <div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center gap-3 text-blue-700 text-sm print:hidden shadow-sm animate-pulse w-full max-w-[1100px]">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="font-medium">{renderProgress || 'Đang chuẩn bị trang giải trình để in kèm...'}</span>
                </div>
            )}

            {/* Danh sách từng trang tài liệu giải trình - Hiển thị bên dưới và ngắt trang khi in */}
            {renderedPages.map((page) => (
                <div 
                    key={page.id} 
                    className="print-page-break bg-white p-4 sm:p-8 shadow-md border border-slate-200 w-full max-w-[1100px] mx-auto print:max-w-none print:w-full print:border-none print:shadow-none print:p-0 print:m-0"
                >
                    {/* Header thông tin trang (chỉ hiển thị trên màn hình, tự động ẩn khi in ra giấy) */}
                    <div className="mb-3 pb-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-sans print:hidden">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center bg-blue-600 text-white font-black px-2 py-0.5 rounded text-[10px]">
                                GIẢI TRÌNH
                            </span>
                            <span className="font-bold text-slate-800 truncate max-w-[280px] sm:max-w-[450px]">
                                {page.fileName}
                            </span>
                            {page.totalPages > 1 && (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold text-[11px]">
                                    Trang {page.pageIndex} / {page.totalPages}
                                </span>
                            )}
                        </div>
                        {page.fileUrl && (
                            <a
                                href={page.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold"
                            >
                                <ExternalLink size={12} /> Xem file gốc
                            </a>
                        )}
                    </div>

                    {/* Nội dung trang: Ảnh chất lượng cao của trang PDF hoặc ảnh đính kèm */}
                    {page.imgUrl ? (
                        <div className="w-full flex justify-center bg-white">
                            <img
                                src={page.imgUrl}
                                alt={`${page.fileName} - Trang ${page.pageIndex}`}
                                className="w-full h-auto max-w-full object-contain mx-auto print:w-full print:h-auto"
                                style={{
                                    display: 'block',
                                    pageBreakInside: 'avoid',
                                    breakInside: 'avoid'
                                }}
                            />
                        </div>
                    ) : (
                        /* Fallback trường hợp đặc biệt không thể vẽ canvas (CORS nghiêm ngặt) */
                        <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl my-4">
                            <FileText size={40} className="mx-auto text-amber-500 mb-2" />
                            <p className="font-bold text-slate-700">{page.fileName}</p>
                            <p className="text-xs text-slate-500 mt-1 mb-4">File PDF không thể giải mã trực tiếp trong trang.</p>
                            <a
                                href={page.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
                            >
                                <ExternalLink size={14} /> Mở và in riêng file này
                            </a>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
