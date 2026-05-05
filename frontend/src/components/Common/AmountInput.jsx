import React, { useState, useEffect } from'react';

/**
 * Professional AmountInput Component
 * Formats numbers with commas as user types (e.g., 300,000)
 * Prevents non-numeric input and helps avoid zero-count errors.
 */
const AmountInput = ({ value, onChange, placeholder, className, name, ...props }) => {
 const [displayValue, setDisplayValue] = useState('');

 // Format number with commas: 1234567 ->"1,234,567"
 const formatNumber = (num) => {
 if (!num && num !== 0) return'';
 return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
 };

 // Keep display value in sync with external value props
 useEffect(() => {
 if (value !== undefined && value !== null) {
 const cleanValue = value.toString().replace(/,/g,'');
 setDisplayValue(formatNumber(cleanValue));
 }
 }, [value]);

 const handleChange = (e) => {
 // Remove everything except digits
 const rawValue = e.target.value.replace(/\D/g,'');
 
 // Prevent extremely large numbers to avoid overflow issues (optional limit)
 if (rawValue.length > 15) return;

 // Update internal display state
 setDisplayValue(formatNumber(rawValue));

 // Call external onChange with pure numeric string or number
 if (onChange) {
 const syntheticEvent = {
 target: {
 name,
 value: rawValue,
 type:'text'
 }
 };
 onChange(syntheticEvent);
 }
 };

 return (
 <div className="relative w-full">
 <input
 {...props}
 type="text"
 name={name}
 value={displayValue}
 onChange={handleChange}
 placeholder={placeholder}
 className={`${className} font-mono`} // Monospace font helps align digits
 inputMode="numeric" // Forces numeric keyboard on mobile
 />
 {displayValue && (
 <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[8px] font-black opacity-30 pointer-events-none capitalize">
 UZS
 </span>
 )}
 </div>
 );
};

export default AmountInput;
