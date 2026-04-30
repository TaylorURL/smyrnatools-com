-- Inspect the two 403-loaded tickets on order #341 that are showing "—".
-- Compares them to a working 404 cross-plant ticket on the same order.
select
    ticket_num,
    loaded_plant_code,
    quantity,
    source_reports,
    updated_at
from dispatch_data
where order_date = current_date
  and order_num = '341'
  and ticket_num in ('40351551', '40351554', '40443408')
order by ticket_num;
