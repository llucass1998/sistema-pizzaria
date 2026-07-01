import React from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const baseStyles =
    'px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2';

  const variants = {
    primary: 'bg-red-600 hover:bg-red-700 text-white',
    secondary:
      'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100',
    outline: 'border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
