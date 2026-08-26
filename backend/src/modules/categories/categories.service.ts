import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Category {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string | null;
  color: string | null;
  is_active: boolean;
  user_id: number | null;
  created_at: Date;
}

interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  is_active: boolean;
  created_at: Date;
}

interface CategoryWithSubcategories extends Category {
  subcategories?: Subcategory[];
}

interface CreateCategoryDTO {
  name: string;
  type?: 'expense' | 'income' | 'both';
  icon?: string;
  color?: string;
  user_id?: number | null;
}

interface UpdateCategoryDTO {
  name?: string;
  type?: 'expense' | 'income' | 'both';
  icon?: string;
  color?: string;
  is_active?: boolean;
}

interface CreateSubcategoryDTO {
  name: string;
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

    for (const category of categories) {
      category.subcategories = await query<Subcategory>(
        'SELECT * FROM subcategories WHERE category_id = $1 AND deleted_at IS NULL ORDER BY name',
        [category.id]
      );
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
      'INSERT INTO categories (name, type, icon, color, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [data.name, data.type || 'both', data.icon || null, data.color || null, data.user_id || null]
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

  async updateSubcategory(id: number, data: Partial<CreateSubcategoryDTO>): Promise<Subcategory> {
    const subcategory = await queryOne<Subcategory>(
      'SELECT * FROM subcategories WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!subcategory) {
      throw AppError.notFound('Subcategory not found');
    }

    if (data.name !== undefined) {
      await execute(
        'UPDATE subcategories SET name = $1 WHERE id = $2',
        [data.name, id]
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
}

export const categoriesService = new CategoriesService();
