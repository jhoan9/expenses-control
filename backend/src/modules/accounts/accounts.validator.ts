import { body } from 'express-validator';

const ACCOUNT_TYPES = ['savings', 'checking', 'cash', 'investment', 'credit_card', 'other'];

export const createAccountValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('type')
    .isIn(ACCOUNT_TYPES)
    .withMessage('Type must be savings, checking, cash, investment, credit_card, or other'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  body('balance')
    .optional()
    .isNumeric()
    .withMessage('Balance must be a number'),
];

export const updateAccountValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('type')
    .optional()
    .isIn(ACCOUNT_TYPES)
    .withMessage('Type must be savings, checking, cash, investment, credit_card, or other'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

export const transferValidator = [
  body('to_account_id')
    .isInt({ min: 1 })
    .withMessage('to_account_id must be a positive integer'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than zero'),
  body('applies_four_x_thousand')
    .optional()
    .isBoolean()
    .withMessage('applies_four_x_thousand must be a boolean'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Description must be at most 255 characters'),
];

export const creditCardPaymentValidator = [
  body('from_account_id')
    .isInt({ min: 1 })
    .withMessage('from_account_id must be a positive integer'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be greater than zero'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Description must be at most 255 characters'),
];
