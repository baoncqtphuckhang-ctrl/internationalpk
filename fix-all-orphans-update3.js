
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const mapping = {
    'EATON PARK PHASE 1 (TĐ)': 'EATON PARK PHASE 1',
    'BÊNH VIỆN QT BECAMEX (BD)': 'BÊNH VIỆN QT BECAMEX',
    'TROPICAL AA TÂY NINH (BD)': 'TROPICAL AA TÂY NINH',
    'MINI HOTEL ỐP LÁT (PQ)': 'MINI HOTEL ỐP LÁT',
    'VP HỒ HẢO HỚN (Q1)': 'VP HỒ HẢO HỚN',
    'BỆNH VIỆN SIS (TĐ)': 'BỆNH VIỆN SIS',
    'GEM SKY WORLD 35 CĂN': 'GEM SKY WORLD 35 + 36 CĂN (ĐN)',
    'SUNSET TOWN (NÚI ÔNG QUÁN)': 'SUNSET TOWN 4.7 SUNGROUP (NGOÀI)'
  };
  
  for (const [oldName, newName] of Object.entries(mapping)) {
    console.log('Updating ' + oldName + ' -> ' + newName);
    const { error } = await supabase.from('expected_invoices')
      .update({ projectName: newName })
      .eq('projectName', oldName);
    if (error) console.error('Error for ' + oldName + ':', error);
  }
  console.log('Done!');
}
run();

