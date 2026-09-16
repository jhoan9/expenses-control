import { body } from 'express-validator';

export const createConversationValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('El título debe tener entre 1 y 200 caracteres'),
];

export const sendMessageValidator = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage('El mensaje debe tener entre 1 y 4000 caracteres'),
];