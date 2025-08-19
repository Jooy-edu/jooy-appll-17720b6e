import React from "react";
import { useLocation } from "react-router-dom";
import QRScannerButton from "./QRScannerButton";
import LibraryButton from "./LibraryButton";
import UserMenu from "./UserMenu";

const FloatingButtonGroup: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine which buttons to show based on current route
  const showLibraryButton = currentPath !== "/";
  const showQRButton = currentPath !== "/qr-scanner";

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {showLibraryButton && <LibraryButton />}
      {showQRButton && <QRScannerButton />}
      <UserMenu />
    </div>
  );
};

export default FloatingButtonGroup;