
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('name').ilike('name', '%DAQUA%');
  console.log('Projects with DAQUA:', projects);
  const { data: expected } = await supabase.from('expected_invoices').select('projectName').ilike('projectName', '%DAQUA%');
  const uniqueNames = [...new Set(expected.map(e => e.projectName))];
  console.log('Expected with DAQUA:', uniqueNames);
}
run();

