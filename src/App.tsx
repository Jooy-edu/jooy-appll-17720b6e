import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ActivationGuard from "@/components/activation/ActivationGuard";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import ProfilePage from "@/components/auth/ProfilePage";
import NotFound from "./pages/NotFound";
import QrScannerPage from "./pages/QrScannerPage";
import WorksheetPage from "./pages/WorksheetPage";
import AIChatPage from "./pages/AIChatPage";
import { LibraryPage } from "./pages/LibraryPage";
import FloatingButtonGroup from "./components/FloatingButtonGroup";
import FullscreenButton from "./components/FullscreenButton";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import { AppUpdatePrompt } from "./components/AppUpdatePrompt";
import { setQueryClient } from "./utils/backgroundSyncService";
import { useParams } from "react-router-dom";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Set the query client reference for background sync
setQueryClient(queryClient);

// Wrapper components to extract params and pass to ActivationGuard
const WorksheetPageWrapper = () => {
  const { id } = useParams();
  return (
    <ActivationGuard documentId={id}>
      <WorksheetPage />
    </ActivationGuard>
  );
};

const AIChatPageWrapper = () => {
  const { worksheetId } = useParams();
  return (
    <ActivationGuard documentId={worksheetId}>
      <AIChatPage />
    </ActivationGuard>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/qr-scanner" element={<QrScannerPage />} />
            <Route path="/auth/login" element={<LoginForm />} />
            <Route path="/auth/register" element={<RegisterForm />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            
            {/* Protected routes */}
            <Route path="/worksheet/:id/:n" element={
              <ProtectedRoute>
                <WorksheetPageWrapper />
              </ProtectedRoute>
            } />
            <Route path="/chat/:worksheetId/:pageNumber" element={
              <ProtectedRoute>
                <AIChatPageWrapper />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ActivationGuard>
                  <ProfilePage />
                </ActivationGuard>
              </ProtectedRoute>
            } />
            {/* Library page - users without level access will be shown activation message */}
            <Route path="/" element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            } />
            
            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FullscreenButton />
          <Routes>
            <Route path="/auth/*" element={null} />
            <Route path="*" element={<FloatingButtonGroup />} />
          </Routes>
          <PWAInstallPrompt />
          <AppUpdatePrompt />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;