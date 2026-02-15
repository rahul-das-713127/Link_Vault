import { useEffect, useState } from 'react';
import { getFeatures } from './api.js';

const defaultFeatures = {
  auth: true,
  password: true,
  oneTime: true,
  limits: true,
  manualDelete: true,
  fileTypeValidation: true
};

export default function useFeatures() {
  const [features, setFeatures] = useState(defaultFeatures);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        const data = await getFeatures();
        if (!cancelled) setFeatures({ ...defaultFeatures, ...data });
      } catch {
        if (!cancelled) setFeatures(defaultFeatures);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { features, loading };
}
