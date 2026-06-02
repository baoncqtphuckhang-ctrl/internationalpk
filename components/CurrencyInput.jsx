import React, { useState, useEffect } from 'react';
import { formatCurrency, parseVietnameseNumber } from '@/lib/utils';

export default function CurrencyInput({ value, onChange, placeholder, className }) {
    const [localValue, setLocalValue] = useState(value ? formatCurrency(value) : '');

    useEffect(() => {
        const expected = value ? formatCurrency(value) : '';
        // Only update local value if the parsed external value is different
        // This allows trailing dots/commas to stay while typing
        if (parseVietnameseNumber(localValue) !== value) {
            setLocalValue(expected);
        }
    }, [value]);

    const handleChange = (e) => {
        const text = e.target.value;
        const clean = text.replace(/[^0-9.,]/g, '');
        setLocalValue(clean);
        onChange(parseVietnameseNumber(clean));
    };

    const handleBlur = () => {
        // Format nicely when leaving the input
        setLocalValue(value ? formatCurrency(value) : '');
    };

    return (
        <input 
            type="text" 
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
        />
    );
}
