import { useState, useEffect } from 'react';

const REMEMBER_ME_KEY = 'remember_credentials';

interface RememberMeData {
  username: string;
  rememberMe: boolean;
}

export const useRememberMe = () => {
  const [rememberMe, setRememberMe] = useState(false);
  const [savedUsername, setSavedUsername] = useState('');

  useEffect(() => {
    // Load saved credentials on mount
    const savedData = localStorage.getItem(REMEMBER_ME_KEY);
    if (savedData) {
      try {
        const parsed: RememberMeData = JSON.parse(savedData);
        setRememberMe(parsed.rememberMe);
        if (parsed.rememberMe) {
          setSavedUsername(parsed.username);
        }
      } catch (error) {
        console.error('Failed to parse saved credentials:', error);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }, []);

  const saveCredentials = (username: string, remember: boolean) => {
    setRememberMe(remember);
    
    if (remember) {
      const data: RememberMeData = {
        username,
        rememberMe: true,
      };
      localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(data));
      setSavedUsername(username);
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
      setSavedUsername('');
    }
  };

  const clearSavedCredentials = () => {
    localStorage.removeItem(REMEMBER_ME_KEY);
    setRememberMe(false);
    setSavedUsername('');
  };

  return {
    rememberMe,
    savedUsername,
    saveCredentials,
    clearSavedCredentials,
  };
};
