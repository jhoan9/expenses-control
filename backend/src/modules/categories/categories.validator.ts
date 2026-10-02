import { body } from 'express-validator';

const debtKindCheck = () =>
  body('is_debt')
    .custom((value, { req }) => {
      if (req.body.is_debt && req.body.is_receivable) {
        throw new Error('A category cannot be a debt and a receivable at the same time');
      }
      return true;
    })
    .withMessage('A category cannot be a debt and a receivable at the same time');

export const createCategoryValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
  body('type')
    .optional()
    .isIn(['expense', 'income', 'both'])
    .withMessage('Type must be expense, income, or both'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon must be less than 50 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color'),
  body('is_debt')
    .optional()
    .isBoolean()
    .withMessage('is_debt must be a boolean'),
  body('is_receivable')
    .optional()
    .isBoolean()
    .withMessage('is_receivable must be a boolean'),
  debtKindCheck(),
];

export const updateCategoryValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('type')
    .optional()
    .isIn(['expense', 'income', 'both'])
    .withMessage('Type must be expense, income, or both'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon must be less than 50 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('is_debt')
    .optional()
    .isBoolean()
    .withMessage('is_debt must be a boolean'),
  body('is_receivable')
    .optional()
    .isBoolean()
    .withMessage('is_receivable must be a boolean'),
  debtKindCheck(),
];

export const createSubcategoryValidator = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1 and 100 characters'),
];

export const updateSubcategoryValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  body('debt_completed')
    .optional()
    .isBoolean()
    .withMessage('debt_completed must be a boolean'),
];
