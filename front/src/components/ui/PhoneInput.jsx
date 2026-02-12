import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

const PhoneInput = ({ value = "", onChange, className = "", placeholder, required, disabled }) => {
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef(null);

  // Форматирование телефона: +7 (000) - 000 - 00 -00
  const formatPhone = (input) => {
    // Удаляем все нецифровые символы
    let digits = input.replace(/\D/g, "");
    
    // Если начинается с 8, заменяем на 7
    if (digits.startsWith("8")) {
      digits = "7" + digits.slice(1);
    }
    
    // Если начинается не с 7, добавляем 7
    if (digits.length > 0 && !digits.startsWith("7")) {
      digits = "7" + digits;
    }
    
    // Ограничиваем до 11 цифр (7 + 10)
    digits = digits.slice(0, 11);
    
    // Форматируем
    if (digits.length === 0 || digits === "7") {
      return "+7 (";
    } else if (digits.length <= 4) {
      return `+7 (${digits.slice(1)}`;
    } else if (digits.length <= 7) {
      return `+7 (${digits.slice(1, 4)}) - ${digits.slice(4)}`;
    } else if (digits.length <= 9) {
      return `+7 (${digits.slice(1, 4)}) - ${digits.slice(4, 7)} - ${digits.slice(7)}`;
    } else {
      return `+7 (${digits.slice(1, 4)}) - ${digits.slice(4, 7)} - ${digits.slice(7, 9)} - ${digits.slice(9)}`;
    }
  };

  // Извлекаем только цифры из форматированного значения
  const getDigits = (formatted) => {
    return formatted.replace(/\D/g, "");
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (value) {
        // Если пришло значение извне, форматируем его
        const digits = getDigits(value);
        if (digits) {
          setDisplayValue(formatPhone(digits));
        } else {
          setDisplayValue("+7 (");
        }
      } else {
        setDisplayValue("+7 (");
      }
    });
  }, [value]);

  const handleChange = (e) => {
    const input = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    // Если пользователь удаляет символы в начале, не позволяем удалить +7 (
    if (input.length < 4 && !input.startsWith("+7 (")) {
      setDisplayValue("+7 (");
      onChange?.("+7");
      return;
    }
    
    const formatted = formatPhone(input);
    setDisplayValue(formatted);
    
    // Извлекаем цифры для передачи в onChange
    const digits = getDigits(formatted);
    const phoneValue = digits.length >= 1 ? `+${digits}` : "";
    onChange?.(phoneValue);
    
    // Восстанавливаем позицию курсора
    setTimeout(() => {
      if (inputRef.current) {
        // Корректируем позицию с учетом форматирования
        const beforeCursor = input.slice(0, cursorPosition);
        const digitsBefore = getDigits(beforeCursor).length;
        let pos = 4; // Начало после "+7 ("
        
        if (digitsBefore > 0) pos += digitsBefore;
        if (digitsBefore > 3) pos += 3; // ") - "
        if (digitsBefore > 6) pos += 3; // " - "
        if (digitsBefore > 8) pos += 3; // " - "
        
        inputRef.current.setSelectionRange(Math.min(pos, formatted.length), Math.min(pos, formatted.length));
      }
    }, 0);
  };

  const handleFocus = (e) => {
    // Если поле пустое, устанавливаем курсор после "+7 ("
    if (displayValue === "+7 (") {
      setTimeout(() => {
        e.target.setSelectionRange(4, 4);
      }, 0);
    }
  };

  const handleKeyDown = (e) => {
    // Предотвращаем удаление "+7 (" при Backspace
    if (e.key === "Backspace" && inputRef.current?.selectionStart <= 4) {
      e.preventDefault();
    }
  };

  return (
    <input
      ref={inputRef}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder={placeholder || "+7 (000) - 000 - 00 -00"}
      className={clsx("secure-input", className)}
      required={required}
      disabled={disabled}
      maxLength={25} // Максимальная длина с форматированием
    />
  );
};

export default PhoneInput;

