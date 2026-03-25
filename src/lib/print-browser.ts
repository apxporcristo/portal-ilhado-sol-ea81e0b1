import { getNetworkName } from '@/hooks/useNetworkName';
import { getWifiQrString } from '@/hooks/useNetworkName';
import { getPrintLayoutConfig } from '@/hooks/usePrintLayout';
import QRCode from 'qrcode';

interface VoucherPrintItem {
  voucher_id: string;
  tempo_validade: string;
}

/**
 * Print multiple vouchers in a single browser window.
 * Each voucher gets its own page (CSS page-break) sized for 58mm x 60mm thermal paper.
 */
export async function printVouchersBatch(vouchers: VoucherPrintItem[]): Promise<void> {
  if (vouchers.length === 0) return;

  const networkName = getNetworkName();
  const layout = getPrintLayoutConfig();
  
  const showQr = layout.qrWidth > 0 && layout.qrHeight > 0;
  
  let qrDataUrl = '';
  if (showQr) {
    const wifiQrString = getWifiQrString();
    qrDataUrl = await QRCode.toDataURL(wifiQrString, { width: 220, margin: 1 });
  }
  const now = new Date();
  const currentDate = now.toLocaleDateString('pt-BR');
  const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const voucherPages = vouchers.map((v) => {
    const qrHtml = showQr
      ? `<img src="${qrDataUrl}" class="qr-code" alt="QR Code WiFi" />`
      : '';
    return `
      <div class="voucher">
        <div class="title">VOUCHER DE ACESSO</div>
        <div class="message">Coloque no modo avião antes de acessar a rede<br/><span class="network">"${networkName}"</span></div>
        ${qrHtml}
        <div class="voucher-id">${v.voucher_id}</div>
        <div class="tempo">Tempo de conexão: ${v.tempo_validade}</div>
        <div class="date">Data: ${currentDate} ${currentTime}</div>
      </div>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir os vouchers');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Vouchers de Acesso</title>
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
      page-break-after: always;
    }
    .voucher:last-child {
      page-break-after: auto;
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
  ${voucherPages}
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
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
