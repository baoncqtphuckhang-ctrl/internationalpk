import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';

export default function RecipientInput({ value, onChange, errorCls, placeholder = "Nhập tên đối tượng..." }) {
    const [history, setHistory] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [isTypingNew, setIsTypingNew] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const saved = localStorage.getItem('recipient_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch(e) {}
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const saveToHistory = (newVal) => {
        if (!newVal || !newVal.trim()) return;
        const trimmed = newVal.trim();
        const updated = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 50); // keep max 50
        setHistory(updated);
        localStorage.setItem('recipient_history', JSON.stringify(updated));
    };

    const handleDelete = (e, itemToRemove) => {
        e.stopPropagation();
        const updated = history.filter(h => h !== itemToRemove);
        setHistory(updated);
        localStorage.setItem('recipient_history', JSON.stringify(updated));
    };

    const handleSelect = (item) => {
        onChange(item);
        setInputValue(item);
        setIsOpen(false);
        setIsTypingNew(false);
    };

    const handleInputBlur = () => {
        if (inputValue) {
            onChange(inputValue);
            saveToHistory(inputValue);
        }
    };

    const filteredHistory = history.filter(h => h.toLowerCase().includes((inputValue || '').toLowerCase()));

    return (
        <div ref={wrapperRef} className="relative">
            {!isTypingNew && history.length > 0 ? (
                <div 
                    className={`flex items-center justify-between cursor-pointer bg-slate-50 border-2 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors ${errorCls || 'border-slate-200'}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className={value ? 'text-slate-700' : 'text-slate-400 font-normal'}>
                        {value || placeholder}
                    </span>
                    <ChevronDown size={18} className="text-slate-400" />
                </div>
            ) : (
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        onChange(e.target.value);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleInputBlur}
                    placeholder={placeholder}
                    className={`w-full bg-slate-50 border-2 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors ${errorCls || 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                />
            )}

            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 flex flex-col">
                    {!isTypingNew && history.length > 0 && (
                        <div className="overflow-y-auto">
                            {filteredHistory.length > 0 ? filteredHistory.map((item, idx) => (
                                <div 
                                    key={idx}
                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group border-b border-slate-50 last:border-0"
                                    onClick={() => handleSelect(item)}
                                >
                                    <span className="text-sm font-semibold text-slate-700">{item}</span>
                                    <button 
                                        onClick={(e) => handleDelete(e, item)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition opacity-0 group-hover:opacity-100"
                                        title="Xóa khỏi lịch sử"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )) : (
                                <div className="px-4 py-3 text-sm text-slate-500 italic">Không tìm thấy trong lịch sử</div>
                            )}
                        </div>
                    )}
                    
                    {!isTypingNew && (
                        <div 
                            className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer flex items-center gap-2 font-bold text-sm border-t border-blue-100 transition"
                            onClick={() => {
                                setIsTypingNew(true);
                                setIsOpen(false);
                                setInputValue('');
                                onChange('');
                            }}
                        >
                            <Plus size={16} /> Thêm đối tượng mới
                        </div>
                    )}
                    
                    {isTypingNew && history.length > 0 && (
                        <div 
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer text-center font-bold text-xs transition"
                            onClick={() => setIsTypingNew(false)}
                        >
                            Quay lại danh sách
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
