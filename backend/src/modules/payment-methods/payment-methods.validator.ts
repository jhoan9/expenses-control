import { body } from 'express-validator';

export const createPaymentMethodValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name is required and must be between 1 and 50 characters'),
  body('type')
    .isIn(['cash', 'debit', 'credit', 'transfer', 'pse', 'other'])
    .withMessage('Type must be cash, debit, credit, transfer, pse, or other'),
];

export const updatePaymentMethodValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters'),
  body('type')
    .optional()
    .isIn(['cash', 'debit', 'credit', 'transfer', 'pse', 'other'])
    .withMessage('Type must be cash, debit, credit, transfer, pse, or other'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];
