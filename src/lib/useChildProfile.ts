import { useState, useEffect, useCallback } from 'react';
import { getSettings } from '@/lib/db';

export function useChildProfile() {
  const [profileUrls, setProfileUrls] = useState<string[]>([]);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.profileImages && s.profileImages.length > 0) {
        setProfileUrls(s.profileImages.map((b) => URL.createObjectURL(b)));
      }
    });
  }, []);

  // Returns a random photo URL, or null if none uploaded
  const getRandomPhoto = useCallback(() => {
    if (profileUrls.length === 0) return null;
    return profileUrls[Math.floor(Math.random() * profileUrls.length)];
  }, [profileUrls]);

  // For backward compat — first photo or null
  const profileUrl = profileUrls.length > 0 ? profileUrls[0] : null;

  return { profileUrl, profileUrls, getRandomPhoto };
}
