import { Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class AiController {
  async listConversations(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversations = await aiService.listConversations(req.userId!);
      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  }

  async createConversation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const conversation = await aiService.createConversation(
        req.userId!,
        req.body.title
      );
      res.status(201).json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await aiService.deleteConversation(req.userId!, id);
      res.json({ success: true, message: 'Conversación eliminada' });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const messages = await aiService.getMessages(req.userId!, id);
      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const result = await aiService.sendMessage(
        req.userId!,
        id,
        req.body.content
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AiController();