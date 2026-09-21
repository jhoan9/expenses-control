import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Category {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_debt: boolean;
  user_id: number | null;
  created_at: Date;
}

interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  is_active: boolean;
  debt_completed: boolean;
  created_at: Date;
  debt_stats?: {
    borrowed: number;
    repaid: number;
    pending: number;
  };
}

interface CategoryWithSubcategories extends Category {
  subcategories?: Subcategory[];
}

interface CreateCategoryDTO {
  name: string;
  type?: 'expense' | 'income' | 'both';
  icon?: string;
  color?: string;
  is_debt?: boolean;
  user_id?: number | null;
}

interface UpdateCategoryDTO {
  name?: string;
  type?: 'expense' | 'income' | 'both';
  icon?: string;
  color?: string;
  is_debt?: boolean;
  is_active?: boolean;
}

interface CreateSubcategoryDTO {
  name: string;
}

interface UpdateSubcategoryDTO {
  name?: string;
  is_active?: boolean;
  debt_completed?: boolean;
}

interface DebtTotals {
  borrowed: Map<number, number>;
  repaid: Map<number, number>;
}

export class CategoriesService {
  async findAll(type?: string, userId?: number): Promise<CategoryWithSubcategories[]> {
    let sql = 'SELECT * FROM categories WHERE deleted_at IS NULL';
    const params: any[] = [];

    // Filter by user: show global (user_id IS NULL) + user's personal categories
    if (userId) {
      sql += ' AND (user_id IS NULL OR user_id = $' + (params.length + 1) + ')';
      params.push(userId);
    }

    if (type) {
      sql += ' AND (type = $' + (params.length + 1) + ' OR type = \'both\')';
      params.push(type);
    }

    sql += ' ORDER BY name';

    const categories = await query<CategoryWithSubcategories>(sql, params);

    const debtCategoryIds = categories.filter(c => c.is_debt).map(c => c.id);
    const categoryIds = categories.map(c => c.id);
    const subcategories = await query<Subcategory>(
      `SELECT * FROM subcategories WHERE deleted_at IS NULL AND category_id = ANY($1::int[]) ORDER BY category_id, name`,
      [categoryIds]
    );

    const byCategory = new Map<number, Subcategory[]>();
    for (const cat of categories) {
      byCategory.set(cat.id, subcategories.filter(s => s.category_id === cat.id));
    }

    let debtTotals: DebtTotals | null = null;
    if (userId && debtCategoryIds.length > 0) {
      debtTotals = await this.computeDebtTotals(userId, subcategories.map(s => s.id));
    }

    for (const category of categories) {
      const subs = byCategory.get(category.id) || [];
      if (debtTotals && category.is_debt) {
        for (const sub of subs) {
          const borrowed = debtTotals.borrowed.get(sub.id) || 0;
          const repaid = debtTotals.repaid.get(sub.id) || 0;
          sub.debt_stats = {
            borrowed,
            repaid,
            pending: Math.round((borrowed - repaid) * 100000000) / 100000000,
          };
        }
      }
      category.subcategories = subs;
    }

    return categories;
  }

  async findById(id: number): Promise<CategoryWithSubcategories> {
    const category = await queryOne<Category>(
      'SELECT * FROM categories WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!category) {
      throw AppError.notFound('Category not found');
    }

    const subcategories = await query<Subcategory>(
      'SELECT * FROM subcategories WHERE category_id = $1 AND deleted_at IS NULL ORDER BY name',
      [id]
    );

    return { ...category, subcategories };
  }

