import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { PortalLayout } from './layouts/PortalLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { AcademicsPage } from './pages/AcademicsPage';
import { CommunicationsPage } from './pages/CommunicationsPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { EventsPage } from './pages/EventsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { AccommodationPage } from './pages/AccommodationPage';
import { LostFoundPage } from './pages/LostFoundPage';
import { DirectoryMapPage } from './pages/DirectoryMapPage';
import { AssistantPage } from './pages/AssistantPage';
import { AdminPage } from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<PortalLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/academics" element={<AcademicsPage />} />
              <Route path="/communications" element={<CommunicationsPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/accommodation" element={<AccommodationPage />} />
              <Route path="/lost-found" element={<LostFoundPage />} />
              <Route path="/directory" element={<DirectoryMapPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
