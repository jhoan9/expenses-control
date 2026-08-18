import { body } from 'express-validator';

export const createBudgetValidator = [
  body('period_type')
    .isIn(['first', 'second'])
    .withMessage('Period type must be first or second'),
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('end_date')
    .isISO8601()
    .withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('total_income')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total income must be a non-negative number'),
];

export const updateBudgetValidator = [
  body('period_type')
    .optional()
    .isIn(['first', 'second'])
    .withMessage('Period type must be first or second'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date (YYYY-MM-DD)'),
  body('total_income')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total income must be a non-negative number'),
];

export const createBudgetItemValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('due_date')
    .isISO8601()
    .withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  body('is_recurrent')
    .optional()
    .isBoolean()
    .withMessage('is_recurrent must be a boolean'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];

export const updateBudgetItemValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date (YYYY-MM-DD)'),
  body('paid_date')
    .optional()
    .isISO8601()
    .withMessage('Paid date must be a valid date (YYYY-MM-DD)'),
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'cancelled'])
    .withMessage('Status must be pending, completed, or cancelled'),
  body('is_recurrent')
    .optional()
    .isBoolean()
    .withMessage('is_recurrent must be a boolean'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
];
