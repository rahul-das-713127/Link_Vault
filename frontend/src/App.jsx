import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import SharePage from './pages/SharePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/s/:id" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
