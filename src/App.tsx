import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import ProfilePage from "@/components/auth/ProfilePage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QrScannerPage from "./pages/QrScannerPage";
import WorksheetPage from "./pages/WorksheetPage";
import AIChatPage from "./pages/AIChatPage";
import QRScannerButton from "./components/QRScannerButton";
import FullscreenButton from "./components/FullscreenButton";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<QrScannerPage />} />
            <Route path="/auth/login" element={<LoginForm />} />
            <Route path="/auth/register" element={<RegisterForm />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            
            {/* Protected routes */}
            <Route path="/worksheet/:id/:n" element={
              <ProtectedRoute>
                <WorksheetPage />
              </ProtectedRoute>
            } />
            <Route path="/chat/:worksheetId/:pageNumber" element={
              <ProtectedRoute>
                <AIChatPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/home" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            
            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FullscreenButton />
          <Routes>
            <Route path="/" element={null} />
            <Route path="/auth/*" element={null} />
            <Route path="*" element={<QRScannerButton />} />
          </Routes>
          <PWAInstallPrompt />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;