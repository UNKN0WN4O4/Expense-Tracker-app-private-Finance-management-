import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Check,
  FileSearch,
  Loader2,
  Upload,
} from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Button from './Button';
import Input from './Input';
import ExpenseNotificationStack from './expense/ExpenseNotificationStack';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';

const ALLOWED_AMOUNT_PATTERN = /^[0-9.,]*$/;
const NOTIFICATION_LIFETIME_MS = 25000;
const OCR_PROGRESS_STATES = new Set([
  'loading tesseract core',
  'initializing tesseract',
  'loading language traineddata',
  'initializing api',
  'recognizing text',
]);
const AMOUNT_HINTS = [
  'grand total',
  'invoice total',
  'receipt total',
  'amount due',
  'amount paid',
  'paid amount',
  'net total',
  'net amount',
  'total',
  'balance due',
  'mrp',
  'price',
  'sale price',
  'selling price',
  'list price',
];
const NOTE_STOP_WORDS = [
  'invoice',
  'receipt',
  'date',
  'total',
  'tax',
  'bill to',
  'ship to',
  'gst',
  'amount',
  'payment',
  'subtotal',
  'discount',
];
const CATEGORY_KEYWORDS = {
  food: ['food', 'restaurant', 'cafe', 'coffee', 'dinner', 'lunch', 'breakfast', 'zomato', 'swiggy'],
  travel: ['travel', 'trip', 'flight', 'airline', 'hotel', 'booking', 'ticket', 'stay'],
  rent: ['rent', 'landlord', 'lease', 'apartment', 'housing'],
  utilities: ['electric', 'electricity', 'water', 'gas', 'internet', 'wifi', 'broadband', 'utility', 'recharge'],
  entertainment: ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'theatre', 'entertainment'],
  shopping: ['shopping', 'store', 'mart', 'mall', 'purchase', 'amazon', 'flipkart'],
  health: ['health', 'hospital', 'clinic', 'pharmacy', 'medicine', 'doctor', 'lab'],
  transport: ['transport', 'uber', 'ola', 'taxi', 'metro', 'fuel', 'petrol', 'diesel', 'parking'],
};
const CURRENCY_PATTERN = /(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)/i;
const DATE_PATTERN = /\b\d{1,4}[\/.-]\d{1,2}(?:[\/.-]\d{1,4})?\b/;
const BUSINESS_NAME_HINTS = /\b(?:inc|llc|ltd|limited|corp|corporation|repair|store|mart|cafe|restaurant|hotel|services|solutions|traders)\b/i;
const OCR_IMAGE_MAX_DIMENSION = 1600;
const OCR_PDF_SCALE = 1.5;
const OCR_PROGRESS_UPDATE_INTERVAL_MS = 150;
const OCR_PROGRESS_MIN_DELTA = 5;

let tesseractModulePromise;
let pdfJsModulePromise;

const loadTesseract = async () => {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import('tesseract.js');
  }

  const module = await tesseractModulePromise;
  return module.default || module;
};

const loadPdfJs = async () => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfJsModule, workerModule]) => {
      const pdfJs = pdfJsModule;
      pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfJs;
    });
  }

  return pdfJsModulePromise;
};

const createInitialExpense = (defaultCurrency, initialExpense = null) => ({
  amount: initialExpense?.amount != null ? String(initialExpense.amount) : '',
  categoryId: initialExpense?.categoryId || initialExpense?.category || '',
  currency: initialExpense?.currency || defaultCurrency,
  date: initialExpense?.date || new Date().toISOString().split('T')[0],
  note: initialExpense?.note || '',
});

const createSuccessNotification = (expense, categories, mode) => {
  const category = categories.find((item) => item.id === (expense.categoryId || expense.category));
  const trimmedNote = expense.note.trim();
  const amountValue = typeof expense.amount === 'string' ? expense.amount.trim() : String(expense.amount ?? '');
  const amountLabel = `${expense.currency}${amountValue}`;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: mode === 'edit' ? 'Expense updated successfully' : 'Expense added successfully',
    message: trimmedNote
      ? `${trimmedNote} - ${amountLabel}`
      : `${category?.name || 'Expense'} - ${amountLabel}`,
    categoryName: category?.name || 'Uncategorized',
    createdAt: Date.now(),
  };
};

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const normalizeReceiptText = (text) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

