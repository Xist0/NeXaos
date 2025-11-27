import { useId } from "react";

const sanitize = (value) =>
  value
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trimStart();

const SecureInput = ({ onChange, value, label, ...rest }) => {
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
        className="secure-input"
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

