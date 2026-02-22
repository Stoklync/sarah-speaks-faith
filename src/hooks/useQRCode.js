import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

export function useQRCode(url, options = {}) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      setDataUrl('');
      setError(null);
      return;
    }
    setError(null);
    QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' }, ...options })
      .then(setDataUrl)
      .catch((err) => {
        setError(err);
        setDataUrl('');
      });
  }, [url]);

  return { dataUrl, error };
}
