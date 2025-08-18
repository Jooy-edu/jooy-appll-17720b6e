import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

const QRScannerButton: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/qr-scanner");
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed top-4 right-4 z-80 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
      size="icon"
      aria-label="Scan QR Code"
    >
      <QrCode className="h-5 w-5" />
    </Button>
  );
};

export default QRScannerButton;