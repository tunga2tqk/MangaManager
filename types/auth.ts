export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  idToken?: string | null;
  lastLogin?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  loading: boolean;
  webClientId: string;
  androidClientId: string;
  syncStatus: string | null;
  signInWithGoogle: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  updateClientIds: (webId: string, androidId: string) => Promise<void>;
  syncUserToGoogleSheets: (userToSync: UserProfile, customEndpoint?: string) => Promise<boolean>;
}
