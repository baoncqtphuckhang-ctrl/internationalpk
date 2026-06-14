async function cleanup() {
    const SUPABASE_URL = 'https://hidxjxsueyticzaadvpy.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_fYIcvEvuEPzEFvCDTBUs6A_WkCyBpbS';

    const fetchOpts = {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        }
    };

    console.log('Fetching orders...');
    let res = await fetch(SUPABASE_URL + '/rest/v1/material_orders?select=*', fetchOpts);
    const orders = await res.json();
    
    res = await fetch(SUPABASE_URL + '/rest/v1/approval_requests?select=*', fetchOpts);
    const dnttList = await res.json();

    console.log('Total orders:', orders.length);
    console.log('Total dnttList:', dnttList.length);

    let deletedCount = 0;
    for (const order of orders) {
        // Find matching DNTT
        const req = dnttList.find(d => {
            if (d.doc_type !== 'Đơn Vật Tư') return false;
            try {
                const parsed = JSON.parse(d.reason);
                if (parsed.material_order_id && parsed.material_order_id === order.id) return true;
                return d.project_name === order.project_name && 
                       d.recipient === order.recipient && 
                       parsed.date === order.order_date &&
                       parsed.items?.length > 0;
            } catch (e) { return false; }
        });

        if (!req) {
            console.log('Deleting orphan order:', order.id, order.project_name);
            // Move to trash
            const trashData = {
                original_table: 'material_orders',
                record_data: JSON.stringify(order),
                deleted_by: 'system_cleanup',
                deleted_at: new Date().toISOString()
            };
            await fetch(SUPABASE_URL + '/rest/v1/trash_bin', {
                method: 'POST',
                headers: fetchOpts.headers,
                body: JSON.stringify(trashData)
            });

            // Delete from material_orders
            await fetch(SUPABASE_URL + '/rest/v1/material_orders?id=eq.' + order.id, {
                method: 'DELETE',
                headers: fetchOpts.headers
            });
            deletedCount++;
        }
    }
    console.log('Deleted orphan orders count:', deletedCount);
}
cleanup();
