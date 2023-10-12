export interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
}

export const Label: React.FC<LabelProps> = ({ htmlFor, children }) => {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
    >
      {children}
    </label>
  );
};

export interface InputProps {
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  type,
  name,
  id,
  placeholder,
  required,
  disabled,
}) => {
  return (
    <input
      type={type}
      name={name}
      id={id}
      className="border border-gray-300 w-full mb-4 px-3 py-2 rounded text-gray-900 dark:bg-gray-700 dark:text-white dark:border-white"
      placeholder={placeholder}
      required={required}
      disabled={disabled}
    />
  );
};
