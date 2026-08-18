import { body } from 'express-validator';

export const createAccountValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('type')
    .isIn(['savings', 'checking', 'cash', 'investment', 'other'])
    .withMessage('Type must be savings, checking, cash, investment, or other'),
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
    .isIn(['savings', 'checking', 'cash', 'investment', 'other'])
    .withMessage('Type must be savings, checking, cash, investment, or other'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];
