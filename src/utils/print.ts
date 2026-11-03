/**
 * Utility for triggering consistent, high-contrast, clean A4 printing without blank pages
 * Ensures correct orientation (portrait/landscape), removes forced gaps, and cleans up after print.
 */
export const triggerPrint = (orientation: 'portrait' | 'landscape' = 'portrait') => {
  let styleEl = document.getElementById('dynamic-print-orientation-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-orientation-style';
    document.head.appendChild(styleEl);
  }

  const margin = orientation === 'landscape' ? '6mm 6mm 7mm 6mm' : '6mm 7mm 7mm 7mm';
  styleEl.innerHTML = `
    @media print {
      @page {
        size: A4 ${orientation} !important;
        margin: ${margin} !important;
      }
      /* Force pure white background for all elements and disable background graphics */
      *, *::before, *::after {
        -webkit-print-color-adjust: economy !important;
        print-color-adjust: economy !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      html, body, #root, .app-container, main, div, section, article, table, thead, tbody, tfoot, tr, th, td, p, span, h1, h2, h3, h4,
      [class*="bg-"], [class*="from-"], [class*="via-"], [class*="to-"] {
        background: #ffffff !important;
        background-color: #ffffff !important;
        background-image: none !important;
        color: #000000 !important;
      }
      table, th, td {
        background: #ffffff !important;
        background-color: #ffffff !important;
        border-color: #94a3b8 !important;
      }
    }
  `;
  document.documentElement.setAttribute('data-print-orientation', orientation);

  // Small delay to allow CSSOM updates to register before print dialog opens
  setTimeout(() => {
    window.print();
  }, 120);

  // Clean up styles after print dialog closes
  const cleanup = () => {
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    document.documentElement.removeAttribute('data-print-orientation');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
};
