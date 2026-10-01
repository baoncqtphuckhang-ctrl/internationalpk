
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const mapping = {
    'EATON PARK PHASE 1 (TÐ)': 'EATON PARK PHASE 1',
    'PICITY SKY PARK (BD)': 'PICITY SKY PARK',
    'THE FELIX SN (BD)': 'THE FELIX SN',
    'BÊNH VI?N QT BECAMEX (BD)': 'BÊNH VI?N QT BECAMEX',
    'TROPICAL AA TÂY NINH (BD)': 'TROPICAL AA TÂY NINH',
    'MINI HOTEL ?P LÁT (PQ)': 'MINI HOTEL ?P LÁT',
    'VP H? H?O H?N (Q1)': 'VP H? H?O H?N',
    'CARA RIVER PARK (CT)': 'CARA RIVER PARK',
    'B?NH VI?N SIS (TÐ)': 'B?NH VI?N SIS',
    'TROPICAL SUN GROUP (PQ)': 'TROPICAL SUN GROUP'
  };
  
  for (const [oldName, newName] of Object.entries(mapping)) {
    console.log(Updating  -> );
    const { error } = await supabase.from('expected_invoices')
      .update({ projectName: newName })
      .eq('projectName', oldName);
    if (error) console.error(Error for :, error);
  }
  console.log('Done!');
}
run();

