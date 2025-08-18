import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QrScanner from "react-qr-scanner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";
import UserMenu from "@/components/UserMenu";

const QrScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleScan = (data: { text: string } | null) => {
    if (data && data.text) {
      const qrData = data.text;
      const match = qrData.match(/^([A-Za-z]+)(\d+)$/);
      
      if (match) {
        const id = match[1];
        const n = match[2];
        setScanning(false);
        navigate(`/worksheet/${id}/${n}`);
      } else {
        setError(t('qrScanner.invalidFormat'));
        toast({
          title: t('qrScanner.invalidFormat'),
          description: t('qrScanner.invalidFormatDesc'),
          variant: "destructive"
        });
      }
    }
  };

  const handleError = (err: Error) => {
    console.error(err);
    setError(t('qrScanner.errorAccessing', { message: err.message }));
    toast({
      title: t('qrScanner.cameraError'),
      description: t('qrScanner.cameraErrorDesc'),
      variant: "destructive"
    });
  };

  const resetScanner = () => {
    setError(null);
    setScanning(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Language Selection Button */}
      <div className="fixed top-4 left-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white shadow-md">
              <Languages className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => changeLanguage('ar')}>
              {t('common.arabic')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('en')}>
              {t('common.english')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Menu */}
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gradient-clip" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {t('qrScanner.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={resetScanner} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                {t('qrScanner.tryAgain')}
              </Button>
            </div>
          ) : (
            <div className="aspect-square rounded-lg overflow-hidden border-2 border-blue-200 mb-4">
              {scanning && (
                <QrScanner
                  delay={300}
                  onError={handleError}
                  onScan={handleScan}
                  style={{ width: "100%", height: "100%" }}
                  constraints={{
                    audio: false,
                    video: { facingMode: "environment" }
                  }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QrScannerPage;