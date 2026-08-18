import { body } from 'express-validator';

export const createExpenseValidator = [
  body('account_id')
    .isInt({ min: 1 })
    .withMessage('Account ID is required'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  body('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer'),
  body('payment_method_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer'),
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
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'cancelled'])
    .withMessage('Status must be pending, completed, or cancelled'),
];

export const updateExpenseValidator = [
  body('account_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Account ID must be a positive integer'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  body('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer'),
  body('payment_method_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer'),
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
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'cancelled'])
    .withMessage('Status must be pending, completed, or cancelled'),
];
