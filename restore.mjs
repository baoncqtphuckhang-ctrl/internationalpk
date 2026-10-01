
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3');

async function checkTrash() {
  const { data, error } = await supabase.from('trash_bin').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  const matches = data.filter(r => r.record_data && r.record_data.includes('Q9'));
  console.log('Matches:', matches.length);
  matches.forEach(m => {
    let parsed = JSON.parse(m.record_data);
    console.log(m.original_table, parsed.name || parsed.project_name);
  });
}
checkTrash();

