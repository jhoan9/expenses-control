import { body } from 'express-validator';

export const createLoanValidator = [
  body('borrower_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Borrower name is required and must be between 1 and 100 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),
];

export const updateLoanValidator = [
  body('borrower_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Borrower name must be between 1 and 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),
];

export const createPaymentValidator = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),
];
