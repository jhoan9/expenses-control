import { body } from 'express-validator';

export const createInvestmentValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('ticker')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Ticker must be less than 20 characters'),
  body('exchange')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Exchange must be less than 50 characters'),
  body('type')
    .isIn(['stock', 'bond', 'etf', 'crypto', 'other'])
    .withMessage('Type must be stock, bond, etf, crypto, or other'),
];

export const updateInvestmentValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('ticker')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Ticker must be less than 20 characters'),
  body('exchange')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Exchange must be less than 50 characters'),
  body('type')
    .optional()
    .isIn(['stock', 'bond', 'etf', 'crypto', 'other'])
    .withMessage('Type must be stock, bond, etf, crypto, or other'),
];

export const createPositionValidator = [
  body('account_id')
    .isInt({ min: 1 })
    .withMessage('Account ID is required'),
  body('quantity')
    .isFloat({ min: 0.000001 })
    .withMessage('Quantity must be a positive number'),
  body('unit_price')
    .isFloat({ min: 0.01 })
    .withMessage('Unit price must be a positive number'),
  body('commission')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Commission must be a non-negative number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  body('position_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Position ID must be a positive integer'),
];
