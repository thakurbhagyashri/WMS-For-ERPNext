export const RegexPatterns = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    name: /^[A-Za-z\s]+$/,
    phone: /^\+?[0-9]{10,15}$/,
    serverUrl: /^https?:\/\//,
    gstNumber: /^[A-Za-z0-9]{5,15}$/,
    cardNumber: /^\d{15,16}$/,
    expiryDate: /^(0[1-9]|1[0-2])\/\d{2}$/,
    cvc: /^\d{3,4}$/,
    password: /^.{6,}$/,
};

export const Validators = {
    isValidEmail: (email: string) => RegexPatterns.email.test(email),
    isValidName: (name: string) => RegexPatterns.name.test(name),
    isValidPhone: (phone: string) => RegexPatterns.phone.test(phone.replace(/[\s-]/g, '')),
    isValidServerUrl: (url: string) => RegexPatterns.serverUrl.test(url),
    isValidGst: (gst: string) => RegexPatterns.gstNumber.test(gst.replace(/[\s-]/g, '')),
    isValidCardNumber: (card: string) => RegexPatterns.cardNumber.test(card.replace(/\s+/g, '')),
    isValidExpiry: (expiry: string) => RegexPatterns.expiryDate.test(expiry),
    isValidCvc: (cvc: string) => RegexPatterns.cvc.test(cvc),
    isStrongPassword: (password: string) => password.length >= 8,
};
