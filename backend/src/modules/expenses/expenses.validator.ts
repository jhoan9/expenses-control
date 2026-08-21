import { body } from 'express-validator';

const baseCreateValidator = [
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

const baseUpdateValidator = [
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

const itemsArrayValidator = [
  body('items')
    .optional()
    .isArray()
    .withMessage('Items must be an array'),
  body('items.*.name')
    .if(body('items').exists())
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ max: 200 })
    .withMessage('Item name must be less than 200 characters'),
  body('items.*.amount')
    .if(body('items').exists())
    .isFloat({ min: 0 })
    .withMessage('Item amount must be a non-negative number'),
];

export const createExpenseValidator = [...baseCreateValidator, ...itemsArrayValidator];

export const updateExpenseValidator = [...baseUpdateValidator, ...itemsArrayValidator];

export const templateValidator = [
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Category ID is required'),
  body('subcategory_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer'),
  body('names')
    .isArray({ min: 1 })
    .withMessage('Names must be a non-empty array'),
  body('names.*')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 200 })
    .withMessage('Template name must be less than 200 characters'),
];
