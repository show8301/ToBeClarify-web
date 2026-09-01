import { createContext, useContext } from 'react';

export const AdminImageProcessingContext = createContext(null);

export function useAdminImageProcessing() {
  const service = useContext(AdminImageProcessingContext);
  if (!service) throw new Error('圖片處理服務尚未掛載。');
  return service;
}