  async create(data: CreateCategoryDTO): Promise<Category> {
    const result = await execute(
      'INSERT INTO categories (name, type, icon, color, user_id, is_debt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [data.name, data.type || 'both', data.icon || null, data.color || null, data.user_id || null, data.is_debt || false]
    );

    return queryOne<Category>(
      'SELECT * FROM categories WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<Category>;
  }

  async update(id: number, data: UpdateCategoryDTO, userId?: number): Promise<Category> {
    const category = await this.findById(id);

    // Only allow editing global categories or user's own categories
    if (userId && category.user_id !== null && category.user_id !== userId) {
      throw AppError.forbidden('Cannot edit categories created by other users');
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = $1');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${fields.length + 1}`);
      values.push(data.type);
    }
    if (data.icon !== undefined) {
      fields.push(`icon = $${fields.length + 1}`);
      values.push(data.icon);
    }
    if (data.color !== undefined) {
      fields.push(`color = $${fields.length + 1}`);
      values.push(data.color);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${fields.length + 1}`);
      values.push(data.is_active);
    }
    if (data.is_debt !== undefined) {
      fields.push(`is_debt = $${fields.length + 1}`);
      values.push(data.is_debt);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await execute(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND deleted_at IS NULL`,
      values
    );

    return this.findById(id);
  }

  async delete(id: number, userId?: number): Promise<void> {
    const category = await this.findById(id);

    // Only allow deleting global categories or user's own categories
    if (userId && category.user_id !== null && category.user_id !== userId) {
      throw AppError.forbidden('Cannot delete categories created by other users');
    }

    await execute('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async addSubcategory(categoryId: number, data: CreateSubcategoryDTO): Promise<Subcategory> {
    await this.findById(categoryId);

    const result = await execute(
      'INSERT INTO subcategories (category_id, name) VALUES ($1, $2) RETURNING id',
      [categoryId, data.name]
    );

    const subcategory = await queryOne<Subcategory>(
      'SELECT * FROM subcategories WHERE id = $1',
      [result.rows[0].id]
    );

    return subcategory as Subcategory;
  }

  async updateSubcategory(id: number, data: UpdateSubcategoryDTO): Promise<Subcategory> {
    const subcategory = await queryOne<Subcategory>(
      'SELECT * FROM subcategories WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!subcategory) {
      throw AppError.notFound('Subcategory not found');
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push(`name = $${fields.length + 1}`);
      values.push(data.name);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${fields.length + 1}`);
      values.push(data.is_active);
    }
    if (data.debt_completed !== undefined) {
      fields.push(`debt_completed = $${fields.length + 1}`);
      values.push(data.debt_completed);
    }

    if (fields.length > 0) {
      values.push(id);
      await execute(
        `UPDATE subcategories SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND deleted_at IS NULL`,
        values
      );
    }

    return queryOne<Subcategory>(
      'SELECT * FROM subcategories WHERE id = $1',
      [id]
    ) as Promise<Subcategory>;
  }

  async deleteSubcategory(id: number): Promise<void> {
    const subcategory = await queryOne<Subcategory>(
      'SELECT * FROM subcategories WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!subcategory) {
      throw AppError.notFound('Subcategory not found');
    }

    await execute('UPDATE subcategories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  private async computeDebtTotals(userId: number, subcategoryIds: number[]): Promise<DebtTotals> {
    const borrowed = new Map<number, number>();
    const repaid = new Map<number, number>();

    if (subcategoryIds.length === 0) {
      return { borrowed, repaid };
    }

    const incomeRows = await query<{ subcategory_id: number; total: string }>(
      `SELECT subcategory_id, SUM(amount) as total FROM income
       WHERE user_id = $1 AND deleted_at IS NULL AND subcategory_id = ANY($2::int[])
       GROUP BY subcategory_id`,
      [userId, subcategoryIds]
    );
    for (const row of incomeRows) {
      borrowed.set(row.subcategory_id, Number(row.total) || 0);
    }

    const expenseRows = await query<{ subcategory_id: number; total: string }>(
      `SELECT subcategory_id, SUM(amount) as total FROM expenses
       WHERE user_id = $1 AND deleted_at IS NULL AND status = 'completed' AND subcategory_id = ANY($2::int[])
       GROUP BY subcategory_id`,
      [userId, subcategoryIds]
    );
    for (const row of expenseRows) {
      repaid.set(row.subcategory_id, Number(row.total) || 0);
    }

    return { borrowed, repaid };
  }
}

export const categoriesService = new CategoriesService();