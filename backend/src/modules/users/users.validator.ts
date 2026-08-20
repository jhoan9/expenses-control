import { body } from 'express-validator';

const USER_ROLES = ['jh01', 'ji01', 'user', 'admin'];

export const createUserValidator = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage('Role must be jh01, ji01, user, or admin'),
];

export const updateUserValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage('Role must be jh01, ji01, user, or admin'),
];
