import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

const STORAGE_KEY = 'voucher-network-name';
const PASSWORD_STORAGE_KEY = 'voucher-network-password';
const ENCRYPTION_STORAGE_KEY = 'voucher-network-encryption';
const DEFAULT_NETWORK_NAME = 'ILHA DO SOL';
const QR_BUCKET = 'network-assets';
const QR_FILE_PATH = 'network-qr-code.png';

export function useNetworkName() {
  const [networkName, setNetworkName] = useState<string>(DEFAULT_NETWORK_NAME);
  const [networkPassword, setNetworkPassword] = useState<string>('');
  const [encryption, setEncryption] = useState<string>('WPA');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setNetworkName(stored);
    const storedPass = localStorage.getItem(PASSWORD_STORAGE_KEY);
    if (storedPass) setNetworkPassword(storedPass);
    const storedEnc = localStorage.getItem(ENCRYPTION_STORAGE_KEY);
    if (storedEnc) setEncryption(storedEnc);
  }, []);

  const saveNetworkName = (name: string) => {
    const trimmedName = name.trim() || DEFAULT_NETWORK_NAME;
    localStorage.setItem(STORAGE_KEY, trimmedName);
    setNetworkName(trimmedName);
  };

  const saveNetworkPassword = (password: string) => {
    localStorage.setItem(PASSWORD_STORAGE_KEY, password);
    setNetworkPassword(password);
  };

  const saveEncryption = (enc: string) => {
    localStorage.setItem(ENCRYPTION_STORAGE_KEY, enc);
    setEncryption(enc);
  };

  return {
    networkName,
    networkPassword,
    encryption,
    saveNetworkName,
    saveNetworkPassword,
    saveEncryption,
  };
}

export function getNetworkName(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_NETWORK_NAME;
}

/**
 * Generate a WiFi QR code string in the standard format
 * WIFI:T:<encryption>;S:<ssid>;P:<password>;;
 */
export function getWifiQrString(): string {
  const ssid = localStorage.getItem(STORAGE_KEY) || DEFAULT_NETWORK_NAME;
  const password = localStorage.getItem(PASSWORD_STORAGE_KEY) || '';
  const encryption = localStorage.getItem(ENCRYPTION_STORAGE_KEY) || 'WPA';

  if (!password) {
    return `WIFI:T:nopass;S:${ssid};;`;
  }
  return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
}

/**
 * Generate WiFi QR code as a data URL and upload to Supabase storage
 */
export async function generateAndUploadWifiQr(): Promise<string> {
  const wifiString = getWifiQrString();
  const dataUrl = await QRCode.toDataURL(wifiString, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Convert data URL to blob for upload
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'network-qr-code.png', { type: 'image/png' });

  const { error } = await supabase.storage
    .from(QR_BUCKET)
    .upload(QR_FILE_PATH, file, { upsert: true, cacheControl: '0' });
  if (error) throw error;

  const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(QR_FILE_PATH);
  return data.publicUrl + '?t=' + Date.now();
}

export async function getNetworkQrImageUrl(): Promise<string | null> {
  const { data } = await supabase.storage.from(QR_BUCKET).list('', { search: 'network-qr-code' });
  if (!data || data.length === 0) return null;
  const { data: urlData } = supabase.storage.from(QR_BUCKET).getPublicUrl(QR_FILE_PATH);
  return urlData.publicUrl + '?t=' + Date.now();
}

export async function removeNetworkQrImage(): Promise<void> {
  await supabase.storage.from(QR_BUCKET).remove([QR_FILE_PATH]);
}

// Keep legacy upload for manual image override
export async function uploadNetworkQrImage(file: File): Promise<string> {
  const { error } = await supabase.storage
    .from(QR_BUCKET)
    .upload(QR_FILE_PATH, file, { upsert: true, cacheControl: '0' });
  if (error) throw error;
  const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(QR_FILE_PATH);
  return data.publicUrl + '?t=' + Date.now();
}
