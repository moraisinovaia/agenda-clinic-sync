import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FutureDateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

const FutureDateInput = React.memo(({ 
  value, 
  onChange, 
  label = "Data", 
  required = false, 
  className = "",
  id 
}: FutureDateInputProps) => {
  const [displayValue, setDisplayValue] = useState('');

  // Formatar data para exibição (DD/MM/AAAA)
  const formatForDisplay = useCallback((isoDate: string): string => {
    if (!isoDate) return '';
    
    const [year, month, day] = isoDate.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return '';
  }, []);

  // Converter para formato ISO (YYYY-MM-DD)
  const convertToISO = useCallback((displayDate: string): string | null => {
    if (displayDate.length !== 10) return null;
    
    const cleanDate = displayDate.replace(/\D/g, '');
    if (cleanDate.length !== 8) return null;
    
    let day = cleanDate.substring(0, 2);
    let month = cleanDate.substring(2, 4);
    let year = cleanDate.substring(4, 8);
    
    // Conversão automática de anos de 2 dígitos
    if (year.length === 2) {
      const yearNum = parseInt(year);
      if (yearNum >= 0 && yearNum <= 30) {
        year = `20${year}`;
      } else {
        year = `19${year}`;
      }
    }
    
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    // Validações básicas
    if (dayNum < 1 || dayNum > 31) return null;
    if (monthNum < 1 || monthNum > 12) return null;
    if (yearNum < 1900 || yearNum > 2100) return null;
    
    const date = new Date(yearNum, monthNum - 1, dayNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validar se é uma data válida
    if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
      return null;
    }
    
    // Validar se é data futura
    if (date < today) return null;
    
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }, []);

  // Processar entrada do usuário
  const processInput = useCallback((input: string): string => {
    const onlyNumbers = input.replace(/\D/g, '');
    
    if (onlyNumbers.length === 0) return '';
    if (onlyNumbers.length <= 2) return onlyNumbers;
    if (onlyNumbers.length <= 4) return `${onlyNumbers.slice(0, 2)}/${onlyNumbers.slice(2)}`;
    return `${onlyNumbers.slice(0, 2)}/${onlyNumbers.slice(2, 4)}/${onlyNumbers.slice(4, 8)}`;
  }, []);

  // Sincronizar valor com exibição
  useEffect(() => {
    setDisplayValue(formatForDisplay(value));
  }, [value, formatForDisplay]);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = (e.target as HTMLInputElement).value;
    const onlyNumbers = input.replace(/[^\d]/g, '');
    
    // Bloquear rigorosamente mais de 8 dígitos
    if (onlyNumbers.length > 8) {
      e.preventDefault();
      return;
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const currentNumbers = displayValue.replace(/\D/g, '');
    const selStart = inputEl.selectionStart ?? 0;
    const selEnd = inputEl.selectionEnd ?? 0;
    const selectedDigits = displayValue.slice(selStart, selEnd).replace(/\D/g, '').length;

    if (/\d/.test(e.key)) {
      const willHave = currentNumbers.length - selectedDigits + 1;
      // Permite digitar números se estiver substituindo seleção; bloqueia apenas se exceder 8 dígitos
      if (willHave > 8) {
        e.preventDefault();
      }
    }
  }, [displayValue]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const onlyNumbers = pastedText.replace(/[^\d]/g, '');
    
    // Limitar a 8 dígitos na colagem
    const limitedNumbers = onlyNumbers.substring(0, 8);
    const processed = processInput(limitedNumbers);
    setDisplayValue(processed);
    
    if (processed.length === 10) {
      const isoDate = convertToISO(processed);
      if (isoDate) {
        onChange(isoDate);
      }
    } else if (processed === '') {
      onChange('');
    }
  }, [processInput, convertToISO, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const onlyNumbers = input.replace(/[^\d]/g, '');
    
    // Validação rigorosa: não permitir mais de 8 dígitos
    if (onlyNumbers.length > 8) {
      return;
    }
    
    const processed = processInput(input);
    setDisplayValue(processed);
    
    if (processed.length === 10) {
      const isoDate = convertToISO(processed);
      if (isoDate) {
        onChange(isoDate);
      }
    } else if (processed === '') {
      onChange('');
    }
  }, [processInput, convertToISO, onChange]);

  const handleBlur = useCallback(() => {
    // Ao perder foco, tentar processar se tiver conteúdo parcial
    if (displayValue && displayValue.length < 10) {
      const numbers = displayValue.replace(/\D/g, '');
      if (numbers.length === 8) {
        const fullDisplay = processInput(numbers);
        setDisplayValue(fullDisplay);
        
        const isoDate = convertToISO(fullDisplay);
        if (isoDate) {
          onChange(isoDate);
        }
      }
    }
  }, [displayValue, processInput, convertToISO, onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Seleciona todo o conteúdo ao focar para facilitar a sobrescrita
    e.currentTarget.select();
  }, []);

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Input
        id={id}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="DD/MM/AAAA"
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        inputMode="numeric"
        maxLength={10}
        required={required}
        className={className}
      />
    </div>
  );
});

FutureDateInput.displayName = 'FutureDateInput';

export default FutureDateInput;