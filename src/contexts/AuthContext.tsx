import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'user' | 'student';
  credits_remaining: number;
  plan_id: string | null;
  onboarding_completed: boolean;
  preferences: any;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      
      return data;
    } catch (error: any) {
      console.error('Profile fetch failed:', error);
      return null;
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Initialize auth state
  useEffect(() => {
    console.log('🔍 [AUTH] Initializing auth state');
    
    let mounted = true;
    
    // Set a maximum timeout for the entire auth initialization
    const authTimeout = setTimeout(() => {
      if (mounted) {
        console.log('🔍 [AUTH] Auth initialization timeout, forcing loading to false');
        setLoading(false);
      }
    }, 15000); // 15 seconds max for auth initialization
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;
      
      console.log('🔍 [AUTH] Initial session check:', { 
        hasSession: !!session, 
        userEmail: session?.user?.email,
        error: error?.message 
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('🔍 [AUTH] User found, fetching profile');
        try {
          const profileData = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(profileData);
            console.log('🔍 [AUTH] Profile set:', !!profileData);
          }
        } catch (error) {
          console.error('🔍 [AUTH] Profile fetch failed:', error);
          if (mounted) {
            setProfile(null);
          }
        }
      } else {
        console.log('🔍 [AUTH] No user session found');
      }
      
      if (mounted) {
        clearTimeout(authTimeout);
        setLoading(false);
        console.log('🔍 [AUTH] Initial auth state complete, loading set to false');
      }
    }).catch((error) => {
      console.error('🔍 [AUTH] Error getting initial session:', error);
      if (mounted) {
        clearTimeout(authTimeout);
        setLoading(false);
      }
    });

    // Ensure auth client is properly initialized
    if (!supabase?.auth) {
      console.error('🔍 [AUTH] Supabase auth client not available');
      setLoading(false);
      return () => {
        if (mounted) {
          clearTimeout(authTimeout);
        }
      };
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('🔍 [AUTH] Auth state changed:', { 
          event, 
          userEmail: session?.user?.email,
          hasSession: !!session 
        });
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle profile fetching for authenticated users
        if (session?.user) {
          console.log('🔍 [AUTH] User authenticated, fetching profile');
          
          // Don't block the auth state change on profile fetching
          Promise.all([
            fetchProfile(session.user.id),
            syncProfileIfNeeded(session.user)
          ])
            .then(([profileData]) => {
              if (mounted) {
                setProfile(profileData);
                console.log('🔍 [AUTH] Profile updated:', !!profileData);
              }
            })
            .catch((error) => {
              console.error('🔍 [AUTH] Profile fetch error during auth change:', error);
              if (mounted) {
                setProfile(null);
              }
            });
        } else {
          console.log('🔍 [AUTH] User signed out, clearing profile');
          setProfile(null);
        }
        
        // Always set loading to false after auth state change
        setLoading(false);
        console.log('🔍 [AUTH] Auth state change complete, loading set to false');
      }
    );

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
      console.log('🔍 [AUTH] Auth effect cleanup');
    };
  }, []);

  // Sign up function
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Error",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      if (data.user && !data.session) {
        toast({
          title: "Check Your Email",
          description: "Please check your email for a confirmation link to complete your registration.",
        });
      }

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign Up Error",
        description: authError.message,
        variant: "destructive"
      });
      return { error: authError };
    }
  };

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign In Error",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Welcome Back!",
        description: "You have successfully signed in.",
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign In Error",
        description: authError.message,
        variant: "destructive"
      });
      return { error: authError };
    }
  };

  // Google Sign-In function
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/library`,
        },
      });

      if (error) {
        toast({
          title: "Google Sign-In Error",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Supabase handles the redirection, so no further client-side navigation needed here
      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Google Sign-In Error",
        description: authError.message,
        variant: "destructive"
      });
      return { error: authError };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Sign Out Error",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Sign Out Error",
        description: authError.message,
        variant: "destructive"
      });
      return { error: authError };
    }
  };

  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: "Password Reset Error",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });

      return { error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        title: "Password Reset Error",
        description: authError.message,
        variant: "destructive"
      });
      return { error: authError };
    }
  };

  // Sync profile if needed
  const syncProfileIfNeeded = async (authUser: any) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        await supabase.from('profiles').insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          role: 'user',
          credits_remaining: 100,
          onboarding_completed: false
        });
      } else if (!existingProfile.email || !existingProfile.full_name) {
        // Update missing fields
        await supabase.from('profiles').update({
          email: existingProfile.email || authUser.email,
          full_name: existingProfile.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name
        }).eq('id', authUser.id);
      }
    } catch (error) {
      console.error('Error syncing profile:', error);
    }
  };

  // Update profile function
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      // Allow updating all profile fields except id
      const allowedUpdates = { ...updates };
      delete (allowedUpdates as any).id;

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update(allowedUpdates)
        .eq('id', user.id);

      if (profileError) {
        toast({
          title: "Profile Update Error",
          description: profileError.message,
          variant: "destructive"
        });
        return { error: profileError };
      }

      // Update auth metadata if full_name is being updated
      if (updates.full_name) {
        const { error: authError } = await supabase.auth.updateUser({
          data: { full_name: updates.full_name }
        });
        
        if (authError) {
          console.warn('Could not update auth metadata:', authError);
        }
      }

      // Refresh profile data
      await refreshProfile();

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });

      return { error: null };
    } catch (error) {
      const updateError = error as Error;
      toast({
        title: "Profile Update Error",
        description: updateError.message,
        variant: "destructive"
      });
      return { error: updateError };
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};