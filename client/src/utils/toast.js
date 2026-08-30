import toast from 'react-hot-toast';

const defaults = {
  success: { duration: 2500 },
  error: { duration: 3000 },
};

function make(type) {
  return (message, opts = {}) => {
    const id = opts.id || `${type}:${message}`;
    const options = { ...defaults[type], ...opts, id };
    return toast[type](message, options);
  };
}

export const toastOnce = {
  success: make('success'),
  error: make('error'),
};
