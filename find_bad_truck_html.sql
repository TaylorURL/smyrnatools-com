-- Pull the bucket path for plant 410's DetailOrderAnalysis on order #443's date
select 'detail/' || order_date || '_' || home_plant_code || '.html' as bucket_path
from public.dispatch_data
where order_num = '443' and ticket_num = '4107821'
limit 1;
