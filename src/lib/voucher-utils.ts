import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

export interface VoucherData {
  voucher_id: string;
  tempo_validade: string;
}

export interface ParsedVoucher {
  voucherId: string;
  tempoValidade: string;
  status?: string;
  dataUso?: string;
}

function convertExcelDate(value: any): string {
  if (!value || value === '') return '';
  // If it's a number, it's an Excel serial date
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!isNaN(num) && num > 10000) {
    // Excel serial date: days since 1899-12-30, with fractional time
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + num * 86400000;
    const date = new Date(ms);
    return date.toISOString();
  }
  // Already a string date, return as-is
  return String(value).trim();
}

export function parseExcelFile(file: File): Promise<ParsedVoucher[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Process ALL sheets
        const allRows: any[] = [];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = XLSX.utils.sheet_to_json(worksheet);
          console.log(`Sheet "${sheetName}":`, sheetData.length, 'rows');
          allRows.push(...sheetData);
        }
        
        console.log('Total rows from all sheets:', allRows.length);
        
        const vouchers: ParsedVoucher[] = allRows.map((row: any) => {
          const keys = Object.keys(row);
          
          // Find voucher_id column
          const voucherIdKey = keys.find(k => 
            k.toLowerCase().replace(/[^a-z]/g, '').includes('voucherid')
          ) || keys.find(k => k.toLowerCase().includes('voucher')) 
            || keys.find(k => k.toLowerCase().includes('id')) || keys[0];
          
          // Find status column
          const statusKey = keys.find(k => {
            const kl = k.toLowerCase();
            return kl === 'status' || kl.includes('status') || kl.includes('estado');
          });

          // Find data_uso column
          const dataUsoKey = keys.find(k => {
            const kl = k.toLowerCase().replace(/[^a-z]/g, '');
            return kl === 'datauso' || kl.includes('datauso') || k.toLowerCase().includes('data_uso');
          });

          // Find tempo_validade column
          const tempoKey = keys.find(k => {
            const kl = k.toLowerCase().replace(/[^a-z]/g, '');
            return kl.includes('tempovalidade') || kl.includes('tempo') || kl.includes('validade');
          }) || keys.find(k => k.toLowerCase().includes('hora'));
          
          const voucherId = voucherIdKey ? String(row[voucherIdKey] || '') : '';
          const status = statusKey ? String(row[statusKey] || '').trim() : '';
          const rawDataUso = dataUsoKey ? row[dataUsoKey] : '';
          const dataUso = convertExcelDate(rawDataUso);
          const tempoValidade = tempoKey ? String(row[tempoKey] || '') : '';
          
          console.log('Parsed row:', { voucherId, status, dataUso, tempoValidade, originalKeys: keys });
          
          return { 
            voucherId, 
            tempoValidade, 
            status: status || undefined, 
            dataUso: dataUso || undefined 
          };
        }).filter(v => v.voucherId && v.tempoValidade);
        
        console.log('Final parsed vouchers:', vouchers);
        resolve(vouchers);
      } catch (error) {
        console.error('Excel parse error:', error);
        reject(new Error('Erro ao processar arquivo Excel'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export function normalizeTempoValidade(tempo: string): string {
  // Normalize different time formats
  const normalized = tempo.toLowerCase().trim();
  
  // Handle "hora" format
  if (normalized.includes('1') && normalized.includes('hora')) return '1 Hora';
  if (normalized.includes('2') && normalized.includes('hora')) return '2 Horas';
  if (normalized.includes('3') && normalized.includes('hora')) return '3 Horas';
  if (normalized.includes('4') && normalized.includes('hora')) return '4 Horas';
  if (normalized.includes('5') && normalized.includes('hora')) return '5 Horas';
  if (normalized.includes('6') && normalized.includes('hora')) return '6 Horas';
  
  // Handle "minuto" format
  if (normalized.includes('minuto') || normalized.includes('min')) {
    const match = normalized.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      return num === 1 ? '1 Minuto' : `${num} Minutos`;
    }
  }

  // Handle pure numbers (assume minutes or hours)
  const pureNum = normalized.match(/^(\d+)$/);
  if (pureNum) {
    return `${pureNum[1]} Horas`;
  }
  
  return tempo.trim();
}

export function getTimeOptions(): string[] {
  return ['1 Hora', '2 Horas', '3 Horas', '4 Horas', '5 Horas', '6 Horas'];
}

import { getNetworkName } from '@/hooks/useNetworkName';
import { getWifiQrString } from '@/hooks/useNetworkName';
import { getPrintLayoutConfig } from '@/hooks/usePrintLayout';

export async function printVoucher(voucherId: string, tempo: string): Promise<void> {
  const networkName = getNetworkName();
  const layout = getPrintLayoutConfig();
  const showQr = layout.qrWidth > 0 && layout.qrHeight > 0;
  
  let qrDataUrl = '';
  if (showQr) {
    const wifiQrString = getWifiQrString();
    qrDataUrl = await QRCode.toDataURL(wifiQrString, { width: 220, margin: 1 });
  }
  const printWindow = window.open('', '_blank', 'width=300,height=200');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o voucher');
    return;
  }
  
  const currentDate = new Date().toLocaleDateString('pt-BR');
  
  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Voucher de Acesso</title>
        <style>
          @page {
            size: ${layout.paperWidth}mm ${layout.paperHeight}mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            width: ${layout.paperWidth}mm;
            height: ${layout.paperHeight}mm;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
          }
          .voucher {
            width: ${layout.paperWidth}mm;
            height: ${layout.paperHeight}mm;
            padding: 2mm;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .title {
            font-size: ${layout.titleFontSize}pt;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .qr-code {
            ${showQr ? `width: ${layout.qrWidth}mm; height: ${layout.qrHeight}mm;` : 'display: none;'}
            margin: 2mm 0;
          }
          .voucher-id {
            font-size: ${layout.voucherIdFontSize}pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
            margin: 1mm 0;
          }
          .tempo {
            font-size: ${layout.tempoFontSize}pt;
            margin: 1mm 0;
          }
          .message {
            font-size: ${layout.messageFontSize}pt;
            line-height: 1.3;
            margin: 1mm 0;
            max-width: ${layout.paperWidth - 4}mm;
          }
          .network {
            font-weight: bold;
          }
          .date {
            font-size: ${layout.dateFontSize}pt;
            margin-top: 1mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="voucher">
          <div class="title">VOUCHER DE ACESSO</div>
          <div class="message">Coloque no modo avião antes de acessar a rede <span class="network">"${networkName}"</span></div>
          ${showQr ? `<img src="${qrDataUrl}" class="qr-code" alt="QR Code da Rede" />` : ''}
          <div class="voucher-id">${voucherId}</div>
          <div class="tempo">Tempo de conexão: ${tempo}</div>
          <div class="date">Data: ${currentDate}</div>
        </div>
        <script>
          window.onload = async function() {
            const imgs = Array.from(document.images || []);
            await Promise.all(imgs.map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              });
            }));
            setTimeout(function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            }, 120);
          }
        </script>
      </body>
    </html>
  `;
  
  printWindow.document.write(printContent);
  printWindow.document.close();
}

// Map font size config to ESC/POS size command
function escposSizeCmd(size: number): string {
  if (size >= 15) return '\x1D\x21\x11'; // Double width + height
  if (size >= 11) return '\x1D\x21\x01'; // Double height only
  return '\x1D\x21\x00';                 // Normal
}

// ESC/POS commands for ficha printing
export function generateFichaEscPos(title: string, subtitle: string, sequence: number, valor?: number): Uint8Array {
  const layout = getPrintLayoutConfig();
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR');
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const seqStr = String(sequence).padStart(3, '0');

  const normalize = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const valorLine = valor && valor > 0
    ? `Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n`
    : '';

  const titleCmd = escposSizeCmd(layout.fichaTitleFontSize ?? 10);
  const subtitleCmd = escposSizeCmd(layout.fichaSubtitleFontSize ?? 8);
  const numberCmd = escposSizeCmd(layout.fichaNumberFontSize ?? 12);
  const infoCmd = escposSizeCmd(layout.fichaInfoFontSize ?? 8);

  const lines = [
    '\x1B\x40',           // Init
    '\x1B\x61\x01',       // Center align
    titleCmd,
    normalize(title),
    '\n',
    subtitleCmd,
    normalize(subtitle),
    '\n\n',
    numberCmd,
    `No ${seqStr}`,
    '\n',
    infoCmd,
    '\n',
    valorLine,
    `Data: ${date}`,
    '\n',
    `Hora: ${time}`,
    '\n\n',
    '\x1D\x21\x00',       // Reset to normal
    '--------------------------------',
    '\n\n\n',
    '\x1D\x56\x00',       // Full cut
  ];

  const text = lines.join('');
  const encoder = new TextEncoder();
  return encoder.encode(text);
}
