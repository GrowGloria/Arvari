import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ContentProvider } from './store/contentStore';
import { LightboxProvider } from './components/Lightbox';
import ErrorBoundary from './components/ErrorBoundary';
import SiteBackground from './components/SiteBackground';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home/Home';
import Catalog from './pages/Catalog/Catalog';
import Article from './pages/Article/Article';
import Editor from './pages/Editor/Editor';
import Chronology from './pages/Chronology/Chronology';
import Suggest from './pages/Suggest/Suggest';
import MapPage from './pages/Map/MapPage';
import NotFound from './pages/NotFound/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ContentProvider>
          <LightboxProvider>
            <ScrollToTop />
            <SiteBackground />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/catalog/:categorySlug" element={<Catalog />} />
              <Route path="/article/:slug" element={<Article />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/chronology" element={<Chronology />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/suggest" element={<Suggest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </LightboxProvider>
        </ContentProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
