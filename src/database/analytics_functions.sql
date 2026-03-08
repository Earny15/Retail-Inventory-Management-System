-- Analytics Database Functions for AluminiumPro

-- Function to get sales analytics for a date range
CREATE OR REPLACE FUNCTION get_sales_analytics(start_date DATE, end_date DATE)
RETURNS TABLE (
  total_amount NUMERIC,
  invoice_count BIGINT,
  avg_invoice_value NUMERIC,
  total_gst NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(i.grand_total), 0) as total_amount,
    COUNT(i.id) as invoice_count,
    COALESCE(AVG(i.grand_total), 0) as avg_invoice_value,
    COALESCE(SUM(i.total_gst_amount), 0) as total_gst
  FROM customer_invoices i
  WHERE i.invoice_date >= start_date
    AND i.invoice_date <= end_date
    AND i.status = 'CONFIRMED';
END;
$$ LANGUAGE plpgsql;

-- Function to get purchase analytics for a date range
CREATE OR REPLACE FUNCTION get_purchase_analytics(start_date DATE, end_date DATE)
RETURNS TABLE (
  total_amount NUMERIC,
  transaction_count BIGINT,
  avg_transaction_value NUMERIC,
  total_items BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(vt.grand_total), 0) as total_amount,
    COUNT(vt.id) as transaction_count,
    COALESCE(AVG(vt.grand_total), 0) as avg_transaction_value,
    COALESCE(SUM(vt.items_count), 0) as total_items
  FROM vendor_transactions vt
  WHERE vt.transaction_date >= start_date
    AND vt.transaction_date <= end_date
    AND vt.status = 'CONFIRMED'
    AND vt.transaction_type = 'INWARD';
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly sales trends
CREATE OR REPLACE FUNCTION get_monthly_sales_trends(start_date DATE, end_date DATE)
RETURNS TABLE (
  month DATE,
  month_name TEXT,
  total_amount NUMERIC,
  invoices_count BIGINT,
  avg_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', i.invoice_date)::DATE as month,
    TO_CHAR(DATE_TRUNC('month', i.invoice_date), 'Month YYYY') as month_name,
    COALESCE(SUM(i.grand_total), 0) as total_amount,
    COUNT(i.id) as invoices_count,
    COALESCE(AVG(i.grand_total), 0) as avg_amount
  FROM customer_invoices i
  WHERE i.invoice_date >= start_date
    AND i.invoice_date <= end_date
    AND i.status = 'CONFIRMED'
  GROUP BY DATE_TRUNC('month', i.invoice_date)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory analytics
CREATE OR REPLACE FUNCTION get_inventory_analytics()
RETURNS TABLE (
  total_skus BIGINT,
  total_stock_value NUMERIC,
  low_stock_count BIGINT,
  out_of_stock_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT s.id) as total_skus,
    COALESCE(SUM(inv.current_stock * inv.avg_cost), 0) as total_stock_value,
    COUNT(CASE WHEN inv.current_stock <= COALESCE(s.minimum_stock_level, 0) AND COALESCE(s.minimum_stock_level, 0) > 0 THEN 1 END) as low_stock_count,
    COUNT(CASE WHEN inv.current_stock = 0 THEN 1 END) as out_of_stock_count
  FROM skus s
  LEFT JOIN inventory inv ON s.id = inv.sku_id
  WHERE s.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get inventory by category
CREATE OR REPLACE FUNCTION get_inventory_by_category()
RETURNS TABLE (
  id UUID,
  category_name TEXT,
  sku_count BIGINT,
  total_stock NUMERIC,
  total_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.category_name,
    COUNT(s.id) as sku_count,
    COALESCE(SUM(inv.current_stock), 0) as total_stock,
    COALESCE(SUM(inv.current_stock * inv.avg_cost), 0) as total_value
  FROM sku_categories sc
  LEFT JOIN skus s ON sc.id = s.category_id AND s.is_active = true
  LEFT JOIN inventory inv ON s.id = inv.sku_id
  GROUP BY sc.id, sc.category_name
  ORDER BY total_value DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get P&L analytics
CREATE OR REPLACE FUNCTION get_pl_analytics(start_date DATE, end_date DATE)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_cogs NUMERIC,
  total_gst_collected NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT
      COALESCE(SUM(i.grand_total), 0) as revenue,
      COALESCE(SUM(i.total_gst_amount), 0) as gst_collected
    FROM customer_invoices i
    WHERE i.invoice_date >= start_date
      AND i.invoice_date <= end_date
      AND i.status = 'CONFIRMED'
  ),
  cogs_data AS (
    SELECT
      COALESCE(SUM(ii.quantity * sc.cost_per_unit), 0) as cogs
    FROM customer_invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN stock_costs sc ON ii.sku_id = sc.sku_id
    WHERE i.invoice_date >= start_date
      AND i.invoice_date <= end_date
      AND i.status = 'CONFIRMED'
      AND sc.is_active = true
  )
  SELECT
    sd.revenue as total_revenue,
    cd.cogs as total_cogs,
    sd.gst_collected as total_gst_collected
  FROM sales_data sd, cogs_data cd;
END;
$$ LANGUAGE plpgsql;

-- Function to get SKU profitability
CREATE OR REPLACE FUNCTION get_sku_profitability(start_date DATE, end_date DATE)
RETURNS TABLE (
  sku_id UUID,
  sku_name TEXT,
  units_sold NUMERIC,
  revenue NUMERIC,
  cogs NUMERIC,
  profit NUMERIC,
  margin NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH sku_sales AS (
    SELECT
      ii.sku_id,
      s.sku_name,
      SUM(ii.quantity) as units_sold,
      SUM(ii.total_amount) as revenue,
      SUM(ii.quantity * COALESCE(sc.cost_per_unit, 0)) as cogs
    FROM customer_invoices i
    JOIN invoice_items ii ON i.id = ii.invoice_id
    JOIN skus s ON ii.sku_id = s.id
    LEFT JOIN stock_costs sc ON ii.sku_id = sc.sku_id AND sc.is_active = true
    WHERE i.invoice_date >= start_date
      AND i.invoice_date <= end_date
      AND i.status = 'CONFIRMED'
    GROUP BY ii.sku_id, s.sku_name
  )
  SELECT
    ss.sku_id,
    ss.sku_name,
    ss.units_sold,
    ss.revenue,
    ss.cogs,
    (ss.revenue - ss.cogs) as profit,
    CASE
      WHEN ss.revenue > 0 THEN ROUND(((ss.revenue - ss.cogs) / ss.revenue * 100)::NUMERIC, 1)
      ELSE 0
    END as margin
  FROM sku_sales ss
  WHERE ss.revenue > 0
  ORDER BY (ss.revenue - ss.cogs) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create views for summary data

-- Create view for invoice customer summary
CREATE OR REPLACE VIEW invoice_customer_summary AS
SELECT
  i.customer_id,
  DATE_TRUNC('day', i.invoice_date) as invoice_date,
  SUM(i.grand_total) as total_amount,
  COUNT(i.id) as invoices_count
FROM customer_invoices i
WHERE i.status = 'CONFIRMED'
GROUP BY i.customer_id, DATE_TRUNC('day', i.invoice_date);

-- Create view for invoice item summary
CREATE OR REPLACE VIEW invoice_item_summary AS
SELECT
  ii.sku_id,
  DATE_TRUNC('day', i.invoice_date) as invoice_date,
  SUM(ii.quantity) as total_quantity,
  SUM(ii.total_amount) as total_revenue
FROM customer_invoices i
JOIN invoice_items ii ON i.id = ii.invoice_id
WHERE i.status = 'CONFIRMED'
GROUP BY ii.sku_id, DATE_TRUNC('day', i.invoice_date);

-- Create view for vendor inward summary
CREATE OR REPLACE VIEW vendor_inward_summary AS
SELECT
  vt.vendor_id,
  DATE_TRUNC('day', vt.transaction_date) as transaction_date,
  SUM(vt.grand_total) as total_amount,
  COUNT(vt.id) as transactions_count
FROM vendor_transactions vt
WHERE vt.status = 'CONFIRMED' AND vt.transaction_type = 'INWARD'
GROUP BY vt.vendor_id, DATE_TRUNC('day', vt.transaction_date);

-- Create view for inward item summary
CREATE OR REPLACE VIEW inward_item_summary AS
SELECT
  vti.sku_id,
  DATE_TRUNC('day', vt.transaction_date) as transaction_date,
  SUM(vti.quantity) as total_quantity,
  SUM(vti.total_amount) as total_cost
FROM vendor_transactions vt
JOIN vendor_transaction_items vti ON vt.id = vti.transaction_id
WHERE vt.status = 'CONFIRMED' AND vt.transaction_type = 'INWARD'
GROUP BY vti.sku_id, DATE_TRUNC('day', vt.transaction_date);

-- Create view for inventory with details
CREATE OR REPLACE VIEW inventory_with_details AS
SELECT
  inv.id,
  inv.sku_id,
  inv.current_stock,
  inv.avg_cost,
  s.minimum_stock_level,
  s.sku_name
FROM inventory inv
JOIN skus s ON inv.sku_id = s.id
WHERE s.is_active = true;

-- Create view for inventory value analysis
CREATE OR REPLACE VIEW inventory_value_analysis AS
SELECT
  s.id as sku_id,
  s.sku_name,
  inv.current_stock,
  inv.avg_cost,
  (inv.current_stock * inv.avg_cost) as stock_value
FROM skus s
JOIN inventory inv ON s.id = inv.sku_id
WHERE s.is_active = true AND inv.current_stock > 0
ORDER BY stock_value DESC;