const normalizeAmountString = (value) => {
  const sanitized = value.replace(/[^\d.,]/g, '');
  if (!sanitized) {
    return '';
  }

  const lastDot = sanitized.lastIndexOf('.');
  const lastComma = sanitized.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);

  if (decimalIndex === -1) {
    return sanitized;
  }

  const integerPart = sanitized.slice(0, decimalIndex).replace(/[.,]/g, '');
  const fractionalPart = sanitized.slice(decimalIndex + 1).replace(/[.,]/g, '');

  if (!fractionalPart) {
    return integerPart;
  }

  if (fractionalPart.length === 3 && integerPart.length > 0) {
    return `${integerPart}${fractionalPart}`;
  }

  return `${integerPart}.${fractionalPart.slice(0, 2)}`;
};

const parseAmountCandidate = (value) => {
  const normalized = normalizeAmountString(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return {
    amount: parsed,
    formatted: parsed.toFixed(2),
  };
};

const extractPreferredAmountFromLine = (line) => {
  const moneyMatches = line.match(/(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d,]*(?:[.]\d{2})|(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d.]*(?:,\d{2})/gi);
  if (!moneyMatches || moneyMatches.length === 0) {
    return '';
  }

  const preferredMatch = moneyMatches[moneyMatches.length - 1];
  return parseAmountCandidate(preferredMatch)?.formatted || '';
};

const extractAmountFromInvoiceTotals = (text) => {
  const lines = normalizeReceiptText(text)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const priorityPatterns = [
    /\bgrand total\b/i,
    /\binvoice total\b/i,
    /\breceipt total\b/i,
    /\btotal\b/i,
    /\bamount due\b/i,
    /\bbalance due\b/i,
    /\bamount paid\b/i,
    /\bpaid amount\b/i,
    /\bnet total\b/i,
    /\bnet amount\b/i,
    /\bmrp\b/i,
    /\b(?:sale price|selling price|list price|price)\b/i,
  ];

  for (const pattern of priorityPatterns) {
    const matchingLine = lines.find((line) => pattern.test(line) && !/\bsubtotal\b/i.test(line));
    if (!matchingLine) {
      continue;
    }

    const amount = extractPreferredAmountFromLine(matchingLine);
    if (amount) {
      return amount;
    }
  }

  return '';
};

const extractAmountFromText = (text) => {
  const lines = normalizeReceiptText(text)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  const candidates = [];

  lines.forEach((line, lineIndex) => {
    const lowerLine = line.toLowerCase();
    const amountMatches = line.match(/(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|€|£|¥)?\s*\d[\d,]*(?:[.]\d{2})?|(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|€|£|¥)?\s*\d[\d.]*(?:,\d{2})?/gi);

    if (!amountMatches) {
      return;
    }

    const hintScore = AMOUNT_HINTS.reduce(
      (score, hint) => score + (lowerLine.includes(hint) ? 100 : 0),
      0,
    );

    amountMatches.forEach((match) => {
      const parsed = parseAmountCandidate(match);
      if (!parsed) {
        return;
      }

      candidates.push({
        ...parsed,
        score: parsed.amount + hintScore - lineIndex,
      });
    });
  });

  if (candidates.length === 0) {
    return '';
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0].formatted;
};

const isDateLikeAmountMatch = (line, matchText, matchIndex) => {
  const previousCharacter = line[matchIndex - 1] || '';
  const nextCharacter = line[matchIndex + matchText.length] || '';
  const contextualSlice = line.slice(
    Math.max(0, matchIndex - 3),
    Math.min(line.length, matchIndex + matchText.length + 3),
  );

  if (/[/-]/.test(previousCharacter) || /[/-]/.test(nextCharacter)) {
    return true;
  }

  if (DATE_PATTERN.test(line) && !CURRENCY_PATTERN.test(matchText)) {
    if ((/[.]\d{2}\b/.test(matchText) || /,\d{2}\b/.test(matchText)) && !/[/-]/.test(contextualSlice)) {
      return false;
    }

    if (/^\d{1,4}[.]\d{1,2}$/.test(matchText) || /^\d{1,2}$/.test(matchText)) {
      return true;
    }
  }

  if (/\d[/-]\d/.test(contextualSlice)) {
    return true;
  }

  return false;
};

const extractAmountFromTextWithGuards = (text) => {
  const directTotalAmount = extractAmountFromInvoiceTotals(text);
  if (directTotalAmount) {
    return directTotalAmount;
  }

  const lines = normalizeReceiptText(text)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  const candidates = [];
  const amountPattern = /(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d,]*(?:[.]\d{2})?|(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d.]*(?:,\d{2})?/gi;

  lines.forEach((line, lineIndex) => {
    const lowerLine = line.toLowerCase();
    const isTotalLine = /\b(?:grand total|invoice total|receipt total|total|amount due|balance due|amount paid|paid amount|net total|net amount)\b/i.test(lowerLine);
    const isSubtotalLine = /\bsubtotal\b/i.test(lowerLine);
    const isTaxLine = /\btax\b/i.test(lowerLine);
    const hintScore = AMOUNT_HINTS.reduce(
      (score, hint) => score + (lowerLine.includes(hint) ? 100 : 0),
      0,
    ) + (isTotalLine ? 300 : 0) - (isSubtotalLine ? 40 : 0) - (isTaxLine ? 25 : 0);

    let match = amountPattern.exec(line);
    while (match) {
      const [matchText] = match;
      if (isDateLikeAmountMatch(line, matchText, match.index)) {
        match = amountPattern.exec(line);
        continue;
      }

      const parsed = parseAmountCandidate(matchText);
      if (!parsed) {
        match = amountPattern.exec(line);
        continue;
      }

      if (!CURRENCY_PATTERN.test(matchText) && !/[.,]\d{2}\b/.test(matchText) && /^\d{8,}$/.test(matchText.replace(/[^\d]/g, ''))) {
        match = amountPattern.exec(line);
        continue;
      }

      const hasCurrencyHint = CURRENCY_PATTERN.test(matchText) || CURRENCY_PATTERN.test(line);
      const hasDecimalPrecision = /[.,]\d{2}\b/.test(matchText);
      const matchPosition = match.index;
      const remainingLine = line.slice(matchPosition + matchText.length);
      const isLastAmountOnLine = !/(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d,]*(?:[.]\d{2})?|(?:rs\.?|inr|\$|eur|usd|gbp|aed|sar|₹|€|£|¥)?\s*\d[\d.]*(?:,\d{2})?/i.test(remainingLine);

      candidates.push({
        ...parsed,
        score: parsed.amount
          + hintScore
          - lineIndex
          + (hasCurrencyHint ? 45 : 0)
          + (hasDecimalPrecision ? 20 : 0)
          + (isLastAmountOnLine ? 25 : 0),
      });
      match = amountPattern.exec(line);
    }

    amountPattern.lastIndex = 0;
  });

  if (candidates.length === 0) {
    return extractAmountFromText(text);
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0].formatted;
};

const toIsoDate = (year, month, day) => {
  const yearNumber = Number.parseInt(year, 10);
  const monthNumber = Number.parseInt(month, 10);
  const dayNumber = Number.parseInt(day, 10);

  if (
    Number.isNaN(yearNumber)
    || Number.isNaN(monthNumber)
    || Number.isNaN(dayNumber)
    || monthNumber < 1
    || monthNumber > 12
    || dayNumber < 1
    || dayNumber > 31
  ) {
    return '';
  }

  const candidate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (
    candidate.getUTCFullYear() !== yearNumber
    || candidate.getUTCMonth() !== monthNumber - 1
    || candidate.getUTCDate() !== dayNumber
  ) {
    return '';
  }

  return `${yearNumber.toString().padStart(4, '0')}-${monthNumber
    .toString()
    .padStart(2, '0')}-${dayNumber.toString().padStart(2, '0')}`;
};

const normalizeYear = (year) => {
  const numericYear = Number.parseInt(year, 10);
  if (Number.isNaN(numericYear)) {
    return '';
  }

  if (year.length === 2) {
    return numericYear >= 70 ? `19${year}` : `20${year}`;
  }

  return year;
};

const extractDateFromText = (text) => {
  const normalizedText = normalizeReceiptText(text);

  const isoMatch = normalizedText.match(/\b(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/);
  if (isoMatch) {
    return toIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const dayFirstMatch = normalizedText.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (dayFirstMatch) {
    const first = Number.parseInt(dayFirstMatch[1], 10);
    const second = Number.parseInt(dayFirstMatch[2], 10);
    const year = normalizeYear(dayFirstMatch[3]);

    if (first > 12) {
      return toIsoDate(year, second, first);
    }

    if (second > 12) {
      return toIsoDate(year, first, second);
    }

    return toIsoDate(year, second, first);
  }

  const monthNames = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    sept: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };

  const longMonthMatch = normalizedText.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s*,?\s*(\d{2,4})\b/i);
  if (longMonthMatch) {
    const month = monthNames[longMonthMatch[2].toLowerCase()];
    const year = normalizeYear(longMonthMatch[3]);
    if (month) {
      return toIsoDate(year, month, longMonthMatch[1]);
    }
  }

  const leadingMonthMatch = normalizedText.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{2,4})\b/i);
  if (leadingMonthMatch) {
    const month = monthNames[leadingMonthMatch[1].toLowerCase()];
    const year = normalizeYear(leadingMonthMatch[3]);
    if (month) {
      return toIsoDate(year, month, leadingMonthMatch[2]);
    }
  }

  return '';
};

