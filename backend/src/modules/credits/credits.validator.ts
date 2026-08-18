import { body } from 'express-validator';

export const createCreditValidator = [
  body('institution')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Institution is required and must be between 1 and 100 characters'),
  body('credit_limit')
    .isFloat({ min: 0.01 })
    .withMessage('Credit limit must be a positive number'),
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a non-negative number'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date (YYYY-MM-DD)'),
];

export const updateCreditValidator = [
  body('institution')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Institution must be between 1 and 100 characters'),
  body('credit_limit')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Credit limit must be a positive number'),
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a non-negative number'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date (YYYY-MM-DD)'),
];

export const createPaymentValidator = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('minimum_payment')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum payment must be a non-negative number'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid date (YYYY-MM-DD)'),
];
