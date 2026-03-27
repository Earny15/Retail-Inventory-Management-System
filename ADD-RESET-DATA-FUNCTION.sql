-- AluminiumPro - Reset All Data Function
-- Run this in your Supabase SQL Editor
-- This function deletes all master and transactional data
-- EXCEPT: companies, users, roles, user_permissions

CREATE OR REPLACE FUNCTION reset_all_data(p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted_counts jsonb;
  v_invoices_count int;
  v_invoice_items_count int;
  v_quotations_count int;
  v_quotation_items_count int;
  v_inwards_count int;
  v_inward_items_count int;
  v_inventory_count int;
  v_inventory_tx_count int;
  v_customers_count int;
  v_vendors_count int;
  v_vendor_aliases_count int;
  v_skus_count int;
  v_categories_count int;
  v_wa_logs_count int;
BEGIN
  -- Verify password
  IF p_password != 'Etovin@1415' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid password');
  END IF;

  -- Count records before deletion for summary
  SELECT count(*) INTO v_invoice_items_count FROM customer_invoice_items;
  SELECT count(*) INTO v_invoices_count FROM customer_invoices;
  SELECT count(*) INTO v_quotation_items_count FROM sales_quotation_items;
  SELECT count(*) INTO v_quotations_count FROM sales_quotations;
  SELECT count(*) INTO v_inward_items_count FROM vendor_inward_items;
  SELECT count(*) INTO v_inwards_count FROM vendor_inwards;
  SELECT count(*) INTO v_inventory_tx_count FROM inventory_transactions;
  SELECT count(*) INTO v_inventory_count FROM inventory;
  SELECT count(*) INTO v_vendor_aliases_count FROM vendor_sku_aliases;
  SELECT count(*) INTO v_customers_count FROM customers;
  SELECT count(*) INTO v_vendors_count FROM vendors;
  SELECT count(*) INTO v_skus_count FROM skus;
  SELECT count(*) INTO v_categories_count FROM sku_categories;
  SELECT count(*) INTO v_wa_logs_count FROM whatsapp_message_logs;

  -- Delete in correct order (child tables first to respect foreign keys)

  -- 1. Transaction items and logs
  DELETE FROM customer_invoice_items;
  DELETE FROM vendor_inward_items;
  DELETE FROM sales_quotation_items;
  DELETE FROM inventory_transactions;
  DELETE FROM whatsapp_message_logs;

  -- 2. Transaction headers
  DELETE FROM customer_invoices;
  DELETE FROM vendor_inwards;
  DELETE FROM sales_quotations;

  -- 3. Inventory
  DELETE FROM inventory;

  -- 4. Vendor-SKU aliases
  DELETE FROM vendor_sku_aliases;

  -- 5. Masters (except companies, users, roles, user_permissions)
  DELETE FROM skus;
  DELETE FROM sku_categories;
  DELETE FROM customers;
  DELETE FROM vendors;

  -- Reset sequences
  ALTER SEQUENCE IF EXISTS customer_seq RESTART WITH 1;
  ALTER SEQUENCE IF EXISTS vendor_seq RESTART WITH 1;
  ALTER SEQUENCE IF EXISTS sku_seq RESTART WITH 1;

  -- Build summary
  v_deleted_counts := jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'customer_invoice_items', v_invoice_items_count,
      'customer_invoices', v_invoices_count,
      'sales_quotation_items', v_quotation_items_count,
      'sales_quotations', v_quotations_count,
      'vendor_inward_items', v_inward_items_count,
      'vendor_inwards', v_inwards_count,
      'inventory_transactions', v_inventory_tx_count,
      'inventory', v_inventory_count,
      'vendor_sku_aliases', v_vendor_aliases_count,
      'customers', v_customers_count,
      'vendors', v_vendors_count,
      'skus', v_skus_count,
      'sku_categories', v_categories_count,
      'whatsapp_message_logs', v_wa_logs_count
    ),
    'preserved', ARRAY['companies', 'users', 'roles', 'user_permissions']
  );

  RETURN v_deleted_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_all_data(text) TO authenticated;
