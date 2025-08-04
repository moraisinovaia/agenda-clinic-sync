import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateOfBirthInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export const DateOfBirthInput = React.memo(({
  value,
  onChange,
  label = "Data de Nascimento *",
  required = true,
  className = "",
  id = "dataNascimento"
}: DateOfBirthInputProps) => {
  const [displayValue, setDisplayValue] = useState('');

  // Converter data para exibição (DD/MM/AAAA)
  const formatForDisplay = useCallback((dateString: string) => {
    if (!dateString) return '';
    
    // Se já está no formato YYYY-MM-DD
    if (dateString.includes('-') && dateString.length === 10) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    
    return dateString;
  }, []);

  // Converter ano de 2 dígitos para 4 dígitos
  const convertYear = useCallback((yearStr: string): string => {
    if (yearStr.length !== 2) return yearStr;
    
    const year = parseInt(yearStr);
    if (year >= 0 && year <= 30) {
      return `20${yearStr.padStart(2, '0')}`;
    } else if (year >= 31 && year <= 99) {
      return `19${yearStr}`;
    }
    
    return yearStr;
  }, []);

  // Validar se é uma data válida
  const isValidDate = useCallback((day: number, month: number, year: number): boolean => {
    const date = new Date(year, month - 1, day);
    const today = new Date();
    
    // Verificar se a data é real
    if (date.getDate() !== day || date.getMonth() !== (month - 1) || date.getFullYear() !== year) {
      return false;
    }
    
    // Não pode ser no futuro
    if (date > today) {
      return false;
    }
    
    // Idade mínima de 120 anos (aproximadamente)
    const minYear = today.getFullYear() - 120;
    if (year < minYear) {
      return false;
    }
    
    return true;
  }, []);

  // Processar entrada do usuário
  const processInput = useCallback((input: string) => {
    // Remover tudo exceto números
    let onlyNumbers = input.replace(/[^\d]/g, '');
    
    // BLOQUEAR RIGOROSAMENTE: máximo 8 dígitos (DD + MM + AAAA)
    if (onlyNumbers.length > 8) {
      return displayValue; // Retorna o valor atual, impedindo alteração
    }
    
    // Aplicar máscara progressiva DD/MM/AAAA
    if (onlyNumbers.length === 0) {
      return '';
    } else if (onlyNumbers.length <= 2) {
      return onlyNumbers;
    } else if (onlyNumbers.length <= 4) {
      return onlyNumbers.replace(/(\d{2})(\d{0,2})/, '$1/$2');
    } else {
      return onlyNumbers.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
    }
  }, [displayValue]);

  // Converter para formato ISO (YYYY-MM-DD)
  const convertToISO = useCallback((displayValue: string): string => {
    const parts = displayValue.split('/');
    if (parts.length !== 3) return '';
    
    let [day, month, year] = parts;
    
    // Converter ano se necessário
    if (year.length === 2) {
      year = convertYear(year);
    } else if (year.length < 4) {
      return ''; // Ano incompleto
    }
    
    // Validar números
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
      return '';
    }
    
    // Validar ranges básicos
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
      return '';
    }
    
    // Validar data completa
    if (!isValidDate(dayNum, monthNum, yearNum)) {
      return '';
    }
    
    // Formatar com zeros à esquerda
    const formattedDay = day.padStart(2, '0');
    const formattedMonth = month.padStart(2, '0');
    
    return `${year}-${formattedMonth}-${formattedDay}`;
  }, [convertYear, isValidDate]);

  // Sincronizar com o valor externo
  useEffect(() => {
    setDisplayValue(formatForDisplay(value));
  }, [value, formatForDisplay]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    const processed = processInput(input);
    setDisplayValue(processed);
    
    // Se tem formato completo (DD/MM/AAAA), tentar converter
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
    if (displayValue.length >= 8 && displayValue.length < 10) {
      const parts = displayValue.split('/');
      if (parts.length === 3 && parts[2].length >= 2) {
        const processed = displayValue.length === 8 ? displayValue.substring(0, 8) : displayValue;
        const withSlashes = processed.replace(/(\d{2})(\d{2})(\d{2,4})/, '$1/$2/$3');
        setDisplayValue(withSlashes);
        
        const isoDate = convertToISO(withSlashes);
        if (isoDate) {
          onChange(isoDate);
        }
      }
    }
  }, [displayValue, convertToISO, onChange]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="DD/MM/AAAA"
        
        required={required}
        className={className}
      />
      <p className="text-xs text-muted-foreground mt-1">
        Digite DD/MM/AA ou DD/MM/AAAA. Anos 00-30 = 2000s, 31-99 = 1900s
      </p>
    </div>
  );
});

DateOfBirthInput.displayName = 'DateOfBirthInput';