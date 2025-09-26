import { useState, useEffect } from 'react';

const REMEMBER_ME_KEY = 'remember_credentials';
const USERNAME_KEY = 'saved_username';

interface RememberMeData {
  username: string;
  password: string;
  rememberMe: boolean;
}

// Simple Base64 encryption functions
const encryptPassword = (password: string): string => {
  return btoa(password);
};

const decryptPassword = (encryptedPassword: string): string => {
  try {
    return atob(encryptedPassword);
  } catch {
    return '';
  }
};

export const useRememberMe = () => {
  const [rememberMe, setRememberMe] = useState(false);
  const [savedUsername, setSavedUsername] = useState('');
  const [savedPassword, setSavedPassword] = useState('');

  useEffect(() => {
    // Load saved credentials on mount
    const savedData = localStorage.getItem(REMEMBER_ME_KEY);
    if (savedData) {
      try {
        const parsed: RememberMeData = JSON.parse(savedData);
        setRememberMe(parsed.rememberMe);
        if (parsed.rememberMe) {
          setSavedUsername(parsed.username);
          setSavedPassword(parsed.password ? decryptPassword(parsed.password) : '');
        }
      } catch (error) {
        console.error('Failed to parse saved credentials:', error);
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }, []);

  const saveCredentials = (username: string, password: string, remember: boolean) => {
    setRememberMe(remember);
    
    if (remember) {
      const data: RememberMeData = {
        username,
        password: encryptPassword(password),
        rememberMe: true,
      };
      localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(data));
      setSavedUsername(username);
      setSavedPassword(password);
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
      setSavedUsername('');
      setSavedPassword('');
    }
  };

  const clearSavedCredentials = () => {
    localStorage.removeItem(REMEMBER_ME_KEY);
    setRememberMe(false);
    setSavedUsername('');
    setSavedPassword('');
  };

  return {
    rememberMe,
    savedUsername,
    savedPassword,
    saveCredentials,
    clearSavedCredentials,
  };
};