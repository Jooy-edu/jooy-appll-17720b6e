import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Mail, Calendar, Shield, Clock, AlertTriangle, LogOut } from 'lucide-react';
import { getTextDirection } from '@/lib/textDirection';
import { useTranslation } from 'react-i18next';
import { useUserLevelActivations } from '@/hooks/useLevelAccess';
import { ParentalControlsCard } from '@/components/ParentalControlsCard';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, updateProfile, signOut } = useAuth();
  const { data: activationsData, isLoading } = useUserLevelActivations();
  const [activationData, setActivationData] = useState<any>(null);

  // Simulate loading and activation data structure
  useEffect(() => {
    if (activationsData && activationsData.length > 0) {
      // Get the most recent activation
      const recent = activationsData[0];
      const expiresAt = new Date(recent.access_expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      setActivationData({
        isActivated: expiresAt > now,
        activatedAt: recent.activated_at,
        expiresAt: recent.access_expires_at,
        daysRemaining: Math.max(0, daysRemaining)
      });
    } else {
      setActivationData({
        isActivated: false,
        activatedAt: null,
        expiresAt: null,
        daysRemaining: null
      });
    }
  }, [activationsData]);

  const activationLoading = isLoading;
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      return;
    }

    setLoading(true);
    
    // Update both user metadata and profile
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() }
    });

    if (!authError && profile) {
      const { error: profileError } = await updateProfile({
        full_name: fullName.trim()
      });
      
      if (!profileError) {
        setIsEditing(false);
      }
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const isRTL = t('common.language') === 'العربية';

  const getStatusBadge = () => {
    if (!activationData) return null;
    
    if (!activationData.isActivated) {
      return <Badge variant="outline" className="text-muted-foreground">{t('profile.inactive')}</Badge>;
    }
    
    if (activationData.daysRemaining === 0) {
      return <Badge variant="destructive">{t('profile.expired')}</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-500">{t('profile.active')}</Badge>;
  };

  const getDaysRemainingColor = () => {
    if (!activationData?.daysRemaining) return 'text-muted-foreground';
    if (activationData.daysRemaining < 7) return 'text-destructive';
    if (activationData.daysRemaining < 30) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
            {t('profile.title')}
          </h1>
          <p className="text-muted-foreground mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
            {t('profile.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  <User className="h-5 w-5" />
                  {t('profile.personalInfo')}
                </CardTitle>
                <CardDescription dir={isRTL ? 'rtl' : 'ltr'}>
                  {t('profile.personalInfoDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t('profile.emailAddress')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || user.email || ''}
                    disabled
                    className="bg-muted"
                    dir={getTextDirection(profile?.email || user.email || '')}
                  />
                  <p className="text-sm text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                    {t('profile.emailCannotChange')}
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('profile.fullName')}</Label>
                  {isEditing ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-3">
                        <Input
                          id="fullName"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={t('profile.enterFullName')}
                          disabled={loading}
                          dir={getTextDirection(fullName)}
                        />
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={loading || !fullName.trim()}
                          className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              {t('profile.saving')}
                            </>
                          ) : (
                            t('profile.save')
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setFullName(profile?.full_name || user?.user_metadata?.full_name || '');
                          }}
                          disabled={loading}
                        >
                          {t('profile.cancel')}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground" dir={getTextDirection(profile?.full_name || user?.user_metadata?.full_name || '')}>
                        {profile?.full_name || user?.user_metadata?.full_name || t('profile.notSet')}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        {t('profile.edit')}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Account Created */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('profile.memberSince')}
                  </Label>
                  <p className="text-foreground">
                    {new Date(profile?.created_at || user?.created_at || '').toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activation Status & Sign Out */}
          <div className="space-y-6">
            {/* Activation Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  <Shield className="h-5 w-5" />
                  {t('profile.activationStatus')}
                </CardTitle>
                <CardDescription dir={isRTL ? 'rtl' : 'ltr'}>
                  {t('profile.activationStatusDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activationLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t('profile.status')}
                      </Label>
                      {getStatusBadge()}
                    </div>

                    {activationData?.isActivated ? (
                      <>
                        {/* Activated Date */}
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {t('profile.activatedOn')}
                          </Label>
                          <p className="text-foreground">
                            {new Date(activationData.activatedAt!).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        {/* Expiration Date */}
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {t('profile.expiresOn')}
                          </Label>
                          <p className="text-foreground">
                            {new Date(activationData.expiresAt!).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        {/* Days Remaining */}
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {t('profile.daysRemaining')}
                          </Label>
                          <p className={`font-medium ${getDaysRemainingColor()}`}>
                            {activationData.daysRemaining} {activationData.daysRemaining === 1 ? t('profile.day') : t('profile.days')}
                          </p>
                        </div>

                        {/* Warning Messages */}
                        {activationData.daysRemaining === 0 && (
                          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">{t('profile.expiredWarning')}</span>
                          </div>
                        )}
                        
                        {activationData.daysRemaining > 0 && activationData.daysRemaining < 7 && (
                          <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-md">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">{t('profile.expiringWarning')}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-muted text-muted-foreground rounded-md">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">{t('profile.notActivatedWarning')}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Parental Controls Card */}
            <ParentalControlsCard />

            {/* Sign Out Card */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('profile.signOut')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;