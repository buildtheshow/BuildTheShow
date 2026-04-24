(function () {
  function nanpDigits(value) {
    const digits = String(value || '').replace(/\D+/g, '');
    return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  }

  function formatNanpPhone(value) {
    const digits = nanpDigits(value);
    if (digits.length !== 10) return String(value || '').trim();
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  function formatNanpPhoneInput(value) {
    const digits = nanpDigits(value).slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  function formatPhoneInputElement(input) {
    if (!input) return;
    input.value = formatNanpPhoneInput(input.value);
  }

  window.BTSPhone = {
    digits: nanpDigits,
    format: formatNanpPhone,
    formatInput: formatNanpPhoneInput,
    formatElement: formatPhoneInputElement,
  };

  document.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'tel') return;
    formatPhoneInputElement(input);
  });

  document.addEventListener('focusout', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'tel') return;
    input.value = formatNanpPhone(input.value);
  });
})();
