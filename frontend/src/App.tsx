import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import GalleryPage from './pages/GalleryPage';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
