import SecureButton from "../../ui/SecureButton";

const SmallButton = ({ children, variant = "outline", className = "", ...props }) => {
  return (
    <SecureButton
      type="button"
      variant={variant}
      className={`px-3 py-2 text-xs h-10 ${className}`}
      {...props}
    >
      {children}
    </SecureButton>
  );
};

export default SmallButton;
