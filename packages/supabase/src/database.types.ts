/**
 * Mirrors supabase/migrations/. Written by hand so the build is not blocked on
 * a live project; regenerate with `pnpm db:types` once the project exists and
 * after every schema change. Both apps import from here, which is what stops
 * admin and mobile from drifting apart.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string;
          auth_user_id: string | null;
          pin_hash: string | null;
          is_active: boolean;
          can_sell: boolean;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: string;
          auth_user_id?: string | null;
          pin_hash?: string | null;
          is_active?: boolean;
          can_sell?: boolean;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          auth_user_id?: string | null;
          pin_hash?: string | null;
          is_active?: boolean;
          can_sell?: boolean;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_settings: {
        Row: {
          /** Always true. The key that keeps this table to one row. */
          id: boolean;
          name: string;
          logo_url: string | null;
          address: string | null;
          phone: string | null;
          receipt_footer: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          name?: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          receipt_footer?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          receipt_footer?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          is_active: boolean;
          markup_percent: number;
          markup_applied: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          is_active?: boolean;
          markup_percent?: number;
          markup_applied?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          parent_id?: string | null;
          is_active?: boolean;
          markup_percent?: number;
          markup_applied?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          contact: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          /** Required when created on-device; admin may omit for server default. */
          id?: string;
          name: string;
          address?: string | null;
          contact?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          contact?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          description: string;
          amount: number;
          category: string | null;
          expense_date: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          description: string;
          amount: number;
          category?: string | null;
          expense_date?: string;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          description?: string;
          amount?: number;
          category?: string | null;
          expense_date?: string;
          note?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          sku: string | null;
          price: number;
          cost_price: number;
          stock_quantity: number;
          /** Flattened category path, maintained by a trigger. */
          category: string | null;
          category_id: string | null;
          unit: string;
          barcode: string | null;
          reorder_point: number;
          bulk_price: number | null;
          bulk_min_quantity: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sku?: string | null;
          price: number;
          cost_price?: number;
          stock_quantity?: number;
          category?: string | null;
          category_id?: string | null;
          unit?: string;
          barcode?: string | null;
          reorder_point?: number;
          bulk_price?: number | null;
          bulk_min_quantity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sku?: string | null;
          price?: number;
          cost_price?: number;
          stock_quantity?: number;
          category?: string | null;
          category_id?: string | null;
          unit?: string;
          barcode?: string | null;
          reorder_point?: number;
          bulk_price?: number | null;
          bulk_min_quantity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          user_id: string | null;
          total_amount: number;
          discount_amount: number;
          payment_method: string | null;
          status: string;
          device_id: string | null;
          created_at: string;
          customer_id: string | null;
          /** Optional, and null on most sales — a walk-in is never asked. */
          customer_name: string | null;
          customer_address: string | null;
          customer_contact: string | null;
          is_paid: boolean;
          fulfillment: string;
          delivery_completed: boolean;
          synced_at: string;
          updated_at: string;
        };
        Insert: {
          /** Required: generated on-device, never by the server. */
          id: string;
          user_id?: string | null;
          total_amount: number;
          discount_amount?: number;
          payment_method?: string | null;
          status?: string;
          device_id?: string | null;
          created_at: string;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_address?: string | null;
          customer_contact?: string | null;
          is_paid?: boolean;
          fulfillment?: string;
          delivery_completed?: boolean;
          synced_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          total_amount?: number;
          discount_amount?: number;
          payment_method?: string | null;
          status?: string;
          device_id?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_address?: string | null;
          customer_contact?: string | null;
          is_paid?: boolean;
          fulfillment?: string;
          delivery_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          list_price: number;
          unit_cost: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          /** Supplied by mobile so a retried push is idempotent. */
          id?: string;
          sale_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          /** Omitted by an older device; a trigger fills it from the product. */
          list_price?: number;
          unit_cost?: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          list_price?: number;
          unit_cost?: number;
          subtotal?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          change_quantity: number;
          reason: string;
          reference_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          change_quantity: number;
          reason: string;
          reference_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      supplier_products: {
        Row: {
          id: string;
          supplier_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey";
            columns: ["supplier_id"];
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          status: string;
          order_date: string;
          expected_date: string | null;
          reference_no: string | null;
          notes: string | null;
          /** Maintained by a trigger from purchase_order_items.line_total. */
          total_amount: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          status?: string;
          order_date?: string;
          expected_date?: string | null;
          reference_no?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          supplier_id?: string;
          status?: string;
          order_date?: string;
          expected_date?: string | null;
          reference_no?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          product_id: string | null;
          product_name: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number;
          /** Generated column: quantity_ordered * unit_cost. */
          line_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_cost: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          product_id?: string | null;
          product_name?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_payments: {
        Row: {
          id: string;
          purchase_order_id: string;
          term_number: number;
          due_date: string | null;
          amount: number;
          is_paid: boolean;
          paid_date: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          term_number: number;
          due_date?: string | null;
          amount: number;
          is_paid?: boolean;
          paid_date?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          due_date?: string | null;
          amount?: number;
          is_paid?: boolean;
          paid_date?: string | null;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_payments_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      oversold_products: {
        Row: {
          id: string;
          name: string;
          sku: string | null;
          stock_quantity: number;
          oversold_by: number;
        };
        Relationships: [];
      };
      stock_reconciliation: {
        Row: {
          id: string;
          name: string;
          stock_quantity: number;
          movement_total: number;
          drift: number;
        };
        Relationships: [];
      };
      products_below_reorder: {
        Row: {
          id: string;
          name: string;
          sku: string | null;
          category: string | null;
          unit: string;
          stock_quantity: number;
          reorder_point: number;
          short_by: number;
          cost_price: number;
          restock_cost: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      report_profit: {
        Args: { p_from: string; p_to: string };
        Returns: {
          bucket: string;
          sales_count: number;
          items_sold: number;
          revenue: number;
          discount: number;
          cost: number;
          gross_profit: number;
          margin_percent: number;
        }[];
      };
      report_top_products: {
        Args: { p_from: string; p_to: string; p_limit?: number };
        Returns: {
          product_id: string | null;
          product_name: string;
          category: string | null;
          quantity_sold: number;
          revenue: number;
          cost: number;
          gross_profit: number;
          margin_percent: number;
        }[];
      };
      report_discounts: {
        Args: { p_from: string; p_to: string };
        Returns: {
          sale_id: string;
          sold_at: string;
          cashier_name: string | null;
          device_id: string | null;
          product_name: string;
          quantity: number;
          list_price: number;
          unit_price: number;
          discount_total: number;
          discount_percent: number;
          below_cost: boolean;
        }[];
      };
      report_by_cashier: {
        Args: { p_from: string; p_to: string };
        Returns: {
          user_id: string | null;
          cashier_name: string;
          sales_count: number;
          revenue: number;
          discount: number;
          gross_profit: number;
          average_sale: number;
        }[];
      };
      report_by_device: {
        Args: { p_from: string; p_to: string };
        Returns: {
          device_id: string;
          sales_count: number;
          revenue: number;
          gross_profit: number;
          last_sale_at: string;
        }[];
      };
      report_inventory_valuation: {
        Args: Record<string, never>;
        Returns: {
          product_id: string;
          product_name: string;
          sku: string | null;
          category: string | null;
          unit: string;
          stock_quantity: number;
          cost_price: number;
          price: number;
          cost_value: number;
          retail_value: number;
          potential_profit: number;
        }[];
      };
      report_dead_stock: {
        Args: { p_days?: number };
        Returns: {
          product_id: string;
          product_name: string;
          sku: string | null;
          category: string | null;
          stock_quantity: number;
          cost_value: number;
          last_sold_at: string | null;
          days_since_sale: number | null;
        }[];
      };
      category_path: {
        Args: { p_category_id: string };
        Returns: string | null;
      };
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_change_quantity: number;
          p_reason: string;
          p_note?: string | null;
          p_created_by?: string | null;
          /** Points at the purchase order for a receiving-driven restock. */
          p_reference_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["products"]["Row"];
      };
      cashier_pins: {
        Args: Record<string, never>;
        Returns: { id: string; pin_hash: string | null }[];
      };
      verify_pin: {
        Args: {
          p_user_id: string;
          p_pin: string;
        };
        Returns: boolean;
      };
      current_app_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      current_app_user: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          email: string;
          role: string;
          is_active: boolean;
          can_sell: boolean;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        }[];
      };
      clear_must_change_password: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      patch_sale_flags: {
        Args: {
          p_id: string;
          p_is_paid: boolean;
          p_delivery_completed: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
