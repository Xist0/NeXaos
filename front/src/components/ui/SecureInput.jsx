import { useId } from "react";

const sanitize = (value) => {
  const s = String(value ?? "");
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) continue;
    if (ch === "<" || ch === ">") continue;
    out += ch;
  }
  return out.replace(/\s{2,}/g, " ").trimStart();
};

const SecureInput = ({ onChange, value, label, className = "", ...rest }) => {
  const id = useId();

  const handleChange = (event) => {
    const safeValue = sanitize(event.target.value);
    onChange?.(safeValue, event);
  };

  return (
    <div>
      {label ? (
        <label htmlFor={id} style={{ display: "block", marginBottom: "0.35rem" }}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={`secure-input ${className}`}
        value={value}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        {...rest}
        onChange={handleChange}
      />
    </div>
  );
};

export default SecureInput;