const extractNoteFromText = (text) => {
  const lines = normalizeReceiptText(text)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const merchantCandidate = lines.slice(0, 5).find((line) => {
    const lowerLine = line.toLowerCase();
    const hasAnyDigits = /\d/.test(line);

    if (
      line.length < 3
      || line.length > 60
      || hasAnyDigits
      || NOTE_STOP_WORDS.some((word) => lowerLine.includes(word))
    ) {
      return false;
    }

    return BUSINESS_NAME_HINTS.test(lowerLine) || /^[A-Za-z][A-Za-z\s.&'-]{2,}$/.test(line);
  });

  if (merchantCandidate) {
    return merchantCandidate;
  }

  const candidate = lines.find((line) => {
    const lowerLine = line.toLowerCase();

    if (
      line.length < 3
      || line.length > 50
      || !/[a-z]/i.test(line)
      || /\d{3,}/.test(line)
      || NOTE_STOP_WORDS.some((word) => lowerLine.includes(word))
    ) {
      return false;
    }

    return true;
  });

  return candidate || '';
};

const detectCategoryIdFromText = (text, categories) => {
  const lowerText = normalizeReceiptText(text).toLowerCase();
  let bestMatch = { categoryId: '', score: 0 };

  categories.forEach((category) => {
    const categoryTokens = category.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);
    const mappedKeywords = CATEGORY_KEYWORDS[category.id] || [];
    const keywords = new Set([...categoryTokens, ...mappedKeywords]);

    let score = 0;
    keywords.forEach((keyword) => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedKeyword}\\b`, 'i').test(lowerText)) {
        score += keyword === category.name.toLowerCase() ? 4 : 2;
      }
    });

    if (score > bestMatch.score) {
      bestMatch = { categoryId: category.id, score };
    }
  });

  return bestMatch.score >= 4 ? bestMatch.categoryId : '';
};

const getCategoryDisplayName = (category) => `${category.icon ? `${category.icon} ` : ''}${category.name}`;

const getCategorySearchScore = (category, searchValue) => {
  const normalizedSearch = searchValue.trim().toLowerCase();
  if (!normalizedSearch) {
    return 0;
  }

  const normalizedName = category.name.toLowerCase();
  if (normalizedName === normalizedSearch) {
    return 100;
  }

  if (normalizedName.startsWith(normalizedSearch)) {
    return 80;
  }

  if (normalizedName.includes(normalizedSearch)) {
    return 50;
  }

  const keywords = CATEGORY_KEYWORDS[category.id] || [];
  if (keywords.some((keyword) => keyword.includes(normalizedSearch))) {
    return 30;
  }

  return -1;
};

const createAutofillSummary = ({ amount, categoryId, date, note }, categories) => {
  const detected = [];

  if (amount) {
    detected.push(`amount ${amount}`);
  }

  if (categoryId) {
    const category = categories.find((item) => item.id === categoryId);
    if (category) {
      detected.push(`category ${category.name}`);
    }
  }

  if (date) {
    detected.push(`date ${date}`);
  }

  if (note) {
    detected.push(`note "${note}"`);
  }

  return detected.length > 0
    ? `Autofilled ${detected.join(', ')}.`
    : 'OCR finished, but no clear amount, category, or date was detected.';
};

const extractReceiptData = (text, categories) => {
  const amount = extractAmountFromTextWithGuards(text);
  const categoryId = detectCategoryIdFromText(text, categories);
  const date = extractDateFromText(text);
  const note = extractNoteFromText(text);

  return {
    amount,
    categoryId,
    date,
    note,
    text: normalizeReceiptText(text),
  };
};

const downscaleImageFileForOcr = async (file) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to load image for OCR.'));
      nextImage.src = imageUrl;
    });

    const longestSide = Math.max(image.width, image.height);
    if (longestSide <= OCR_IMAGE_MAX_DIMENSION) {
      return file;
    }

    const scale = OCR_IMAGE_MAX_DIMENSION / longestSide;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

const renderPdfFirstPageToCanvas = async (file) => {
  const { getDocument } = await loadPdfJs();
  const fileBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(fileBuffer) });
  const pdfDocument = await loadingTask.promise;

  try {
    const firstPage = await pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: OCR_PDF_SCALE });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await firstPage.render({
      canvasContext: context,
      viewport,
    }).promise;

    return canvas;
  } finally {
    pdfDocument.destroy();
  }
};

const extractTextFromReceiptFile = async (file, onProgress) => {
  const Tesseract = await loadTesseract();
  const source = file.type === 'application/pdf'
    ? await renderPdfFirstPageToCanvas(file)
    : await downscaleImageFileForOcr(file);

  const result = await Tesseract.recognize(source, 'eng', {
    logger: (message) => {
      if (OCR_PROGRESS_STATES.has(message.status)) {
        onProgress(message);
      }
    },
  });

  return result.data.text || '';
};

const validateAmount = (amount) => {
  const trimmedAmount = amount.trim();

  if (!trimmedAmount) {
    return 'Amount is required';
  }

  if (!ALLOWED_AMOUNT_PATTERN.test(trimmedAmount)) {
    return 'Amount can contain only numbers, periods, and commas';
  }

  const normalizedAmount = trimmedAmount.replace(/,/g, '.');
  if ((normalizedAmount.match(/\./g) || []).length > 1) {
    return 'Enter a valid amount';
  }

  const parsedAmount = Number.parseFloat(normalizedAmount);
  if (Number.isNaN(parsedAmount)) {
    return 'Enter a valid amount';
  }

  if (parsedAmount <= 0) {
    return 'Amount must be a positive number';
  }

  return '';
};

const validateExpense = (expense) => {
  const nextErrors = {};

  const amountError = validateAmount(expense.amount);
  if (amountError) {
    nextErrors.amount = amountError;
  }

  if (!expense.categoryId) {
    nextErrors.categoryId = 'Category is required';
  }

  if (!expense.currency) {
    nextErrors.currency = 'Currency is required';
  }

  if (!expense.date) {
    nextErrors.date = 'Date is required';
  }

  return nextErrors;
};

export default function AddExpense({
  categories = [],
  currencies = ['\u20B9', '$', '\u20AC', '\u00A3'],
  defaultCurrency = '\u20B9',
  initialExpense = null,
  expenseId = '',
  onCancel,
  onSaved,
  showSuccessNotifications = true,
}) {
  const { currentUser } = useAuth();
  const mode = expenseId ? 'edit' : 'create';
  const [expense, setExpense] = useState(() => createInitialExpense(defaultCurrency, initialExpense));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationClock, setNotificationClock] = useState(Date.now());
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrSummary, setOcrSummary] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [receiptFileName, setReceiptFileName] = useState(initialExpense?.receiptFileName || '');
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const timeoutRefs = useRef(new Map());
  const fileInputRef = useRef(null);
  const categoryFieldRef = useRef(null);
  const ocrProgressUpdateRef = useRef({ progress: 0, status: '', time: 0 });
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  useEffect(() => {
    const selectedCategory = categories.find((category) => category.id === (initialExpense?.categoryId || initialExpense?.category));
    setExpense(createInitialExpense(defaultCurrency, initialExpense));
    setErrors({});
    setSubmitError('');
    setReceiptFileName(initialExpense?.receiptFileName || '');
    setOcrText(initialExpense?.receiptExtractedText || '');
    setOcrStatus('');
    setOcrProgress(0);
    setOcrSummary('');
    ocrProgressUpdateRef.current = { progress: 0, status: '', time: 0 };
    setCategoryQuery(selectedCategory?.name || '');
    setIsCategoryMenuOpen(false);
  }, [categories, defaultCurrency, initialExpense]);

  useEffect(() => {
    const selectedCategory = categories.find((category) => category.id === expense.categoryId);
    if (selectedCategory && !isCategoryMenuOpen) {
      setCategoryQuery(selectedCategory.name);
    }
  }, [categories, expense.categoryId, isCategoryMenuOpen]);

  useEffect(() => () => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isCategoryMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (categoryFieldRef.current && !categoryFieldRef.current.contains(event.target)) {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCategoryMenuOpen]);

  useEffect(() => {
    if (notifications.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNotificationClock(Date.now());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [notifications.length]);

  const removeNotification = (notificationId) => {
    const timeoutId = timeoutRefs.current.get(notificationId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRefs.current.delete(notificationId);
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
  };

  const showSuccessNotification = (savedExpense) => {
    const notification = createSuccessNotification(savedExpense, categories, mode);

    setNotifications((current) => [notification, ...current]);

    const timeoutId = window.setTimeout(() => {
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
      timeoutRefs.current.delete(notification.id);
    }, NOTIFICATION_LIFETIME_MS);

    timeoutRefs.current.set(notification.id, timeoutId);
  };

  const handleChange = (field, value) => {
    setExpense((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });

    if (submitError) {
      setSubmitError('');
    }
  };

  const handleAmountChange = (value) => {
    handleChange('amount', value);

    if (!value.trim()) {
      setErrors((current) => ({ ...current, amount: 'Amount is required' }));
      return;
    }

    if (!ALLOWED_AMOUNT_PATTERN.test(value)) {
      setErrors((current) => ({
        ...current,
        amount: 'Amount can contain only numbers, periods, and commas',
      }));
      return;
    }

    const amountError = validateAmount(value);
    setErrors((current) => {
      const nextErrors = { ...current };
      if (amountError) {
        nextErrors.amount = amountError;
      } else {
        delete nextErrors.amount;
      }
      return nextErrors;
    });
  };

  const processReceiptFile = async (file, fileName = file?.name || 'Camera capture') => {
    if (!file) {
      return;
    }

    const isSupportedType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isSupportedType) {
      setSubmitError('Please upload a receipt or invoice as an image or PDF.');
      return;
    }

    setSubmitError('');
    setReceiptFileName(fileName);
    setIsProcessingReceipt(true);
    setOcrProgress(0);
    setOcrStatus('Preparing file for OCR...');
    setOcrSummary('');
    setOcrText('');
    ocrProgressUpdateRef.current = { progress: 0, status: 'Preparing file for OCR...', time: Date.now() };

    try {
      const extractedText = await extractTextFromReceiptFile(file, (message) => {
        const nextProgress = Math.round((message.progress || 0) * 100);
        const now = Date.now();
        const shouldUpdate = message.status !== ocrProgressUpdateRef.current.status
          || nextProgress === 100
          || nextProgress - ocrProgressUpdateRef.current.progress >= OCR_PROGRESS_MIN_DELTA
          || now - ocrProgressUpdateRef.current.time >= OCR_PROGRESS_UPDATE_INTERVAL_MS;

        if (!shouldUpdate) {
          return;
        }

        ocrProgressUpdateRef.current = {
          progress: nextProgress,
          status: message.status,
          time: now,
        };
        setOcrStatus(message.status);
        setOcrProgress(nextProgress);
      });

      const autofill = extractReceiptData(extractedText, categories);
      setOcrText(autofill.text);
      setOcrSummary(createAutofillSummary(autofill, categories));
      setOcrStatus('OCR complete');
      setOcrProgress(100);

      setExpense((current) => ({
        ...current,
        amount: autofill.amount || current.amount,
        categoryId: autofill.categoryId || current.categoryId,
        date: autofill.date || current.date,
        note: autofill.note || current.note,
      }));

      setErrors((current) => {
        const nextErrors = { ...current };
        if (autofill.amount) {
          delete nextErrors.amount;
        }
        if (autofill.categoryId) {
          delete nextErrors.categoryId;
        }
        if (autofill.date) {
          delete nextErrors.date;
        }
        return nextErrors;
      });
    } catch (error) {
      setOcrStatus('');
      setOcrProgress(0);
      setOcrSummary('');
      setOcrText('');
      setSubmitError('Unable to scan this receipt right now. Please try a clearer image or PDF.');
    } finally {
      setIsProcessingReceipt(false);
    }
  };

  const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    await processReceiptFile(file, file?.name);
    event.target.value = '';
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraOpen(false);
    setIsStartingCamera(false);
    setCameraError('');
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.');
      setIsCameraOpen(true);
      return;
    }

    setCameraError('');
    setIsCameraOpen(true);
    setIsStartingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('Unable to access the camera. Please allow permission or use upload instead.');
    } finally {
      setIsStartingCamera(false);
    }
  };

  const captureReceiptFromCamera = async () => {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!blob) {
      setSubmitError('Unable to capture a photo from the camera.');
      return;
    }

    const capturedFile = new File([blob], `camera-receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCamera();
    await processReceiptFile(capturedFile, 'Camera receipt');
  };

  const clearReceiptState = () => {
    setReceiptFileName('');
    setOcrStatus('');
    setOcrProgress(0);
    setOcrSummary('');
    setOcrText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validateExpense(expense);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!currentUser) {
      setSubmitError('You must be signed in to save an expense.');
      return;
    }

    try {
      const normalizedAmount = Number.parseFloat(expense.amount.replace(/,/g, '.'));
      const expensePayload = {
        amount: normalizedAmount,
        category: expense.categoryId,
        currency: expense.currency,
        date: expense.date,
        note: expense.note.trim(),
        receiptFileName: receiptFileName || null,
        receiptExtractedText: ocrText || null,
      };

      if (mode === 'edit') {
        await updateDoc(doc(db, 'users', currentUser.uid, 'expenses', expenseId), {
          ...expensePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'users', currentUser.uid, 'expenses'), {
          ...expensePayload,
          createdAt: serverTimestamp(),
        });
      }

      if (mode === 'create' && showSuccessNotifications) {
        showSuccessNotification(expense);
      }

      onSaved?.({
        id: expenseId,
        ...expensePayload,
      });

      if (mode === 'edit') {
        return;
      }

      setExpense(createInitialExpense(defaultCurrency));
      setErrors({});
      setSubmitError('');
      clearReceiptState();
      return;
    } catch (error) {
      setSubmitError(mode === 'edit' ? 'Unable to update expense. Please try again.' : 'Unable to save expense. Please try again.');
    }
  };

  const filteredCategories = [...categories]
    .map((category) => ({
      category,
      score: getCategorySearchScore(category, categoryQuery),
    }))
    .filter(({ score }) => categoryQuery.trim() === '' || score >= 0)
    .sort((left, right) => right.score - left.score || left.category.name.localeCompare(right.category.name))
    .map(({ category }) => category);

  const selectCategory = (category) => {
    handleChange('categoryId', category.id);
    setCategoryQuery(category.name);
    setIsCategoryMenuOpen(false);
  };

  return (
    <>
      <ExpenseNotificationStack
        notifications={notifications.map((notification) => ({
          ...notification,
          type: 'success',
          metaText: notification.categoryName,
        }))}
        notificationClock={notificationClock}
        notificationLifetimeMs={NOTIFICATION_LIFETIME_MS}
        onDismiss={removeNotification}
      />

      <div className="rounded-3xl border border-blue-500/20 bg-slate-900/40 p-6 backdrop-blur-xl">
        <h3 className="mb-5 flex items-center gap-2 text-xl font-semibold text-white">
          <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-blue-600" />
          {mode === 'edit' ? 'Edit Expense' : 'Add New Expense'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Receipt / Invoice Upload</p>
                <p className="mt-1 text-sm text-slate-400">
                  Upload an image or PDF and OCR will try to detect the amount, category,
                  date, and vendor note automatically.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={handleReceiptUpload}
                />

                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingReceipt}
                >
                  {isProcessingReceipt ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {isProcessingReceipt ? 'Scanning...' : 'Upload Receipt'}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={openCamera}
                  disabled={isProcessingReceipt}
                >
                  <Camera size={18} />
                  Open Camera
                </Button>

                {receiptFileName && (
                  <button
                    type="button"
                    onClick={clearReceiptState}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-red-400/30 hover:text-red-300"
                  >
                    Clear Scan
                  </button>
                )}
              </div>
            </div>

            {(receiptFileName || isProcessingReceipt || ocrSummary) && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    {isProcessingReceipt ? <Loader2 size={18} className="animate-spin" /> : <FileSearch size={18} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    {receiptFileName && (
                      <p className="truncate text-sm font-medium text-white">{receiptFileName}</p>
                    )}

                    {ocrStatus && (
                      <p className="mt-1 text-sm text-slate-300">
                        {ocrStatus}
                        {isProcessingReceipt ? ` ${ocrProgress}%` : ''}
                      </p>
                    )}

                    {isProcessingReceipt && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-[width] duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    )}

                    {ocrSummary && (
                      <p className="mt-3 text-sm text-emerald-300">{ocrSummary}</p>
                    )}

                    {ocrText && (
                      <details className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3">
                        <summary className="cursor-pointer text-sm text-slate-300">
                          View extracted text
                        </summary>
                        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
                          {ocrText}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Input
              label="Note"
              type="text"
              value={expense.note}
              onChange={(event) => handleChange('note', event.target.value)}
              placeholder="What did you spend on?"
            />

            <Input
              label="Amount"
              type="text"
              inputMode="decimal"
              value={expense.amount}
              onChange={(event) => handleAmountChange(event.target.value)}
              onBlur={() => {
                const amountError = validateAmount(expense.amount);
                setErrors((current) => {
                  const nextErrors = { ...current };
                  if (amountError) {
                    nextErrors.amount = amountError;
                  } else {
                    delete nextErrors.amount;
                  }
                  return nextErrors;
                });
              }}
              placeholder="0.00"
              error={errors.amount}
            />

            <div className="w-full space-y-2">
              <label className="ml-1 block text-sm font-medium text-slate-400">
                Currency
              </label>
              <select
                value={expense.currency}
                onChange={(event) => handleChange('currency', event.target.value)}
                className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-slate-200 transition-all duration-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-600 ${
                  errors.currency ? 'border-red-500/50' : 'border-slate-700'
                } bg-slate-800/50 backdrop-blur-sm`}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency} className="bg-slate-900">
                    {currency}
                  </option>
                ))}
              </select>
              {errors.currency && (
                <p className="ml-1 text-xs text-red-400 animate-fadeIn">{errors.currency}</p>
              )}
            </div>

            <div ref={categoryFieldRef} className="relative w-full space-y-2">
              <label className="ml-1 block text-sm font-medium text-slate-400">
                Category
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={categoryQuery}
                  onChange={(event) => {
                    setCategoryQuery(event.target.value);
                    setIsCategoryMenuOpen(true);
                    if (expense.categoryId) {
                      handleChange('categoryId', '');
                    }
                  }}
                  onFocus={() => setIsCategoryMenuOpen(true)}
                  placeholder="Search or choose a category"
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-slate-200 transition-all duration-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-600 ${
                    errors.categoryId ? 'border-red-500/50' : 'border-slate-700'
                  } bg-slate-800/50 backdrop-blur-sm`}
                />
                <ChevronDown
                  size={18}
                  className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${
                    isCategoryMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
              {isCategoryMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => selectCategory(category)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 ${
                          expense.categoryId === category.id ? 'bg-white/10 text-white' : 'text-slate-300'
                        }`}
                      >
                        <span className="text-base">{category.icon}</span>
                        <span>{category.name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-slate-400">No matching categories found.</p>
                  )}
                </div>
              )}
              {expense.categoryId ? (
                <p className="ml-1 text-xs text-emerald-300">
                  Selected: {getCategoryDisplayName(categories.find((category) => category.id === expense.categoryId) || { name: categoryQuery, icon: '' })}
                </p>
              ) : null}
              {errors.categoryId && (
                <p className="ml-1 text-xs text-red-400 animate-fadeIn">{errors.categoryId}</p>
              )}
            </div>

            <Input
              label="Date"
              type="date"
              value={expense.date}
              onChange={(event) => handleChange('date', event.target.value)}
              error={errors.date}
            />
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <div className="flex gap-3">
            <Button type="submit" className="gap-2" disabled={isProcessingReceipt}>
              <Check size={18} />
              {mode === 'edit' ? 'Update Expense' : 'Save Expense'}
            </Button>

            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {isCameraOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-white">Capture Receipt</h4>
                <p className="mt-1 text-sm text-slate-400">Take a photo and send it straight into OCR.</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <CameraOff size={18} />
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
              {cameraError ? (
                <div className="flex min-h-[320px] items-center justify-center p-6 text-center text-sm text-red-300">
                  {cameraError}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[65vh] w-full bg-black object-cover"
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                className="gap-2"
                onClick={captureReceiptFromCamera}
                disabled={isStartingCamera || Boolean(cameraError)}
              >
                {isStartingCamera ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                {isStartingCamera ? 'Starting camera...' : 'Capture and Scan'}
              </Button>

              <Button type="button" variant="secondary" onClick={closeCamera}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
