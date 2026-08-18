import { body } from 'express-validator';

export const createThirdPartyValidator = [
  body('person_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Person name is required and must be between 1 and 100 characters'),
];

export const updateThirdPartyValidator = [
  body('person_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Person name must be between 1 and 100 characters'),
];

export const createMovementValidator = [
  body('type')
    .isIn(['deposit', 'withdrawal', 'investment_buy', 'investment_sell', 'transfer'])
    .withMessage('Type must be deposit, withdrawal, investment_buy, investment_sell, or transfer'),
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
  body('related_position_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Related position ID must be a positive integer'),
];
