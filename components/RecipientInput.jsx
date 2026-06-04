import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';

export default function RecipientInput({ value, onChange, errorCls, placeholder = "Nhập tên đối tượng...", suggestions = [] }) {
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
        setTimeout(() => {
            if (inputValue) {
                onChange(inputValue);
                saveToHistory(inputValue);
            }
            setIsOpen(false);
        }, 200);
    };

    const combinedHistory = Array.from(new Set([...suggestions, ...history]));
    const filteredHistory = combinedHistory.filter(h => h.toLowerCase().includes((inputValue || '').toLowerCase()));

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleInputBlur}
                    placeholder={placeholder}
                    className={`w-full bg-slate-50 border-2 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-colors pr-10 ${errorCls || 'border-slate-200 focus:border-blue-500 focus:bg-white'}`}
                />
                <div 
                    className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <ChevronDown size={18} className="text-slate-400" />
                </div>
            </div>

            {isOpen && combinedHistory.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 flex flex-col">
                    <div className="overflow-y-auto">
                        {filteredHistory.length > 0 ? filteredHistory.map((item, idx) => (
                            <div 
                                key={idx}
                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group border-b border-slate-50 last:border-0"
                                onClick={() => handleSelect(item)}
                            >
                                <span className="text-sm font-semibold text-slate-700">{item}</span>
                                {history.includes(item) && (
                                    <button 
                                        onClick={(e) => handleDelete(e, item)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition opacity-0 group-hover:opacity-100"
                                        title="Xóa khỏi lịch sử"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        )) : (
                            <div className="px-4 py-3 text-sm text-slate-500 italic">Không tìm thấy đối tượng</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
