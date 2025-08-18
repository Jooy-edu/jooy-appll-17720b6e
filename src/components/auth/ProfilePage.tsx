import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Mail, Calendar, CreditCard, Settings, LogOut } from 'lucide-react';
import { getTextDirection } from '@/lib/textDirection';
import { useTranslation } from 'react-i18next';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, updateProfile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      return;
    }

    setLoading(true);
    
    const { error } = await updateProfile({
      full_name: fullName.trim()
    });

    if (!error) {
      setIsEditing(false);
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const isRTL = t('common.language') === 'العربية';

  if (!user || !profile) {
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
          <h1 className="text-3xl font-bold text-gray-900" dir={isRTL ? 'rtl' : 'ltr'}>
            Profile Settings
          </h1>
          <p className="text-gray-600 mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
            Manage your account information and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription dir={isRTL ? 'rtl' : 'ltr'}>
                  Update your personal details here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="bg-gray-50"
                    dir={getTextDirection(user.email || '')}
                  />
                  <p className="text-sm text-gray-500" dir={isRTL ? 'rtl' : 'ltr'}>
                    Email cannot be changed. Contact support if you need to update your email.
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  {isEditing ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-3">
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
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
                              Saving...
                            </>
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setFullName(profile.full_name || '');
                          }}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900" dir={getTextDirection(profile.full_name || '')}>
                        {profile.full_name || 'Not set'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Account Created */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Member Since
                  </Label>
                  <p className="text-gray-900">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  <Settings className="h-5 w-5" />
                  Account Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Role */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600" dir={isRTL ? 'rtl' : 'ltr'}>Role:</span>
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role === 'admin' ? 'Administrator' : 'User'}
                  </Badge>
                </div>

                {/* Credits */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-1" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CreditCard className="h-4 w-4" />
                    Credits:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {profile.credits_remaining}
                  </span>
                </div>

                {/* Onboarding Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600" dir={isRTL ? 'rtl' : 'ltr'}>Onboarding:</span>
                  <Badge variant={profile.onboarding_completed ? 'default' : 'secondary'}>
                    {profile.onboarding_completed ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
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