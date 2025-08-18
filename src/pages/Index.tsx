import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, BookOpen } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Welcome to Jooy</h1>
            <p className="text-xl text-muted-foreground">Choose how to access your worksheets</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <QrCode className="h-6 w-6 text-primary" />
                  QR Code Scanner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Scan a QR code to instantly access a specific worksheet page
                </p>
                <Button 
                  onClick={() => navigate('/qr-scanner')}
                  className="w-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
                >
                  Open Scanner
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-card-foreground">
                  <BookOpen className="h-6 w-6 text-primary" />
                  Library Browser
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Browse your document library by level and select specific pages
                </p>
                <Button 
                  onClick={() => navigate('/library')}
                  className="w-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
                >
                  Browse Library
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
